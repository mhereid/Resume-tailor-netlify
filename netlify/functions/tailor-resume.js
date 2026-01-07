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
San Diego, CA | 636.236.9425 | michael.hereid@gmail.com

SUMMARY  
Cloud transformation and AI/ML delivery leader guiding enterprise and public-sector organizations through large-scale modernization, platform migrations, and AI-enabled product delivery. Trusted executive advisor who aligns product, engineering, and business stakeholders, establishes delivery governance, and accelerates time to value across complex, regulated environments. Manages a strategic customer portfolio exceeding $140M ARR and has generated $17.4M in directly measurable revenue across cloud and AI initiatives.

CORE STRENGTHS  
Cloud Migration & Modernization | AI/ML Strategy & Delivery Oversight | Stakeholder Engagement  
Cross-Functional Leadership | Delivery Governance & Operating Mechanisms | Risk/Issue Management  
SaaS Product Enablement | Accelerating Customer Time to Value | Portfolio & Program Leadership  

PROFESSIONAL EXPERIENCE  
AMAZON WEB SERVICES (AWS) — Senior Customer Solutions Manager | Remote | 2022 – Present  
Lead enterprise cloud modernization and AI/ML initiatives across education technology, public safety, and government; provide executive advisory and delivery oversight for multi-year programs. Own a customer portfolio exceeding $140M ARR.  
-	Led migration of a statewide contact center platform (~2M monthly calls) to the cloud; drove multi-wave execution, cross-functional coordination, and risk/issue management; generated $12M ARR and established repeatable migration mechanisms.  
-	Served as delivery lead for AI platform migration for a global online learning/tutoring platform; guided evaluation, readiness planning, phased rollout, and performance validation; achieved 25–35% cost reduction, 15–20% accuracy improvement, and 99.99% reliability.  
-	Provided delivery oversight for an AI workflow automation agent integrating with 700+ LMS APIs; aligned product/engineering on scope and success criteria and supported rollout readiness for a high-visibility release.  
-	Oversaw delivery of custom AI content moderation for a K–12 learning platform (3M+ students); aligned product, engineering, and data science on quality thresholds, evaluation strategy, and responsible AI considerations.
-	Advised senior product leadership on AI feasibility, data dependencies, and scalable integration patterns for a skills alignment/workforce pathway platform.  
-	Built scalable operating mechanisms: designed a sell-through engagement model to clarify ownership and accelerate delivery; co-developed an AI opportunity qualification/readiness framework; created enablement mechanisms adopted across multiple AWS business units.  

UNIVERSITY OF CALIFORNIA, SAN DIEGO — Managing Director, Client Engagement | 2019 – 2022  
Directed enterprise HR/Payroll transformation for a 40,000-employee institution; led 80+ cross-functional contributors and redesigned major operational units.  
-	Delivered a 61% reduction in paper check usage, generating $496K in annual savings through process and operating model improvements.  

HURON CONSULTING GROUP — Manager, Public Sector Consulting | 2011 – 2019  
Led multi-campus ERP modernization programs spanning technical and functional teams.  
-	Oversaw data conversion for 200,000+ employees and coordinated testing across 75+ experts; redesigned 28 enterprise business processes to support modernization outcomes.  

EDUCATION  
Washington University in St. Louis — B.S.B.A., Finance, Economics & Strategy, Entrepreneurship  

CERTIFICATIONS  
AWS Solutions Architect – Associate (2022) | AWS Machine Learning – Associate (2025) | Six Sigma Black Belt

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
