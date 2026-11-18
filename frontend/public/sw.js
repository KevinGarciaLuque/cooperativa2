// Service worker mínimo: permite instalar la app y abrirla aunque no haya conexión.
// Nunca guarda respuestas de la API: los datos financieros siempre vienen del servidor.
const CACHE = "cooperativa-shell-v3";

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
  // El número de versión siempre se pide al servidor (así se detectan las publicaciones nuevas)
  if (url.pathname === "/version.json" || url.pathname === "/sw.js") return;

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

// Notificaciones en el teléfono (app del socio): pagos, cuotas por vencer, préstamos
self.addEventListener("push", (event) => {
  let datos = {};
  try {
    datos = event.data ? event.data.json() : {};
  } catch {
    datos = { titulo: event.data ? event.data.text() : "" };
  }
  const titulo = datos.titulo || "Cooperativa";
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: datos.cuerpo || "",
      icon: "/pwa-192.png",
      badge: "/pwa-192.png",
      tag: datos.etiqueta || undefined,
      data: { url: datos.url || "/perfil" },
    })
  );
});

// Al tocar la notificación se abre (o se enfoca) la app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/perfil";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
      const abierta = ventanas.find((v) => new URL(v.url).origin === self.location.origin);
      if (abierta) {
        abierta.focus();
        return abierta.navigate ? abierta.navigate(url) : null;
      }
      return self.clients.openWindow(url);
    })
  );
});
