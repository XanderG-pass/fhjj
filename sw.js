const VERSION = "fhjj-pwa-v12";
const ROOT = new URL("./", self.location.href).href;
const SHELL = ["./", "./index.html", "./style.css?v=20260906", "./script.js?v=20260906", "./story-data.js?v=20260906", "./vendor/icons.js", "./firebase-config.js", "./manifest.json", "./images/blackleaf.PNG", "./images/blacklock.PNG", "./images/river-opening.webp"];
async function fetchBounded(request, timeout = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try { return await fetch(request, { signal: controller.signal }); }
  finally { clearTimeout(timer); }
}
async function put(request, response) {
  if (!response || response.status !== 200 || response.type === "opaque") return;
  try { const cache = await caches.open(VERSION); await cache.put(request, response); }
  catch { /* Cache space must never determine whether a page can load. */ }
}
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    await Promise.allSettled(SHELL.map(async (path) => {
      const request = new Request(new URL(path, ROOT), { cache: "reload" });
      await put(request, await fetchBounded(request));
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("fhjj-pwa-") && key !== VERSION).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || request.headers.has("range")) return;
  const fresh = request.mode === "navigate" || /\.(?:js|css|json)$/.test(url.pathname);
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(request);
    if (!fresh && cached) return cached;
    try {
      const response = await fetchBounded(request, fresh ? 3500 : 10000);
      if (response.ok) {
        event.waitUntil(put(request, response.clone()));
        return response;
      }
      if (cached) return cached;
      return response;
    } catch {
      if (cached) return cached;
      if (request.mode === "navigate") {
        const shell = await cache.match(new URL("./index.html", ROOT).href);
        if (shell) return shell;
      }
      return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
    }
  })());
});
