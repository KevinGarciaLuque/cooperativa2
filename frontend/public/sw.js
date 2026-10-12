// Service worker mínimo: permite instalar la app y abrirla aunque no haya conexión.
// Nunca guarda respuestas de la API: los datos financieros siempre vienen del servidor.
const CACHE = "cooperativa-shell-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/uploads")) return;

  // Navegación: red primero; sin conexión, se muestra la app guardada
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("/")));
    return;
  }

  // Archivos estáticos (con hash en el nombre): se sirven del caché y se actualizan
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const guardado = await cache.match(req);
      const red = fetch(req)
        .then((resp) => {
          if (resp && resp.status === 200) cache.put(req, resp.clone());
          return resp;
        })
        .catch(() => guardado);
      return guardado || red;
    })
  );
});
