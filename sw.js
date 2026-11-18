// Lifeboard service worker: lets Chrome install the app, and keeps the app's own files so it still opens
// without internet (your data still needs a connection). It always tries the network first, so updates show
// up right away; the saved copy is only used when the network fails. Supabase and other sites are not touched.
const CACHE = "lifeboard-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
      return res;
    } catch (err) {
      const saved = await caches.match(req, { ignoreSearch: req.mode === "navigate" });
      if (saved) return saved;
      throw err;
    }
  })());
});
