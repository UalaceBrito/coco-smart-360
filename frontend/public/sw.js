const SHELL_CACHE = "coco-smart-360-shell-v1";
const DATA_CACHE = "coco-smart-360-data-v1";
const SHELL_CACHE_PREFIX = "coco-smart-360-shell-";
const NETWORK_TIMEOUT_MS = 4000;
const SHELL_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await cache.addAll(SHELL_ASSETS);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const oldShellCaches = (await caches.keys()).filter(
        (cacheName) =>
          cacheName.startsWith(SHELL_CACHE_PREFIX) &&
          cacheName !== SHELL_CACHE,
      );
      await Promise.all(oldShellCaches.map((cacheName) => caches.delete(cacheName)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/api/v1/")) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, SHELL_CACHE, "/"));
    return;
  }

  if (
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/images/") ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(networkFirst(request, SHELL_CACHE));
  }
});

async function networkFirst(request, cacheName, fallbackPath) {
  const cache = await caches.open(cacheName);
  if (self.navigator?.onLine === false) {
    const cachedResponse = await findCachedResponse(cache, request, fallbackPath);
    if (cachedResponse) return cachedResponse;
  }

  try {
    const response = await fetchWithTimeout(request);
    if (response.ok) {
      try {
        await cache.put(request, response.clone());
      } catch (error) {
        console.error("Não foi possível salvar a resposta no cache offline:", error);
      }
      return response;
    }

    if (response.status < 500) return response;
    return (await findCachedResponse(cache, request, fallbackPath)) ?? response;
  } catch (error) {
    const cachedResponse = await findCachedResponse(cache, request, fallbackPath);
    if (cachedResponse) return cachedResponse;
    throw error;
  }
}

async function findCachedResponse(cache, request, fallbackPath) {
  const cachedResponse = await cache.match(request);
  if (cachedResponse) return cachedResponse;
  if (!fallbackPath) return undefined;
  return cache.match(new URL(fallbackPath, self.location.origin).href);
}

async function fetchWithTimeout(request) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}
