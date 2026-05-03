// Service worker for the OUVRO landing page. The goal is to make the bookmarked
// page (and the resources it needs to launch Expo Go) survive poor signal:
//
//   1. The landing-page HTML and the logo are pre-cached on install so the
//      page renders instantly even when fully offline.
//   2. The Expo manifest endpoints (/ and /manifest with the expo-platform
//      header) are served stale-while-revalidate so a cached manifest is
//      handed back immediately while a fresh one is fetched in the background.
//   3. Content-addressed bundle URLs (under /<timestamp>/_expo/static/) are
//      served cache-first because they are immutable.
//
// The service worker only runs in browsers that visit the landing page; it
// cannot intercept Expo Go's native HTTP requests. The HTTP `Cache-Control`
// headers set in server/index.ts are what give Expo Go itself the same
// stale-while-revalidate behaviour.

const CACHE_VERSION = "v2";
const SHELL_CACHE = `ouvro-shell-${CACHE_VERSION}`;
const MANIFEST_CACHE = `ouvro-manifest-${CACHE_VERSION}`;
const BUNDLE_CACHE = `ouvro-bundle-${CACHE_VERSION}`;
const KNOWN_CACHES = new Set([SHELL_CACHE, MANIFEST_CACHE, BUNDLE_CACHE]);

const SHELL_ASSETS = ["/", "/assets/images/ouvro-logo.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => !KNOWN_CACHES.has(k)).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isExpoManifestRequest(request, url) {
  if (url.pathname !== "/" && url.pathname !== "/manifest") return false;
  return request.headers.get("expo-platform") !== null;
}

function isBundleRequest(url) {
  // Build script writes bundles under /<timestamp>/_expo/static/js/<platform>/bundle.js
  return /^\/\d+(?:-\d+)?\/_expo\/static\//.test(url.pathname);
}

function staleWhileRevalidate(event, cacheName) {
  return caches.open(cacheName).then((cache) =>
    cache.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            cache.put(event.request, response.clone());
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
}

function cacheFirst(event, cacheName) {
  return caches.open(cacheName).then((cache) =>
    cache.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.ok) {
          cache.put(event.request, response.clone());
        }
        return response;
      });
    }),
  );
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept API traffic.
  if (url.pathname.startsWith("/api")) return;

  if (isExpoManifestRequest(event.request, url)) {
    event.respondWith(staleWhileRevalidate(event, MANIFEST_CACHE));
    return;
  }

  if (isBundleRequest(url)) {
    event.respondWith(cacheFirst(event, BUNDLE_CACHE));
    return;
  }

  if (url.pathname === "/" || url.pathname.startsWith("/assets/")) {
    event.respondWith(staleWhileRevalidate(event, SHELL_CACHE));
    return;
  }

  // Everything else: pass through, with a cache fallback if the network fails.
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request)),
  );
});
