/* First Then Board — service worker (offline mode)
   - Raise VERSION with every release (same number as <meta name="version"> in index.html).
     A new VERSION makes a new cache; the old one is deleted on activate.
   - Only same-origin GET requests are handled. Everything else (for example the
     TelemetryDeck POSTs to another origin) is not touched and goes straight to the network.
   - Nothing personal is cached: boards and photos live in IndexedDB, not here. */
const VERSION = "1.5.1";
const CACHE = "ft-v" + VERSION;
const PAGE = "./";
const PRECACHE = [
  PAGE,
  "privacy.html",
  "manifest.json",
  "favicon.ico",
  "icon-192.png",
  "icon-512.png",
  "apple-touch-icon.png",
  "telemetrydeck-web.js",
  "telemetrydeck-sdk.js",
  "signals.js"
];
// Guide pages, printable PDFs (each under 300 KB) and app icons. Saved one by one: a missing file never stops the install.
const PRECACHE_OPTIONAL = [
  "apps/visual-schedule.png",
  "apps/token-board.png",
  "apps/kidstimer.png",
  "printable/",
  "first-then-next/",
  "autism/",
  "toddlers/",
  "first-then-vs-visual-schedule/",
  "printables/first-then-blank-a4.pdf",
  "printables/first-then-blank-letter.pdf",
  "printables/first-then-next-blank-a4.pdf",
  "printables/first-then-next-blank-letter.pdf",
  "printables/first-then-labels-a4.pdf",
  "printables/first-then-labels-letter.pdf"
];
const NAV_TIMEOUT_MS = 4000;

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE.map(url => new Request(url, { cache: "reload" })))
        .then(() => Promise.all(PRECACHE_OPTIONAL.map(url => cache.add(new Request(url, { cache: "reload" })).catch(() => {})))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("ft-") && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isHome(url) {
  const scope = new URL(PAGE, self.registration.scope).pathname;
  return url.pathname === scope || url.pathname === scope + "index.html";
}

async function cachedPage(request) {
  const cache = await caches.open(CACHE);
  const url = new URL(request.url);
  return (isHome(url) ? await cache.match(PAGE) : await cache.match(request, { ignoreSearch: true })) || null;
}

// Pages: network first; the cached page when offline or when the network is too slow.
async function navigate(request) {
  let timer;
  const slow = new Promise(resolve => { timer = setTimeout(() => resolve(null), NAV_TIMEOUT_MS); });
  const net = fetch(request);
  try {
    const first = await Promise.race([net, slow]);
    if (first) return first;
    return (await cachedPage(request)) || (await net);
  } catch (e) {
    const cached = await cachedPage(request);
    if (cached) return cached;
    throw e;
  } finally {
    clearTimeout(timer);
    net.catch(() => {});
  }
}

// Other files of this site: the cached copy first, else the network.
async function asset(request) {
  const cache = await caches.open(CACHE);
  return (await cache.match(request, { ignoreSearch: true })) || fetch(request);
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(request.mode === "navigate" ? navigate(request) : asset(request));
});
