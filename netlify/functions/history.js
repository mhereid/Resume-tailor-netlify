// netlify/functions/history.js

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(command, ...args) {
  const url = `${REDIS_URL}/${command}/${args.join("/")}`;
  console.log("REDIS READ URL:", url);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });

  const text = await res.text();
  console.log("REDIS RAW RESPONSE:", text);

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

exports.handler = async () => {
  console.log("HISTORY FUNCTION INVOKED");

  try {
    if (!REDIS_URL || !REDIS_TOKEN) {
      console.error("MISSING REDIS ENV VARS", {
        REDIS_URL_PRESENT: Boolean(REDIS_URL),
        REDIS_TOKEN_PRESENT: Boolean(REDIS_TOKEN),
      });

      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Redis environment variables not configured",
        }),
      };
    }

    const resp = await redis("LRANGE", "resume_history", "0", "49");

    const rawList =
      Array.isArray(resp)
        ? resp
        : Array.isArray(resp?.result)
        ? resp.result
        : [];

    console.log("RAW HISTORY COUNT:", rawList.length);

    const history = rawList
      .map(item => {
        try {
          return JSON.parse(decodeURIComponent(item));
        } catch (e) {
          console.error("FAILED TO PARSE HISTORY ITEM", e);
          return null;
        }
      })
      .filter(Boolean);

    console.log("PARSED HISTORY COUNT:", history.length);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
      body: JSON.stringify({ history }),
    };
  } catch (err) {
    console.error("HISTORY FUNCTION CRASHED", err);

    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "History fetch failed",
        details: String(err),
      }),
    };
  }
};
