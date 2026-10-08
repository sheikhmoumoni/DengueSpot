/* Only a fixed anonymous application shell and static assets are cacheable. */
const VERSION = "denguespot-shell-v1";
const SHELL = [
  "/bn-BD",
  "/en-BD",
  "/bn-BD/report",
  "/en-BD/report",
  "/bn-BD/my-reports",
  "/en-BD/my-reports",
  "/bn-BD/learn",
  "/en-BD/learn",
  "/icon.svg",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/fonts/noto-bengali.woff2",
];
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then(async (cache) => {
      await Promise.all(
        SHELL.map(async (url) => {
          try {
            const response = await fetch(url, { credentials: "omit" });
            if (response.ok) await cache.put(url, response);
          } catch {
            /* A partial shell install can be retried. */
          }
        }),
      );
      await self.skipWaiting();
    }),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.includes("/authority") ||
    url.pathname.includes("/moderation") ||
    url.pathname.includes("/privacy") ||
    url.pathname.includes("/r/") ||
    url.pathname.includes("/login") ||
    url.search
  )
    return;
  if (url.pathname.startsWith("/_next/static/") || SHELL.includes(url.pathname))
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok && response.type === "basic") {
            const cache = await caches.open(VERSION);
            await cache.put(request, response.clone());
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return new Response("Offline. Reconnect to load this page.", {
            status: 503,
            headers: { "Content-Type": "text/plain" },
          });
        }),
    );
});
