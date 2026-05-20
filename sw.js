const VERSION = "fhjj-pwa-v4";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./firebase-config.js",
  "./manifest.json",
  "https://www.gstatic.com/firebasejs/9.17.2/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/9.17.2/firebase-firestore-compat.js",
  "./images/wall.jpg",
  "./images/blackleaf.jpg",
  "./images/blacklock.jpg",
  "./images/ap4m.jpg",
  "./images/ap4left.jpg",
  "./images/ap4right.jpg",
  "./music/bgm.m4a",
  "./jyy/jyyvoice.mp3",
  "./jyy/jyy.mp4"
];

for (let i = 1; i <= 14; i += 1) APP_SHELL.push(`./pic/pic${i}.jpg`);
for (let i = 1; i <= 26; i += 1) APP_SHELL.push(`./memo/memo${i}.jpg`);

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(cacheAllSettled(APP_SHELL));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => (key === VERSION ? undefined : caches.delete(key))));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_URLS") return;
  event.waitUntil(cacheAllSettled(event.data.urls || []));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const request = event.request;
  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "./index.html"));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

async function cacheAllSettled(urls) {
  const cache = await caches.open(VERSION);
  await Promise.allSettled(Array.from(new Set(urls)).map(async (url) => {
    const request = /^https?:\/\//i.test(url)
      ? new Request(url, { mode: "no-cors", cache: "reload" })
      : new Request(url, { cache: "reload" });
    const response = await fetch(request);
    if (response.ok || response.type === "opaque") await cache.put(request, response);
  }));
}

function isStaticAsset(url) {
  return /\.(?:html|css|js|json|jpg|jpeg|png|webp|gif|svg|mp3|m4a|mp4|mov|woff2?)$/i.test(url.pathname) ||
    url.hostname.includes("gstatic.com");
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok || response.type === "opaque") {
      const cache = await caches.open(VERSION);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return fallback(request);
  }
}

async function networkFirst(request, fallbackUrl) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(VERSION);
    cache.put(request, response.clone());
    return response;
  } catch {
    return caches.match(request).then((cached) => cached || caches.match(fallbackUrl));
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const fetched = fetch(request).then(async (response) => {
    if (response.ok || response.type === "opaque") {
      const cache = await caches.open(VERSION);
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => undefined);
  return cached || fetched || fallback(request);
}

async function fallback(request) {
  if (request.destination === "document") return caches.match("./index.html");
  return new Response("", { status: 504, statusText: "Offline" });
}
