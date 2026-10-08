const url = new URL(process.env.STAGING_URL || "");
if (
  url.protocol !== "https:" ||
  !url.hostname.endsWith(".vercel.app") ||
  url.username ||
  url.password
)
  throw new Error("Use an approved HTTPS vercel.app staging endpoint.");
const response = await fetch(url, {
  redirect: "error",
  signal: AbortSignal.timeout(10000),
});
if (!response.ok) throw new Error("Staging health check failed");
const data = await response.json();
if (data.status !== "ok") throw new Error("Unexpected health response");
console.info("Staging health passed.");
