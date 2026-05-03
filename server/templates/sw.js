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
const PRECACHE_PLATFORMS = ["ios", "android"];

// Pre-cache the Expo manifest for each platform at install time, then read the
// launchAsset URL out of each manifest and pre-cache the current bundle as
// well. This is the most important persistence step for poor-signal field use:
// after the bookmarked landing page is opened once on good wifi, the SW has
// already stored the manifest + bundle the device will need on its next cold
// launch — even before the user taps "Open in Expo Go".
async function precacheExpoManifestsAndBundles() {
  const manifestCache = await caches.open(MANIFEST_CACHE);
  const bundleCache = await caches.open(BUNDLE_CACHE);

  await Promise.all(
    PRECACHE_PLATFORMS.map(async (platform) => {
      try {
        const manifestRequest = new Request("/", {
          headers: { "expo-platform": platform, accept: "application/json" },
        });
        const manifestResponse = await fetch(manifestRequest, {
          cache: "no-cache",
        });
        if (!manifestResponse || !manifestResponse.ok) return;

        // Store under both `/` and `/manifest` so subsequent fetches hit cache
        // regardless of which endpoint Expo Go calls.
        await manifestCache.put(manifestRequest, manifestResponse.clone());
        await manifestCache.put(
          new Request("/manifest", {
            headers: { "expo-platform": platform, accept: "application/json" },
          }),
          manifestResponse.clone(),
        );

        const manifest = await manifestResponse.clone().json();
        const bundleUrl =
          manifest && manifest.launchAsset && manifest.launchAsset.url;
        if (typeof bundleUrl !== "string") return;

        // Only pre-cache same-origin bundle URLs. A correctly produced manifest
        // always points at this origin; foreign hosts indicate a build hygiene
        // failure and we should not silently cache them here.
        const bundleParsed = new URL(bundleUrl, self.location.origin);
        if (bundleParsed.origin !== self.location.origin) return;

        const bundleResponse = await fetch(bundleParsed.toString(), {
          cache: "no-cache",
        });
        if (bundleResponse && bundleResponse.ok) {
          await bundleCache.put(bundleParsed.toString(), bundleResponse);
        }
      } catch (_err) {
        // Pre-caching is best-effort. A failure (offline install, transient
        // network error, etc.) must not block SW activation — the fetch
        // handlers below will populate caches lazily on next visit.
      }
    }),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL_CACHE);
      await shell.addAll(SHELL_ASSETS);
      await precacheExpoManifestsAndBundles();
      await self.skipWaiting();
    })(),
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
