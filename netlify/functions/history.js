// netlify/functions/history.js

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(command, ...args) {
  const res = await fetch(`${REDIS_URL}/${command}/${args.join("/")}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
  return res.json();
}

exports.handler = async (event) => {
  try {
    // Return last 50 entries
    const resp = await redis("LRANGE", "resume_history", "0", "49");

    // Upstash returns { result: [...] } or { error: ... }
    const rawList = resp?.result;

    if (!Array.isArray(rawList)) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history: [], note: "No history or Redis returned non-list." }),
      };
    }

    const history = rawList
      .map((s) => {
        try {
          const decoded = decodeURIComponent(s);
          return JSON.parse(decoded);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ history }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "History server error", details: String(e) }),
    };
  }
};
