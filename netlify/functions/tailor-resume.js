// netlify/functions/tailor-resume.js

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(command, ...args) {
  const res = await fetch(`${REDIS_URL}/${command}/${args.join("/")}`, {
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
    },
  });
  return res.json();
}

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-5.2";

// Full baseline resume (external-facing, ATS-ready, not condensed)
const BASELINE_RESUME = `
MIKE HEREID
San Diego, CA • 636.236.9425 • mike@mhere.id

EXECUTIVE SUMMARY
Cloud transformation and AI/ML strategy leader with extensive experience guiding enterprise organizations through large-scale modernization, platform migrations, and AI-enabled product delivery. Proven ability to influence executive stakeholders, navigate ambiguity, and accelerate time to value across education technology, public safety, and public-sector SaaS.
Leverages deep technical fluency and strong delivery leadership to align product, engineering, and business teams around complex cloud and AI initiatives. Consistently drives measurable outcomes, reduces operational risk, and ensures predictable execution at scale. Manages an annual customer portfolio exceeding $140M ARR across multiple strategic accounts.

CORE SKILLS
Cloud Migration and Modernization • AI/ML Strategy and Implementation Oversight • SaaS Product Enablement
Executive Stakeholder Engagement • Operating Model Development • Cross-Functional Leadership
Delivery Governance • Risk Mitigation • Accelerating Customer Time to Value

PROFESSIONAL EXPERIENCE

Amazon Web Services (AWS)
Senior Customer Solutions Manager  
2022 – Present | Remote

Lead digital transformation, cloud modernization, and AI/ML initiatives for enterprise organizations in education technology, public safety, and government. Provide executive advisory, delivery oversight, and strategic direction across multi-year modernization programs while managing a customer portfolio exceeding $140M in annual recurring revenue.

AI / ML STRATEGY & PRODUCT INNOVATION
(Ordered by decreasing ARR; aligned with Senior CSM pillars: delivery leadership, advisory excellence, accelerating time to value)

Global Education Technology Platform (Higher Education LMS; 35M+ users)
Senior CSM – AI Delivery Leadership, Cross-Functional Alignment, Executive Advisory

AI Workflow Automation Agent – $540K ARR
Provided delivery oversight and advisory guidance for the development of an AI-powered automation agent integrating with more than 700 LMS APIs. Ensured clarity of scope, alignment between product and engineering teams, and timely resolution of execution barriers. Accelerated time to value by establishing success criteria and supporting rollout readiness for a high-visibility release.

Skills Alignment and Workforce Pathway Platform – $300K ARR
Advised senior product leadership on AI feasibility, data dependencies, integration patterns, and long-term scalability. Ensured cross-team alignment and streamlined decision-making for a multi-system AI framework connecting skills, outcomes, and career pathways.

AI Accessibility Compliance Modernization – $185K ARR
Led delivery oversight and stakeholder alignment for a regulatory-focused AI initiative. Provided guidance on solution approach, implementation milestones, and validation frameworks to ensure compliance readiness and predictable execution.

AI Agent Observability and Intent Classification – ARR Not Tagged
Provided guidance on success measures, instrumentation strategy, and cross-functional coordination for an AI observability layer supporting large-scale agent deployments. Reduced ambiguity and enabled faster iteration by aligning engineering and product expectations.

AI-Enhanced LMS Migration Tooling – ARR Not Tagged
Supported the development of AI-assisted migration tooling by clarifying requirements, sequencing dependencies, and ensuring alignment across platform teams. Accelerated migration timelines from 90 to 30 days, significantly reducing customer onboarding cycles.

Global Online Learning and Tutoring Platform
AI Platform Migration – Projected $1.5M ARR
Served as delivery lead and advisor for migration from a competitive LLM provider to a new AI foundation. Guided evaluation, readiness planning, phased rollout, and performance validation. Achieved 25–35 percent cost reduction, 15–20 percent accuracy improvement, and 99.99 percent reliability while enabling materially faster deployment timelines.

K–12 Learning Platform (3M+ students)
AI Content Moderation – $300K ARR
Oversaw delivery of a custom AI content filtering solution. Aligned product, engineering, and data science teams on quality thresholds, evaluation strategy, and responsible AI considerations. Accelerated deployment by resolving cross-team ambiguities early and ensuring production readiness.

Public Safety SaaS Provider (Law Enforcement Software)
AI Narrative Generation and Case Summarization – $180K ARR
Guided delivery of automated report drafting and case summarization capabilities. Provided advisory support on risk boundaries, data requirements, and architectural considerations. Accelerated time to pilot readiness for mission-critical workflows in regulated environments.

CLOUD MIGRATION & MODERNIZATION LEADERSHIP

Statewide Public Services Program (Approximately 2 million monthly calls)
Large-Scale Contact Center Modernization
Led multi-wave migration of a complex statewide contact center platform to the cloud. Directed cross-functional support teams, drove risk and issue management, and built repeatable mechanisms adopted across multiple program deployments. Generated $12M ARR and established scalable migration patterns.

MECHANISMS & ORGANIZATIONAL LEADERSHIP
• Designed a sell-through engagement model that improved scalability, clarified ownership lines, and accelerated delivery across multi-account initiatives.
• Co-developed an AI opportunity qualification and readiness framework, enabling structured engagement models and improving deal quality.
• Created cross-organizational enablement mechanisms that expanded to multiple AWS business units, driving consistency in execution and scaling best practices across the field.

REVENUE IMPACT SUMMARY
• Generated $17.4M in directly measurable revenue across modernization, migration, and AI initiatives.
• Annual portfolio responsibility exceeding $140M ARR across multiple strategic customers.
• Multi-year AI and modernization programs contributing millions in new ARR across 2024–2025.

University of California, San Diego
Managing Director, Client Engagement  
2019 – 2022  

Directed enterprise HR/Payroll transformation for a 40,000-employee institution. Managed 80+ cross-functional contributors and redesigned major operational units. Delivered a 61 percent reduction in paper check usage, generating $496K in annual savings.

Huron Consulting Group
Manager, Higher Education & Public Sector Consulting  
2011 – 2019  

Led multi-campus ERP modernization efforts. Oversaw data conversion for more than 200,000 employees, coordinated testing across teams of 75+ technical and functional experts, and redesigned 28 enterprise business processes.

EDUCATION
B.S.B.A., Finance, Economics & Strategy, Entrepreneurship  
Washington University in St. Louis  

CERTIFICATIONS
AWS Solutions Architect – Associate (2022)
AWS Machine Learning – Associate (2025)
Six Sigma Black Belt
Generative AI Executive Acumen
Executive Acumen – FinOps

INTERESTS
Baseball • Backpacking • Fly Fishing • Barbecue
`;

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const jobUrl = body.jobUrl;
    const mode = body.mode === "one_page" ? "one_page" : "full";

    if (!jobUrl) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing jobUrl in request body" }),
      };
    }

    const jobResponse = await fetch(jobUrl);
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

    const modeInstructions =
      mode === "one_page"
        ? `
The hiring manager wants a concise one-page resume:
- Limit the output to approximately one page of text.
- Prioritize the highest-impact and most relevant experience.
- Remove or compress less relevant history.
- Use tight bullets and a focused summary suitable for a one-page leadership resume.
`
        : `
You may produce a multi-page resume as needed:
- You do not need to constrain to one page.
- Preserve rich detail where it is relevant to the role.
`;

    const systemMessage = {
      role: "system",
      content: [
        "You are an expert resume writer and career coach.",
        "Your job is to tailor the user's baseline resume to a specific job posting.",
        "Use only experience and skills that are actually present in the baseline resume.",
        "You may reorder sections and bullets, change wording, and emphasize relevant experience.",
        "Do NOT invent companies, titles, dates, or achievements that are not supported by the baseline.",
        "Output a complete, polished resume in plain text suitable for ATS (no tables or images).",
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

Additional instructions based on mode:
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

    const openaiResponse = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        reasoning_effort: "none",
        messages: [systemMessage, userMessage],
        temperature: 0.3,
      }),
    });

    if (!openaiResponse.ok) {
      const errText = await openaiResponse.text();
      console.error("OpenAI error:", errText);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "OpenAI API error", details: errText }),
      };
    }

    const data = await openaiResponse.json();
    const tailored = data.choices?.[0]?.message?.content || "";

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resume: tailored }),
    };
  } catch (err) {
    console.error("Server error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server error", details: String(err) }),
    };
  }
};
