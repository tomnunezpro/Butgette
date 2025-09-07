// sw.js — Service Worker pour GitHub Pages (PWA hors-ligne)
const CACHE_NAME = "budget-pwa-v1";

// ⚠️ Précache seulement ce qui est local au dépôt.
// Les CDN (React/Tailwind/Babel) seront mis en cache en "runtime".
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

// Install: pré-cache des fichiers cœur
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

// Activate: nettoyage des anciens caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))))
    )
  );
  self.clients.claim();
});

// Fetch: Cache-first pour même origine, Network-first sinon, avec fallback
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;

  // Navigation requests (SPA): toujours renvoyer index.html depuis le cache (offline)
  if (req.mode === "navigate") {
    event.respondWith(
      caches.match("./index.html").then((cached) =>
        cached ||
        fetch("./index.html").then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put("./index.html", copy));
          return res;
        })
      )
    );
    return;
  }

  if (isSameOrigin) {
    // Cache-first pour les assets locaux
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchAndUpdate = fetch(req)
          .then((res) => {
            if (res && res.status === 200) {
              const copy = res.clone();
              caches.open(CACHE_NAME).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => cached); // offline -> cache si dispo
        return cached || fetchAndUpdate;
      })
    );
  } else {
    // CDN: Network-first + mise en cache opportuniste
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
  }
});
