// netlify/functions/history.js

const HISTORY_KEY = "resume_history";
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!REDIS_URL || !REDIS_TOKEN) {
  throw new Error("Missing Redis environment variables");
}

async function redis(command, ...args) {
  const url = `${REDIS_URL}/${command}/${args.join("/")}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
  return res.json();
}

exports.handler = async () => {
  console.log("REDIS READ URL:", REDIS_URL);

  const data = await redis("LRANGE", HISTORY_KEY, "0", "49");

  const raw = Array.isArray(data?.result) ? data.result : [];
  const history = raw
    .map(v => {
      try {
        return JSON.parse(decodeURIComponent(v));
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
};
