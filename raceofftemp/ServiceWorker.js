/* Unity WebGL Service Worker
 * SAFE version:
 * - Caches ONLY GET requests
 * - Caches ONLY same-origin files
 * - Never touches POST / analytics / ads
 */

const cacheVersion = "1.1.11595";
const cacheName = `madkidgames.com-Hot Wheels Race Off-v${cacheVersion}`;

const contentToCache = [
    "Build/7a2dbded24d57e056180125b1583e7c4.loader.js",
    "Build/cb68df8b6138accfef441a97d929e28f.framework.js.br",
    "Build/7aa58569a745d3a7067e52af05e7fb6f.data.br",
    "Build/78a19b693935f3d4c4d402beb26482fe.wasm.br",
    "TemplateData/style.css",
    "thumb_2.jpg"
];

// --------------------------------------------------
// INSTALL
// --------------------------------------------------
self.addEventListener("install", (event) => {
    console.log("[ServiceWorker] Install");
    self.skipWaiting();

    event.waitUntil(
        caches.open(cacheName).then((cache) => {
            console.log("[ServiceWorker] Caching app shell");
            return cache.addAll(contentToCache);
        })
    );
});

// --------------------------------------------------
// ACTIVATE
// --------------------------------------------------
self.addEventListener("activate", (event) => {
    console.log("[ServiceWorker] Activate");
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.map((key) => {
                    if (key !== cacheName) {
                        console.log("[ServiceWorker] Deleting old cache:", key);
                        return caches.delete(key);
                    }
                })
            )
        ).then(() => self.clients.claim())
    );
});

// --------------------------------------------------
// FETCH (CRITICAL FIX HERE)
// --------------------------------------------------
self.addEventListener("fetch", (event) => {

    // ✅ ONLY cache GET requests
    if (event.request.method !== "GET") {
        return;
    }

    // ✅ Ignore cross-origin requests (ads, analytics, Unity telemetry)
    const requestURL = new URL(event.request.url);
    if (requestURL.origin !== self.location.origin) {
        return;
    }

    event.respondWith(
        (async () => {
            try {
                // Try cache first
                const cachedResponse = await caches.match(event.request);
                if (cachedResponse) {
                    return cachedResponse;
                }

                // Fetch from network
                const networkResponse = await fetch(event.request);

                // Cache successful responses only
                if (networkResponse && networkResponse.status === 200) {
                    const cache = await caches.open(cacheName);
                    await cache.put(event.request, networkResponse.clone());
                }

                return networkResponse;
            } catch (err) {
                console.error("[ServiceWorker] Fetch failed:", event.request.url, err);
                return new Response("Offline", {
                    status: 503,
                    statusText: "Service Unavailable"
                });
            }
        })()
    );
});
