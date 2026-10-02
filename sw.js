/* The build replaces this manifest after every game asset has been versioned. */
const OFFLINE_RELEASE = __PE_OFFLINE_RELEASE__;
const CACHE_PREFIX = "papers-empire-shell-";
const CACHE_NAME = CACHE_PREFIX + OFFLINE_RELEASE.version;
const STATE_KEY = "/__pe-offline-state";
const SHELL_PATHS = new Set(OFFLINE_RELEASE.routes);
const ENTRY_BY_PATH = new Map(OFFLINE_RELEASE.entries.map(entry => [new URL(entry.url, self.location.origin).pathname, entry.url]));

function cacheKey(request) {
  const url = new URL(request.url);
  if (request.mode === "navigate" && SHELL_PATHS.has(url.pathname)) return url.pathname;
  const known = ENTRY_BY_PATH.get(url.pathname);
  if (!known) return null;
  const versions = url.searchParams.getAll("v");
  if (!url.search || (versions.length === 1 && versions[0] === OFFLINE_RELEASE.stamp && [...url.searchParams.keys()].length === 1)) return known;
  return null;
}

async function digest(response) {
  const bytes = await response.clone().arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function activeCacheState() {
  for (const name of await caches.keys()) {
    if (!name.startsWith(CACHE_PREFIX)) continue;
    const marker = await (await caches.open(name)).match(STATE_KEY);
    if (marker) return { name, previous: (await marker.json()).previous || null };
  }
  return null;
}

async function populateCache() {
    const existed = (await caches.keys()).includes(CACHE_NAME);
    const cache = await caches.open(CACHE_NAME);
    try {
      // A deployment racing this download cannot produce a mixed offline release.
      // Only a fully fetched, byte-verified set can finish installation.
      const pending = OFFLINE_RELEASE.entries.slice();
      const results = await Promise.allSettled(Array.from({ length: 6 }, async () => {
        while (pending.length) {
          const entry = pending.shift();
          const response = await fetch(new Request(entry.url, { cache: "reload", credentials: "omit", redirect: "error" }));
          if (!response.ok || response.type === "opaque" || await digest(response) !== entry.sha256) {
            throw new Error("Offline asset did not match this release: " + entry.url);
          }
          await cache.put(entry.url, response);
        }
      }));
      const failure = results.find(result => result.status === "rejected");
      if (failure) throw failure.reason;
      const active = await activeCacheState();
      const retained = new Set([CACHE_NAME, active?.name, active?.previous]);
      // A declined update can be replaced by another waiting version without
      // retaining every unused download. At most one pending cache survives.
      await Promise.all((await caches.keys()).filter(name => name.startsWith(CACHE_PREFIX) && !retained.has(name))
        .map(name => caches.delete(name)));
    } catch (error) {
      // Never discard an already verified rollback release on a failed refresh.
      if (!existed) await caches.delete(CACHE_NAME);
      throw error;
    }
}

self.addEventListener("install", event => {
  // A replacement worker stays waiting while a game is open. skipWaiting is
  // available only through the explicit update action below.
  event.waitUntil(populateCache());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const active = await activeCacheState();
    const names = (await caches.keys()).filter(name => name.startsWith(CACHE_PREFIX));
    const previous = active?.name === CACHE_NAME ? active.previous : active?.name;
    // Retain one prior complete release for open tabs and a deployment rollback.
    // The bound is two caches, regardless of how often the game is updated.
    await Promise.all(names.filter(name => name !== CACHE_NAME && name !== previous).map(name => caches.delete(name)));
    if (previous) await (await caches.open(previous)).delete(STATE_KEY);
    await (await caches.open(CACHE_NAME)).put(STATE_KEY, new Response(JSON.stringify({ previous: previous || null })));
    await self.clients.claim();
  })());
});

self.addEventListener("message", event => {
  if (event.data?.type === "PE_REPAIR_OFFLINE_CACHE") {
    event.waitUntil(populateCache().then(
      () => event.ports?.[0]?.postMessage({ ready: true }),
      () => event.ports?.[0]?.postMessage({ ready: false })
    ));
  }
  if (event.data?.type === "PE_APPLY_OFFLINE_UPDATE") {
    event.waitUntil(self.skipWaiting());
  }
  if (event.data?.type === "PE_OFFLINE_STATUS") {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE_NAME);
      const ready = (await cache.keys()).filter(request => new URL(request.url).pathname !== STATE_KEY).length === OFFLINE_RELEASE.entries.length;
      event.ports?.[0]?.postMessage({ version: OFFLINE_RELEASE.version, entries: OFFLINE_RELEASE.entries.length, ready });
    })());
  }
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  // APIs, documentation, guides, save files and other requests never enter cache.
  const isShell = request.mode === "navigate" && SHELL_PATHS.has(url.pathname);
  const isAsset = url.pathname.startsWith("/assets/") && !url.pathname.includes("/sources/");
  const isManifest = /^\/site(?:\.(?:en|de|lb))?\.webmanifest$/.test(url.pathname);
  if (!isShell && !isAsset && !isManifest) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const key = cacheKey(request);
    const cached = key ? await cache.match(key) : await cache.match(request);
    if (cached) return cached;
    // A still-open tab can ask for lazy assets from the preceding release.
    if (!isShell) {
      const marker = await cache.match(STATE_KEY);
      const previous = marker ? (await marker.json()).previous : null;
      if (previous) {
        const previousHit = await (await caches.open(previous)).match(request);
        if (previousHit) return previousHit;
      }
    }
    // No runtime cache.put: unlisted URLs and personal data can never accumulate.
    return fetch(request);
  })());
});
