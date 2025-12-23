// netlify/functions/tailor-resume.js

/**
 * Implements:
 * - Primary + fallback model (gpt-5.2-instant -> gpt-5.2)
 * - Logs: model used, token usage, estimated cost
 * - Stores model + usage + estimated cost in history (Upstash Redis)
 *
 * Pricing:
 * - OpenAI pricing page lists gpt-5.2 ($1.75 / 1M input, $14 / 1M output).
 * - It does NOT list gpt-5.2-instant separately as an API pricing line item.
 * - We therefore estimate gpt-5.2-instant cost using gpt-5.2 rates and label it.
 * Source: https://platform.openai.com/docs/pricing
 */

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

const PRIMARY_MODEL = "gpt-5.2-instant";
const FALLBACK_MODEL = "gpt-5.2";

// USD per 1M tokens (from OpenAI pricing page for gpt-5.2)
const PRICING_PER_1M = {
  // From https://platform.openai.com/docs/pricing
  "gpt-5.2": { input: 1.75, output: 14.0 },

  // Not separately listed; estimated as gpt-5.2
  "gpt-5.2-instant": { input: 1.75, output: 14.0, estimated_from: "gpt-5.2" },
};

// Upstash Redis (History)
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(command, ...args) {
  const res = await fetch(`${REDIS_URL}/${command}/${args.join("/")}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
  return res.json();
}

/* ------------------------
   BASELINE RESUME (VERBATIM)
   From uploaded Resume_MHEREID.docx
------------------------ */

const BASELINE_RESUME = `MIKE HEREID
San Diego, CA | 636.236.9425 | michael.hereid@gmail.com

SUMMARY  
Cloud transformation and AI/ML delivery leader guiding enterp...ed environments. Manages a strategic customer portfolio exceed

CORE STRENGTHS  
Cloud Migration & Modernization | AI/ML Strategy & Delivery Oversight | Stakeholder Engagement  
Cross-Functional Leadership | Delivery Governance & Operating Mechanisms | Risk/Issue Management  
SaaS Product Enablement | Accelerating Customer Time to Value | Portfolio & Program Leadership  

PROFESSIONAL EXPERIENCE  
AMAZON WEB SERVICES (AWS) — Senior Customer Solutions Manager | Remote | 2022 – Present  
Lead enterprise cloud modernization and AI/ML initiatives acr...year programs. Own a customer portfolio exceeding $140M ARR.  
Led migration of a statewide contact center platform (~2M mon...ed $12M ARR and established repeatable migration mechanisms.  
Served as delivery lead for AI platform migration for a globa...uction, 15–20% accuracy improvement, and 99.99% reliability.  
Provided delivery oversight for an AI workflow automation age...d supported rollout readiness for a high-visibility release.  
Oversaw delivery of custom AI content moderation for a K–12 l...holds, evaluation strategy, and responsible AI considerations.
Advised senior product leadership on AI feasibility, data dep... patterns for a skills alignment/workforce pathway platform.  
Built scalable operating mechanisms: designed a sell-through ...ement mechanisms adopted across multiple AWS business units.  

UNIVERSITY OF CALIFORNIA, SAN DIEGO — Managing Director, Client Engagement | 2019 – 2022  
Directed enterprise HR/Payroll transformation for a 40,000-em...ctional contributors and redesigned major operational units.  
Delivered a 61% reduction in paper check usage, generating $4...al savings through process and operating model improvements.  

HURON CONSULTING GROUP — Manager, Public Sector Consulting | 2011 – 2019  
Led multi-campus ERP modernization programs spanning technical and functional teams.  
Oversaw data conversion for 200,000+ employees and coordinate...rprise business processes to support modernization outcomes.  

EDUCATION  
Washington University in St. Louis — B.S.B.A., Finance; Economics & Strategy; Entrepreneurship  

CERTIFICATIONS  
AWS Solutions Architect – Associate (2022)  
AWS Machine Learning – Associate (2025)  
Six Sigma Black Belt  
Generative AI Executive Acumen  
Executive Acumen – FinOps  

INTERESTS  
Baseball | Backpacking | Fly Fishing | Barbecue`;

/* ------------------------
   Helpers
------------------------ */

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function estimateCostUsd(model, usage) {
  const pricing = PRICING_PER_1M[model] || PRICING_PER_1M["gpt-5.2"];
  const prompt = usage?.prompt_tokens || 0;
  const completion = usage?.completion_tokens || 0;

  const inputUsd = (prompt / 1_000_000) * pricing.input;
  const outputUsd = (completion / 1_000_000) * pricing.output;

  return {
    estimated_cost_usd: Number((inputUsd + outputUsd).toFixed(6)),
    pricing_model: PRICING_PER_1M[model] ? model : "gpt-5.2",
    pricing_note:
      model === "gpt-5.2-instant" && pricing.estimated_from
        ? `Estimated using ${pricing.estimated_from} rates`
        : "Priced using listed model rates",
  };
}

async function callOpenAI({ model, systemMessage, userMessage }) {
  const t0 = Date.now();
  const res = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      reasoning_effort: "none",
      messages: [systemMessage, userMessage],
      temperature: 0.3,
    }),
  });

  const ms = Date.now() - t0;

  let data;
  try {
    data = await res.json();
  } catch (e) {
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      status: res.status,
      ms,
      error: "Failed to parse OpenAI JSON",
      details: text || String(e),
      model,
    };
  }

  const text = data?.choices?.[0]?.message?.content || "";
  const usage = data?.usage || {};

  return {
    ok: res.ok,
    status: res.status,
    ms,
    model,
    text,
    usage,
    raw: data,
  };
}

function inferCompanyAndRole(jobText, jobUrl) {
  let company = "";
  let role = "";

  // Try common patterns first
  const lines = jobText.split(/\n+/).map(l => l.trim()).filter(Boolean);

  for (const line of lines.slice(0, 20)) {
    if (!role && /(engineer|manager|lead|director|head|architect|consultant)/i.test(line)) {
      role = line.slice(0, 120);
    }
    if (!company && /(inc\.?|corp\.?|llc|ltd|technologies|systems)/i.test(line)) {
      company = line.slice(0, 120);
    }
  }

  // Fallback: infer from hostname
  if (!company && jobUrl) {
    try {
      company = new URL(jobUrl).hostname.replace("www.", "");
    } catch {}
  }

  return {
    company: company || "Unknown",
    role: role || "Unknown role",
  };
}

/* ------------------------
   Handler
------------------------ */

exports.handler = async (event) => {
  console.log("REQUEST RECEIVED", { method: event.httpMethod });

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const jobUrl = (body.jobUrl || "").trim();
    const mode = body.mode === "one_page" ? "one_page" : "full";

    console.log("REQUEST PARAMS", { jobUrl, mode });

    if (!jobUrl) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing jobUrl in request body" }),
      };
    }

    // Fetch job posting HTML
    const jobResponse = await fetch(jobUrl);
    console.log("JOB FETCH STATUS", {
      status: jobResponse.status,
      ok: jobResponse.ok,
      contentType: jobResponse.headers.get("content-type"),
    });

    if (!jobResponse.ok) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: `Failed to fetch job posting (${jobResponse.status})`,
        }),
      };
    }

    const jobHtml = await jobResponse.text();
    const jobText = stripHtml(jobHtml);

    console.log("JOB TEXT METRICS", {
      length: jobText.length,
      preview: jobText.slice(0, 240),
    });

    console.log("PROMPT SIZE", {
      baselineChars: BASELINE_RESUME.length,
      jobChars: jobText.length,
      totalChars: BASELINE_RESUME.length + jobText.length,
    });

    const modeInstructions =
      mode === "one_page"
        ? [
            "The hiring manager wants a concise one-page resume.",
            "Limit output to approximately one page of text.",
            "Prioritize the highest-impact and most relevant experience.",
            "Use tight bullets and a focused summary.",
          ].join(" ")
        : [
            "You may produce a multi-page resume as needed.",
            "Preserve rich detail where it is relevant.",
          ].join(" ");

    const systemMessage = {
      role: "system",
      content: [
        "You are an expert resume writer and career coach.",
        "You tailor a baseline resume to a specific job posting.",
        "Use only experience and skills present in the baseline resume.",
        "Do NOT invent companies, titles, dates, achievements, metrics, or certifications.",
        "Output a complete, polished resume in plain text suitable for ATS.",
        "Never return an empty response.",
      ].join(" "),
    };

    const userMessage = {
      role: "user",
      content: `
Here is the baseline resume:

==== BASELINE RESUME START ====
${BASELINE_RESUME}
==== BASELINE RESUME END ====

Here is the job description text scraped from the given URL:

==== JOB DESCRIPTION START ====
${jobText}
==== JOB DESCRIPTION END ====

Mode instructions:
${modeInstructions}

Task:
- Rewrite the resume so that it is strongly aligned to this job description.
- Keep it honest: do not fabricate roles, dates, or achievements.
- Emphasize the most relevant bullets; you may de-emphasize or omit less relevant material.
- Preserve the candidate's level and career trajectory.
- Include an updated summary that mirrors the language and priorities of the job posting.
- Return only the finalized resume, no explanation.
`,
    };

    // Try primary, then fallback if empty
    console.log("CALLING OPENAI (primary)", { model: PRIMARY_MODEL });

    let result = await callOpenAI({
      model: PRIMARY_MODEL,
      systemMessage,
      userMessage,
    });

    console.log("OPENAI RESPONSE (primary)", {
      ok: result.ok,
      status: result.status,
      ms: result.ms,
      outputLen: (result.text || "").length,
      usage: result.usage,
    });

    let modelUsed = PRIMARY_MODEL;
    let usedFallback = false;

    const isEmpty = !result.text || result.text.trim().length < 50;

    if (!result.ok) {
      console.error("OPENAI ERROR (primary)", result.raw || result.details);
      // If primary fails hard, attempt fallback as well
      console.warn("Primary model failed; attempting fallback", {
        fallback: FALLBACK_MODEL,
      });
      usedFallback = true;
      modelUsed = FALLBACK_MODEL;

      result = await callOpenAI({
        model: FALLBACK_MODEL,
        systemMessage,
        userMessage,
      });

      console.log("OPENAI RESPONSE (fallback)", {
        ok: result.ok,
        status: result.status,
        ms: result.ms,
        outputLen: (result.text || "").length,
        usage: result.usage,
      });
    } else if (isEmpty) {
      console.warn("Primary returned empty output; attempting fallback", {
        fallback: FALLBACK_MODEL,
      });
      usedFallback = true;
      modelUsed = FALLBACK_MODEL;

      result = await callOpenAI({
        model: FALLBACK_MODEL,
        systemMessage,
        userMessage,
      });

      console.log("OPENAI RESPONSE (fallback)", {
        ok: result.ok,
        status: result.status,
        ms: result.ms,
        outputLen: (result.text || "").length,
        usage: result.usage,
      });
    }

    const tailored = result.text || "";

    if (!result.ok) {
      console.error("OPENAI ERROR (final)", result.raw || result.details);
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "OpenAI API error",
          details:
            typeof result.details === "string"
              ? result.details
              : JSON.stringify(result.raw || {}),
        }),
      };
    }

    if (!tailored || tailored.trim().length < 50) {
      console.error("EMPTY MODEL OUTPUT (final)", {
        modelUsed,
        usedFallback,
        usage: result.usage,
      });
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Model returned empty output",
          modelUsed,
          usedFallback,
        }),
      };
    }

    const cost = estimateCostUsd(modelUsed, result.usage);

    console.log("MODEL USAGE SUMMARY", {
      modelUsed,
      usedFallback,
      usage: result.usage,
      cost,
    });

const { company, role } = inferCompanyAndRole(jobText, jobUrl);
    
    // Write history (best-effort)
   const entry = {
  id: crypto.randomUUID(),
  company,
  role,
  jobUrl,
  mode,
  output: tailored,
  modelUsed,
  usedFallback,
  usage: {
    prompt_tokens: result.usage?.prompt_tokens || 0,
    completion_tokens: result.usage?.completion_tokens || 0,
    total_tokens: result.usage?.total_tokens || 0,
  },
  cost, // { estimated_cost_usd, pricing_model, pricing_note }
  createdAt: new Date().toISOString(),
};
    try {
      await redis("LPUSH", "resume_history", encodeURIComponent(JSON.stringify(entry)));
      await redis("LTRIM", "resume_history", "0", "49");
      console.log("HISTORY WRITE SUCCESS", { id: entry.id });
    } catch (e) {
      console.error("HISTORY WRITE FAILED", e);
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resume: tailored,
        meta: {
          modelUsed,
          usedFallback,
          usage: entry.usage,
          cost: entry.cost,
        },
      }),
    };
  } catch (err) {
    console.error("SERVER ERROR", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server error", details: String(err) }),
    };
  }
};
