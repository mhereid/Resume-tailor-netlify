// netlify/functions/tailor-resume.js

const REDIS_URL =
  process.env.UPSTASH_REDIS_REST_URL || process.env.ASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-5.2";

/* ================================
   BASELINE RESUME — VERBATIM
   (CORE SKILLS REMOVED)
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
• Designed and delivered an enterprise-scale accessibility compliance solution for a large learning platform ahead of regulatory deadlines.
• Managed a time-bound generative AI engagement reducing manual correction from 37% to <10%.
• Led implementation of an AI-powered workflow agent integrating 700+ production APIs.
• Designed a scalable migration framework reducing timelines from ~90 days to ~30 days.
• Delivered AI-assisted documentation and summarization for mission-critical records platforms.
• Led one of AWS’s largest contact-center migrations supporting millions of monthly interactions.

⸻

UNIVERSITY OF CALIFORNIA, SAN DIEGO — Managing Director, Client Engagement

San Diego, CA | Aug 2019–Aug 2022
• Led enterprise HR, Payroll, and shared services transformation.
• Designed an integrated operations center supporting 40,000+ employees.
• Managed 80+ cross-functional staff.
• Reduced manual processing by 60%+ using Six Sigma methods.

⸻

HURON CONSULTING GROUP — Manager

Feb 2011–Aug 2019
• Led large-scale ERP implementations.
• Directed data conversion for 200,000+ employees.
• Planned enterprise testing for systems supporting 50,000+ users.
• Led future-state process design across 25+ workflows.

⸻

EDUCATION

Bachelor of Science in Business Administration  
Washington University in St. Louis

⸻

CERTIFICATIONS
• AWS Certified Solutions Architect – Associate  
• AWS Certified Machine Learning – Associate  
• Six Sigma Black Belt
`;

async function redis(command, ...args) {
  const url = `${REDIS_URL}/${command}/${args.join("/")}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
  return res.json();
}

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

exports.handler = async (event) => {
  try {
    const { jobUrl, mode } = JSON.parse(event.body || "{}");

    const jobRes = await fetch(jobUrl);
    const jobHtml = await jobRes.text();
    const jobText = stripHtml(jobHtml);

    const messages = [
      {
        role: "system",
        content:
          "You are an expert resume writer. Rewrite the resume to align to the job description using ONLY the baseline resume. Do not fabricate experience, dates, locations, employers, or achievements.",
      },
      {
        role: "user",
        content: `
BASELINE RESUME:
${BASELINE_RESUME}

JOB DESCRIPTION:
${jobText}

INSTRUCTIONS:
- Use only information present in the baseline resume.
- Reorder and rephrase for relevance.
- Do NOT add new experience, employers, titles, metrics, or locations.
- Return ONLY the final resume text.
`,
      },
    ];

    const aiRes = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.3,
      }),
    });

    const aiData = await aiRes.json();
    const resumeText = aiData.choices?.[0]?.message?.content || "";

    const entry = {
      id: crypto.randomUUID(),
      jobUrl,
      mode,
      output: resumeText,
      modelUsed: MODEL,
      createdAt: new Date().toISOString(),
    };

    await redis(
      "LPUSH",
      "resume_history",
      encodeURIComponent(JSON.stringify(entry))
    );
    await redis("LTRIM", "resume_history", "0", "49");

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resume: resumeText,
        debug: {
          historyId: entry.id,
          outputLength: resumeText.length,
        },
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
