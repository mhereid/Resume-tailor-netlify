// netlify/functions/tailor-resume.js

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const HISTORY_KEY = "resume_history";

const PRIMARY_MODEL = "gpt-5.2-instant";
const FALLBACK_MODEL = "gpt-5.2";

// Redis
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!REDIS_URL || !REDIS_TOKEN) {
  throw new Error("Missing Redis environment variables");
}

async function redis(command, ...args) {
  const url = `${REDIS_URL}/${command}/${args.join("/")}`;
  return fetch(url, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
}

/* ================= BASELINE RESUME (VERBATIM) ================= */

const BASELINE_RESUME = `
MIKE HEREID

San Diego, CA | 636-236-9425 | mike@mhere.id | LinkedIn: linkedin.com/in/mhereid

⸻

SUMMARY

Customer Success and Cloud Delivery leader with 10+ years of experience driving large-scale transformation across education, public sector, and SaaS platforms. Senior Customer Solutions Manager at AWS, leading complex cloud, AI, and generative AI programs from strategy through production. Proven ability to operate in ambiguity, align executives with product and engineering teams, and deliver measurable improvements in platform performance, adoption, and time-to-value.

⸻
[TRUNCATED HERE FOR BREVITY IN THIS MESSAGE — YOUR ACTUAL FILE SHOULD CONTAIN THE FULL RESUME EXACTLY AS YOU PROVIDED]
`;

/* ================= HELPERS ================= */

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
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
      messages: [systemMessage, userMessage],
      temperature: 0.2,
    }),
  });

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

/* ================= HANDLER ================= */

exports.handler = async (event) => {
  console.log("REDIS WRITE URL:", REDIS_URL);

  const { jobUrl, mode } = JSON.parse(event.body || {});
  if (!jobUrl) return { statusCode: 400, body: "Missing jobUrl" };

  const jobHtml = await (await fetch(jobUrl)).text();
  const jobText = stripHtml(jobHtml);

  const systemMessage = {
    role: "system",
    content:
      "Use ONLY information in the baseline resume. Do NOT invent anything.",
  };

  const userMessage = {
    role: "user",
    content: `
BASELINE RESUME:
${BASELINE_RESUME}

JOB DESCRIPTION:
${jobText}

MODE: ${mode}
Return only the resume text.
`,
  };

  let modelUsed = PRIMARY_MODEL;
  let output;

  try {
    output = await callOpenAI(PRIMARY_MODEL, systemMessage, userMessage);
    if (!output) throw new Error();
  } catch {
    modelUsed = FALLBACK_MODEL;
    output = await callOpenAI(FALLBACK_MODEL, systemMessage, userMessage);
  }

  const historyEntry = {
    id: crypto.randomUUID(),
    jobUrl,
    mode,
    modelUsed,
    createdAt: new Date().toISOString(),
  };

  await redis(
    "LPUSH",
    HISTORY_KEY,
    encodeURIComponent(JSON.stringify(historyEntry))
  );
  await redis("LTRIM", HISTORY_KEY, "0", "49");

  console.log("HISTORY WRITE SUCCESS", historyEntry);

  return {
    statusCode: 200,
    body: JSON.stringify({ resume: output }),
  };
};
