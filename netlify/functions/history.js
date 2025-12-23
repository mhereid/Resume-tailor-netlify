// netlify/functions/history.js

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(command, ...args) {
  const url = `${REDIS_URL}/${command}/${args.join("/")}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
  return res.text();
}

exports.handler = async () => {
  try {
    const raw = await redis("LRANGE", "resume_history", "0", "49");
    const parsed = JSON.parse(raw);

    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.result)
      ? parsed.result
      : [];

    const history = list
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
