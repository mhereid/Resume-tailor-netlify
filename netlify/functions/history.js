// netlify/functions/history.js

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(command, ...args) {
  const res = await fetch(`${REDIS_URL}/${command}/${args.join("/")}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
  return res.json();
}

exports.handler = async () => {
  try {
    const resp = await redis("LRANGE", "resume_history", "0", "49");

    // Upstash may return { result: [...] } OR [...]
    const raw =
      Array.isArray(resp)
        ? resp
        : Array.isArray(resp?.result)
        ? resp.result
        : [];

    const history = raw
      .map(item => {
        try {
          return JSON.parse(decodeURIComponent(item));
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
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "History fetch failed",
        details: String(err),
      }),
    };
  }
};
