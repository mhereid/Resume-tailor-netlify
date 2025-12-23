// netlify/functions/tailor-resume.js

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const MODEL_PRIMARY = "gpt-5.2";
const MODEL_FALLBACK = "gpt-4.1";

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// FULL BASELINE RESUME — VERBATIM
const BASELINE_RESUME = `
MIKE HEREID

San Diego, CA | 636-236-9425 | mike@mhere.id | LinkedIn: linkedin.com/in/mhereid

⸻

SUMMARY

Customer Success and Cloud Delivery leader with 10+ years of experience driving large-scale transformation across education, public sector, and SaaS platforms. Senior Customer Solutions Manager at AWS, leading complex cloud, AI, and generative AI programs from strategy through production. Proven ability to operate in ambiguity, align executives with product and engineering teams, and deliver measurable improvements in platform performance, adoption, and time-to-value.

⸻

CORE SKILLS

Customer Success Leadership; AI & Generative AI Delivery; Cloud Migrations; Enterprise Adoption & Retention; Executive Stakeholder Management; Technical Program Leadership; Product & Engineering Partnership; Operating Cadence & Governance; AWS (Bedrock, SageMaker, Connect, EC2, DynamoDB, S3); AI Evaluation & Observability; Process Design & Automation; Risk & Escalation Management

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

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function redis(command, ...args) {
  const url = `${REDIS_URL}/${command}/${args.join("/")}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
  return res.json();
}

async function callOpenAI(model, messages) {
  const res = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages, temperature: 0.3 }),
  });

  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const { jobUrl, mode = "full" } = JSON.parse(event.body || "{}");
  if (!jobUrl) return { statusCode: 400, body: "Missing jobUrl" };

  const jobHtml = await fetch(jobUrl).then(r => r.text());
  const jobText = stripHtml(jobHtml);

  const system = {
    role: "system",
    content:
      "Rewrite the resume to align with the job description using ONLY the baseline resume. Do not invent facts.",
  };

  const user = {
    role: "user",
    content: `BASELINE RESUME:\n${BASELINE_RESUME}\n\nJOB DESCRIPTION:\n${jobText}`,
  };

  let modelUsed = MODEL_PRIMARY;
  let data;
  try {
    data = await callOpenAI(MODEL_PRIMARY, [system, user]);
  } catch {
    modelUsed = MODEL_FALLBACK;
    data = await callOpenAI(MODEL_FALLBACK, [system, user]);
  }

  const resume = data.choices?.[0]?.message?.content || "";

  const historyEntry = {
    id: crypto.randomUUID(),
    jobUrl,
    mode,
    modelUsed,
    output: resume,
    createdAt: new Date().toISOString(),
  };

  await redis("LPUSH", "resume_history", encodeURIComponent(JSON.stringify(historyEntry)));
  await redis("LTRIM", "resume_history", "0", "49");

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      resume,        // for UI
      historySaved: true
    }),
  };
};
