// netlify/functions/history.js

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(command, ...args) {
  const url = `${REDIS_URL}/${command}/${args.join("/")}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
  return res.json();
}

exports.handler = async () => {
  try {
    const data = await redis("LRANGE", "resume_history", "0", "49");

    // Upstash returns { result: [...] }
    const rawList = Array.isArray(data)
      ? data
      : Array.isArray(data?.result)
      ? data.result
      : [];

    const history = rawList
      .map(item => {
        try {
          return JSON.parse(decodeURIComponent(item));
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .map(entry => ({
        id: entry.id,
        company: entry.company || "Unknown",
        role: entry.role || "Unknown role",
        jobUrl: entry.jobUrl,
        mode: entry.mode,
        modelUsed: entry.modelUsed || "unknown",
        cost: entry.cost || null,
        createdAt: entry.createdAt,
      }));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ history }),
    };
  } catch (err) {
    console.error("HISTORY READ FAILED", err);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ history: [] }),
    };
  }
};
