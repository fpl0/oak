// Oak Service Worker (hand-written, no Workbox; architecture §6.3, promoted from spikes/s3-sounds).
// Registered in production only, as `/sw.js?pack=<packVersion>` (the pack version comes from the URL so this
// file needs no build-time templating):
//   /sounds/<packVersion>/*   CacheFirst into `oak-sounds-<packVersion>` (immutable: the version is in the path)
//   /api/*                    never intercepted
//   /dev/*                    never intercepted: the dev screens exist only with OAK_DEV (contracts §11.1 rule 7),
//                             so offline they must not fall back to the cached index (W7 gate)
//   other same-origin GET     the app shell: stale-while-revalidate into `oak-shell-v1`
// Messages (reply on event.ports[0]):
//   { type: "precache", urls: string[] }  download the whole pack for offline use ("Download all sounds")
//   { type: "warm-shell", urls: string[] } cache the shell the page already loaded (index, chunks, CSS, fonts):
//                                          the page was fetched before this worker controlled it, so without
//                                          this the first offline reload would find nothing
//   { type: "stats" }                     counters and the number of cached sound files
// Navigations that miss the cache and the network fall back to the cached index ("/"): the app is a SPA. The offline
// renderer's frame (/offline-render.html) is warmed with the shell and never falls back to the index.
const PACK_VERSION = new URL(self.location.href).searchParams.get("pack") || "v1";
const SOUNDS_PREFIX = `/sounds/${PACK_VERSION}/`;
const SOUNDS_CACHE = `oak-sounds-${PACK_VERSION}`;
const SHELL_CACHE = "oak-shell-v1";
const stats = { soundsFromCache: 0, soundsFromNetwork: 0, shellFromCache: 0, shellFromNetwork: 0, failed: 0 };

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith("oak-sounds-") && name !== SOUNDS_CACHE) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

/** Only complete, successful, same-origin responses are cached (never a 206 or an error page). */
const cacheable = (response) => response.status === 200 && response.type === "basic";

async function cacheFirst(request) {
  const cache = await caches.open(SOUNDS_CACHE);
  const hit = await cache.match(request, { ignoreSearch: true, ignoreVary: true });
  if (hit) {
    stats.soundsFromCache++;
    return hit;
  }
  const response = await fetch(request);
  if (cacheable(response)) {
    stats.soundsFromNetwork++;
    await cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(event) {
  const { request } = event;
  const cache = await caches.open(SHELL_CACHE);
  const navigate = request.mode === "navigate";
  // The offline renderer's frame (/offline-render.html, Export) is its own document: never the SPA index in its
  // place, which would load the whole app into the frame and leave Export waiting until it times out.
  const spa = navigate && new URL(request.url).pathname !== "/offline-render.html";
  const hit =
    (await cache.match(request, { ignoreSearch: navigate })) ??
    (spa ? await cache.match("/", { ignoreSearch: true }) : undefined);
  const refresh = fetch(request)
    .then(async (response) => {
      if (cacheable(response)) {
        stats.shellFromNetwork++;
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch((err) => {
      if (!hit) {
        stats.failed++;
        throw err;
      }
      return hit;
    });
  if (hit) {
    stats.shellFromCache++;
    event.waitUntil(refresh.catch(() => undefined));
    return hit;
  }
  return refresh;
}

/** `/dev`, `/dev/…` in any case or percent-encoding (the server's own reading, server/src/static.ts). */
function isDevScreen(pathname) {
  let p = pathname;
  try {
    p = decodeURIComponent(pathname);
  } catch {
    // a malformed escape: test the raw path
  }
  return /^\/dev(\/|$)/i.test(p);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never touch third-party requests
  if (url.pathname.startsWith("/api/")) return; // the API is never cached
  if (isDevScreen(url.pathname)) return; // dev screens: the network only
  if (url.pathname.startsWith(SOUNDS_PREFIX)) event.respondWith(cacheFirst(request));
  else if (url.pathname.startsWith("/sounds/"))
    return; // another pack version: straight to the network
  else event.respondWith(staleWhileRevalidate(event));
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  const reply = (payload) => event.ports[0]?.postMessage(payload);
  if (data.type === "stats") {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(SOUNDS_CACHE);
        reply({ ...stats, soundsCached: (await cache.keys()).length, cache: SOUNDS_CACHE });
      })(),
    );
  } else if (data.type === "warm-shell") {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(SHELL_CACHE);
        const listed = [];
        try {
          // The build's manifest names every chunk (lazy routes included), its CSS and its assets.
          const res = await fetch("/asset-manifest.json", { cache: "no-cache" });
          if (res.ok && (res.headers.get("content-type") || "").includes("json")) {
            for (const entry of Object.values(await res.json())) {
              if (!entry || typeof entry !== "object") continue;
              if (typeof entry.file === "string") listed.push(`/${entry.file}`);
              for (const f of [...(entry.css || []), ...(entry.assets || [])])
                if (typeof f === "string") listed.push(`/${f}`);
            }
          }
        } catch {
          // dev server or an old build: the page's own list is enough for the page itself
        }
        // The offline renderer's document (Export renders in a frame of it) is warmed with the shell, so a first
        // Export works offline too; its scripts are in the manifest.
        listed.push("/offline-render.html");
        // Oak's mark in the side bar (and the tab icon) is a public file, not in the manifest.
        listed.push("/favicon.svg");
        const urls = [...(Array.isArray(data.urls) ? data.urls : []), ...listed].filter((u) => {
          if (typeof u !== "string") return false;
          const url = new URL(u, self.location.origin);
          return (
            url.origin === self.location.origin &&
            !url.pathname.startsWith("/api/") &&
            !url.pathname.startsWith("/sounds/") &&
            !url.pathname.startsWith("/sw.js")
          );
        });
        let added = 0;
        await Promise.all(
          [...new Set(urls)].map(async (u) => {
            try {
              if (await cache.match(u)) return;
              const response = await fetch(u, { cache: "no-cache" });
              if (cacheable(response)) {
                await cache.put(u, response);
                added++;
              }
            } catch {
              stats.failed++;
            }
          }),
        );
        reply({ type: "done", added });
      })(),
    );
  } else if (data.type === "precache") {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(SOUNDS_CACHE);
        const queue = (Array.isArray(data.urls) ? data.urls : []).filter(
          (u) => typeof u === "string" && new URL(u, self.location.origin).pathname.startsWith(SOUNDS_PREFIX),
        );
        const total = queue.length;
        let added = 0;
        let bytes = 0;
        let done = 0;
        const errors = [];
        const worker = async () => {
          for (let url = queue.shift(); url !== undefined; url = queue.shift()) {
            try {
              if (!(await cache.match(url, { ignoreVary: true }))) {
                const response = await fetch(url);
                if (!cacheable(response)) throw new Error(`HTTP ${response.status}`);
                bytes += Number(response.headers.get("content-length") || 0);
                await cache.put(url, response);
                added++;
              }
            } catch (err) {
              errors.push(`${url}: ${err?.message ? err.message : err}`);
            }
            done++;
            if (event.ports[0] && done % 10 === 0)
              event.ports[0].postMessage({ type: "progress", done, total });
          }
        };
        await Promise.all([worker(), worker(), worker(), worker()]);
        reply({ type: "done", added, bytes, errors, total, soundsCached: (await cache.keys()).length });
      })(),
    );
  }
});
