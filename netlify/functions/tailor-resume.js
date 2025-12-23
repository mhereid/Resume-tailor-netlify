// netlify/functions/tailor-resume.js

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

const PRIMARY_MODEL = "gpt-5.2-instant";
const FALLBACK_MODEL = "gpt-5.2";

// Pricing (USD per 1M tokens)
const PRICING = {
  "gpt-5.2-instant": { input: 1.25, output: 10.0 },
  "gpt-5.2": { input: 2.5, output: 15.0 },
};

// Redis (Upstash)
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(command, ...args) {
  const url = `${REDIS_URL}/${command}/${args.join("/")}`;
  return fetch(url, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
}

// --- helpers --------------------------------------------------

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function estimateCost(model, usage) {
  if (!usage || !PRICING[model]) return 0;
  return (
    (usage.prompt_tokens / 1_000_000) * PRICING[model].input +
    (usage.completion_tokens / 1_000_000) * PRICING[model].output
  );
}

function inferCompanyAndRole(jobText, jobUrl) {
  const lines = jobText.split(/\n+/).map(l => l.trim()).filter(Boolean);

  let role = lines.find(l =>
    /(manager|director|lead|engineer|architect|head|consultant)/i.test(l)
  );

  let company = lines.find(l =>
    /(inc\.?|corp\.?|llc|ltd|technologies|systems|labs|platform)/i.test(l)
  );

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

async function callOpenAI(model, systemMessage, userMessage) {
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

  const data = await res.json();
  return {
    text: data?.choices?.[0]?.message?.content || "",
    usage: data?.usage || {},
  };
}

// --- handler --------------------------------------------------

exports.handler = async (event) => {
  console.log("REQUEST RECEIVED");

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const { jobUrl, mode } = JSON.parse(event.body || "{}");
  if (!jobUrl) {
    return { statusCode: 400, body: "Missing jobUrl" };
  }

  const jobRes = await fetch(jobUrl);
  const jobHtml = await jobRes.text();
  const jobText = stripHtml(jobHtml);

  const { company, role } = inferCompanyAndRole(jobText, jobUrl);

  const systemMessage = {
    role: "system",
    content:
      "You are an expert resume writer. Always return a complete ATS-friendly resume.",
  };

  const userMessage = {
    role: "user",
    content: `
BASELINE RESUME:
<<USE THE CANONICAL RESUME FROM Resume_MHEREID.docx>>

JOB DESCRIPTION:
${jobText}

MODE:
${mode === "one_page" ? "One-page condensed resume" : "Full resume"}

Return ONLY the finalized resume text.
`,
  };

  let modelUsed = PRIMARY_MODEL;
  let usedFallback = false;
  let result;

  try {
    console.warn("CALLING PRIMARY MODEL", PRIMARY_MODEL);
    result = await callOpenAI(PRIMARY_MODEL, systemMessage, userMessage);
    if (!result.text) throw new Error("Empty primary output");
  } catch (err) {
    console.warn("PRIMARY FAILED — FALLING BACK", FALLBACK_MODEL);
    usedFallback = true;
    modelUsed = FALLBACK_MODEL;
    result = await callOpenAI(FALLBACK_MODEL, systemMessage, userMessage);
  }

  const cost = {
    estimated_cost_usd: estimateCost(modelUsed, result.usage),
    pricing_model: modelUsed,
  };

  const historyEntry = {
    id: crypto.randomUUID(),
    company,
    role,
    jobUrl,
    mode,
    modelUsed,
    usedFallback,
    cost,
    createdAt: new Date().toISOString(),
  };

  try {
    await redis(
      "LPUSH",
      "resume_history",
      encodeURIComponent(JSON.stringify(historyEntry))
    );
    await redis("LTRIM", "resume_history", "0", "49");
    console.log("HISTORY WRITE SUCCESS", historyEntry);
  } catch (e) {
    console.error("HISTORY WRITE FAILED", e);
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resume: result.text }),
  };
};
