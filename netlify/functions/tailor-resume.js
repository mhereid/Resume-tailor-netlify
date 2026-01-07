// netlify/functions/tailor-resume.js
// Baseline-only tailoring, anti-hallucination hard mode (fact bank + constrained rewrite + output guard)

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-5.2";

function json(statusCode, obj) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(obj),
  };
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchHtml(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      text: "",
      error: String(err?.message || err),
      name: err?.name || "FetchError",
    };
  } finally {
    clearTimeout(timeout);
  }
}

/* ================================
   BASELINE RESUME — FULL, VERBATIM
   Sole source of truth.
================================ */
const BASELINE_RESUME = `
MIKE HEREID

San Diego, CA | 636-236-9425 | mike@mhere.id | LinkedIn: linkedin.com/in/mhereid

⸻

SUMMARY

Customer Success and Cloud Delivery leader with 10+ years of experience driving large-scale transformation across education, public sector, and SaaS platforms. Senior Customer Solutions Manager at AWS, leading complex cloud, AI, and generative AI programs from strategy through production. Proven ability to operate in ambiguity, align executives with product and engineering teams, and deliver measurable improvements in platform performance, adoption, and time-to-value.

⸻

PROFESSIONAL EXPERIENCE

AMAZON WEB SERVICES — Senior Customer Solutions Manager

San Diego, CA | Aug 2022–Present
• Own senior delivery leadership for multiple strategic and enterprise-scale customers, concurrently driving complex cloud, AI, and generative AI programs while serving as the primary executive-facing advisor and escalation owner.
• Led an end-to-end migration of a large, production generative AI platform from a third-party provider to AWS, delivering 25–35% operating cost reduction, 99.99% service reliability, and 15–20% improvement in response accuracy while strengthening data governance and model customization.
• Directed a targeted optimization initiative for a student-facing AI-powered question-and-answer system, increasing answer accuracy from ~52% to 73% on high-difficulty problem sets through model benchmarking, automated evaluation pipelines, and prompt optimization.
• Designed and delivered an enterprise-scale accessibility compliance solution for a large learning platform ahead of regulatory deadlines, enabling automated document scanning, bulk remediation, and human-in-the-loop validation across extensive instructional content libraries.
• Managed a time-bound generative AI engagement to unblock a skills-extraction system with a 37% manual correction rate, delivering a production-ready pipeline that reduced manual intervention to a <10% target and processed multi-course datasets in minutes instead of hours.
• Led implementation of an AI-powered workflow agent embedded in a large SaaS platform, orchestrating integration with 700+ production APIs and establishing quality controls, feedback loops, and metered access to support secure enterprise rollout.
• Designed a scalable migration and onboarding framework enabling organizations to transition from competing platforms, reducing average migration timelines from ~90 days to ~30 days while maintaining data integrity and functional parity.
• Delivered AI-assisted documentation and summarization capabilities for a mission-critical records platform, reducing manual authoring effort while meeting strict security, auditability, and compliance requirements.
• Led one of AWS’s largest and most complex contact-center migrations, coordinating 3–5 concurrent deployment waves and supporting millions of monthly interactions, while establishing go-live and escalation playbooks reused across other enterprise programs.

⸻

UNIVERSITY OF CALIFORNIA, SAN DIEGO — Managing Director, Client Engagement

San Diego, CA | Aug 2019–Aug 2022
• Led enterprise transformation initiatives spanning HR, Payroll, and shared services in a highly distributed university environment.
• Designed and launched an integrated operations center supporting 40,000+ employees across academic and administrative units.
• Managed 80+ cross-functional staff through system implementations, organizational transitions, and operational stabilization.
• Applied Six Sigma methodologies to redesign pay-distribution workflows, reducing manual processing by 60%+ and improving operational efficiency.

⸻

HURON CONSULTING GROUP — Manager

Various Locations | Feb 2011–Aug 2019
• Led large-scale ERP system implementations for public-sector and higher-education clients, owning delivery from planning through production cutover.
• Directed data-conversion programs across 15 campuses, converting 200,000+ employee records through multi-wave execution.
• Planned and executed enterprise testing strategies for systems supporting 50,000+ users, coordinating 70+ cross-functional resources.
• Led future-state process design across 25+ enterprise workflows, translating complex requirements into scalable operating and system models.

⸻

EDUCATION

Bachelor of Science in Business Administration
Finance, Economics & Strategy, Entrepreneurship
Washington University in St. Louis

⸻

CERTIFICATIONS
• AWS Certified Solutions Architect – Associate
• AWS Certified Machine Learning – Associate
• Six Sigma Black Belt
`;

// Guardrail: reject specific “made up” patterns that tend to appear.
// You can extend this list over time if the model keeps inventing stuff.
const FORBIDDEN_PATTERNS = [
  /\bdesigned\b.*\btool\b/i,
  /\bbuilt\b.*\btool\b/i,
  /\bautomated\b.*\bpipeline\b/i,
  /\bdata pipeline\b/i,
  /\b3–5\b|\b3-5\b/i, // if you don’t want ranges to appear unless baseline contains them
  /\bdeployment waves?\b/i,
  /\bplaybooks?\b/i,
  /\bframeworks?\b/i, // if you want to avoid “framework” claims unless baseline includes
  /\bhealth scoring\b/i,
  /\bQBR\b/i,
];

function violatesForbiddenPatterns(text) {
  return FORBIDDEN_PATTERNS.some((re) => re.test(text));
}

exports.handler = async (event) => {
  const reqId =
    (globalThis.crypto?.randomUUID && globalThis.crypto.randomUUID()) ||
    `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  let stage = "start";

  try {
    stage = "method_check";
    if (event.httpMethod !== "POST") {
      return json(405, { error: "METHOD_NOT_ALLOWED", reqId });
    }

    stage = "parse_body";
    let body = {};
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch (e) {
      return json(400, {
        error: "BAD_JSON_BODY",
        reqId,
        details: String(e?.message || e),
      });
    }

    const jobUrl = (body.jobUrl || "").trim();
    const mode = body.mode === "one_page" ? "one_page" : "full";

    stage = "validate_inputs";
    if (!jobUrl) return json(400, { error: "MISSING_JOB_URL", reqId });
    if (!/^https?:\/\//i.test(jobUrl))
      return json(400, { error: "INVALID_JOB_URL", reqId, jobUrl });

    stage = "validate_env";
    if (!process.env.OPENAI_API_KEY) {
      return json(500, { error: "MISSING_OPENAI_API_KEY", reqId });
    }

    stage = "fetch_job_html";
    const jobFetch = await fetchHtml(jobUrl, 15000);
    if (!jobFetch.ok) {
      return json(502, {
        error: "JOB_FETCH_FAILED",
        reqId,
        jobUrl,
        debug: { status: jobFetch.status, name: jobFetch.name, message: jobFetch.error },
      });
    }
    if (jobFetch.status < 200 || jobFetch.status >= 300) {
      return json(400, {
        error: "JOB_FETCH_NON_200",
        reqId,
        jobUrl,
        status: jobFetch.status,
        bodyPreview: jobFetch.text.slice(0, 800),
      });
    }

    stage = "extract_job_text";
    const jobText = stripHtml(jobFetch.text);
    if (!jobText || jobText.length < 200) {
      return json(400, {
        error: "JOB_TEXT_TOO_SHORT",
        reqId,
        jobUrl,
        jobTextPreview: jobText.slice(0, 300),
      });
    }

    stage = "build_prompt";
    const modeInstructions =
      mode === "one_page"
        ? "ONE-PAGE MODE: Keep to ~1 page. Reduce bullets per role. Prefer 5–8 bullets for AWS, 2–3 for other roles. No new info."
        : "FULL MODE: Keep all relevant baseline content. No new info.";

    // Critical: constrain the model to ONLY use exact baseline bullet facts.
    // We do this in two steps inside one completion:
    // 1) Build a FACT BANK by extracting only claims present in baseline (verbatim fragments).
    // 2) Produce the resume USING ONLY those facts; reordering and light rephrasing allowed, but no new details.

    const system = {
      role: "system",
      content: [
        "You are an expert resume writer.",
        "Hard constraint: The baseline resume is the ONLY source of truth.",
        "You must not invent or infer any new tools, systems, processes, teams, counts, waves, pipelines, playbooks, frameworks, or responsibilities.",
        "You must not change name, location, contact info, employers, titles, or dates.",
        "If a concept is not explicitly in the baseline, you cannot include it.",
        "Output must be ATS-friendly plain text (no tables).",
      ].join(" "),
    };

    const user = {
      role: "user",
      content: `
You must follow this process:

STEP 1 — FACT BANK
Extract a 'FACT BANK' as a list of bullets that are DIRECTLY present in the baseline resume.
Rules:
- Each fact must be supported by an exact phrase from the baseline.
- Do not add specificity. Do not infer tools, counts, or methods.
- Keep facts short and literal.

STEP 2 — TAILORED RESUME
Write a tailored resume that aligns to the job description USING ONLY facts from the FACT BANK.
Rules:
- You may reorder and lightly rephrase facts but you may NOT add new nouns/details.
- Do not mention anything not in the baseline.
- Keep contact block exactly as baseline.

${modeInstructions}

BASELINE RESUME:
==== START BASELINE ====
${BASELINE_RESUME}
==== END BASELINE ====

JOB DESCRIPTION:
==== START JOB ====
${jobText}
==== END JOB ====

Output format:
- First print the line: "FACT BANK:"
- Then the fact bank bullets
- Then print the line: "RESUME:"
- Then the final tailored resume text.
`,
    };

    stage = "call_openai";
    const aiRes = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [system, user],
        temperature: 0.0, // clamp creativity
      }),
    });

    stage = "read_openai";
    const raw = await aiRes.text();
    let data = null;
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }

    if (!aiRes.ok) {
      return json(502, {
        error: "OPENAI_HTTP_ERROR",
        reqId,
        status: aiRes.status,
        bodyPreview: raw.slice(0, 1200),
      });
    }

    stage = "extract_output";
    const content = data?.choices?.[0]?.message?.content || "";
    if (!content.trim()) {
      return json(502, { error: "EMPTY_MODEL_OUTPUT", reqId });
    }

    // Split out the resume portion.
    const idx = content.indexOf("RESUME:");
    if (idx === -1) {
      return json(502, {
        error: "MALFORMED_MODEL_OUTPUT",
        reqId,
        details: "Missing 'RESUME:' section",
        bodyPreview: content.slice(0, 1200),
      });
    }

    const resume = content.slice(idx + "RESUME:".length).trim();
    if (!resume) {
      return json(502, {
        error: "EMPTY_RESUME_SECTION",
        reqId,
        bodyPreview: content.slice(0, 1200),
      });
    }

    stage = "guardrails";
    if (violatesForbiddenPatterns(resume)) {
      return json(409, {
        error: "HALLUCINATION_GUARD_TRIGGERED",
        reqId,
        message:
          "Output contained forbidden invented patterns. Tighten baseline phrasing or extend forbidden list.",
        // Helpful debugging:
        offendingPatterns: FORBIDDEN_PATTERNS.map((r) => r.toString()),
        resumePreview: resume.slice(0, 1600),
      });
    }

    stage = "success";
    return json(200, {
      resume,
      meta: {
        reqId,
        modelUsed: MODEL,
        mode,
      },
    });
  } catch (err) {
    return json(500, {
      error: "UNHANDLED_SERVER_ERROR",
      reqId,
      stage,
      message: String(err?.message || err),
    });
  }
};
