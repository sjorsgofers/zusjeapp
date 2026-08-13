/* Zusje App service worker — installable PWA + offline shell */
const CACHE = "zusje-app-v5";

// Allow the page to tell a waiting worker to activate immediately.
self.addEventListener("message", event => {
  if (event.data === "skipWaiting") self.skipWaiting();
});

// Core files that make the app open offline. Sub-app images are cached at runtime.
const PRECACHE = [
  "./",
  "index.html",
  "manifest.json",
  "logo.png",
  "favicon.png",
  "icon-192.png",
  "icon-512.png",
  "dranken/index.html",
  "dranken/data.json",
  "allergenen/index.html",
  "allergenen/data.json",
  "checklists/index.html"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(PRECACHE.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Only handle our own origin; leave the kiosk (kiosk.shiftbase.com) to the network.
  if (url.origin !== self.location.origin) return;

  const isHTML = req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");
  const isData = url.pathname.endsWith(".json");

  if (isHTML || isData){
    // Network-first, bypassing the browser HTTP cache so updates always arrive.
    // Falls back to the offline cache only when the network is unavailable.
    event.respondWith(
      fetch(req, { cache: "no-store" })
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(()=>{});
          return res;
        })
        .catch(() => caches.match(req).then(m => m || caches.match("index.html")))
    );
  } else {
    // Cache-first for static assets (images, icons, css/js).
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(()=>{});
        return res;
      }).catch(() => cached))
    );
  }
});
