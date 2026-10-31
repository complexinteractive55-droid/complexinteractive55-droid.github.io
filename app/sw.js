// Service worker de Complex_: guarda la app para abrirla rápido y sin internet.
// Los datos (Supabase) siempre van a la red.
const VERSION = 'complexapp-20261031084032';
// Solo se borran las versiones viejas de ESTA app: en fabiandres55.github.io viven también Relax y Complex_ (app2),
// y la caché del navegador es una sola por dominio (antes se borraba todo lo que no fuera esta versión).
const PREFIJO = VERSION.replace(/[^-]+$/, '');
const ARCHIVOS = [
  './', './index.html', './estilos.css', './estilos-rea.css', './manifest.webmanifest', './img/icono.svg', './img/simbolo.svg', './img/logo-complex.svg',
  './vendor/supabase-2.117.3.js', './js/app.js', './js/config.js', './js/db.js', './js/demo-semilla.js', './js/ui.js', './js/estado.js', './js/calculos.js',
  './js/pantallas/comun.js', './js/pantallas/admin.js', './js/pantallas/profesor.js', './js/pantallas/planilla.js', './js/pantallas/boletin_docente.js', './js/pantallas/notas_util.js', './js/pantallas/destinos.js', './js/pantallas/seguimientos.js', './js/pantallas/docencia.js', './js/pantallas/familia_perfil.js', './js/pantallas/familia.js', './js/pantallas/circulares.js', './js/pantallas/circular_institucional.js', './js/circular_contenido.js', './js/pantallas/espacios.js', './js/espacios_reglas.js', './js/pantallas/pqrs.js', './js/pqrs_reglas.js', './js/pqrs_demo.js', './js/pqrs_archivos.js', './js/pqrs_firma.js', './js/calendario_importar.js', './js/calendario_demo.js', './js/circulares_demo.js', './js/pantallas/planeaciones.js', './js/pantallas/mensajeria.js', './js/pantallas/aula.js', './js/pantallas/calendario.js', './js/pantallas/tesoreria.js', './js/pantallas/comunidad.js', './js/pantallas/procesos.js', './js/pantallas/tablero.js', './js/pantallas/certificados.js', './js/pantallas/usuarios.js', './js/pantallas/horario.js', './js/pantallas/reportes.js', './js/pantallas/examenes.js', './js/pantallas/ayuda.js', './js/pantallas/carnet.js',
  './js/pantallas/enfermeria.js', './js/pantallas/compromisos.js', './js/pantallas/casos.js', './js/pantallas/plantillas.js', './js/pantallas/docente.js',
  './js/i18n.js', './js/i18n/en1.js', './js/i18n/en2.js', './js/i18n/en3.js', './js/i18n/en4.js',
];

self.addEventListener('install', (e) => {
  // cache: 'reload': bajar los archivos frescos del servidor, no la copia de 10 min del navegador (GitHub Pages: max-age=600)
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith(PREFIJO) && k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Avisos del sistema (Web Push), PREPARADO (29-oct-2026): no hace nada hasta que una persona active los avisos en su
// dispositivo y el colegio conecte el envío (fase 2). Siempre muestra un aviso genérico (sin datos del caso: se ve en la
// pantalla bloqueada) y, al tocarlo, abre la ruta DENTRO de la app, que pide sesión y revisa permisos como siempre.
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch {}
  const ruta = typeof d.ruta === 'string' && /^#\/[a-z0-9/?=&_-]+$/.test(d.ruta) ? d.ruta : '#/inicio';
  e.waitUntil(self.registration.showNotification(String(d.titulo || 'Novedad en Complex_').slice(0, 80), {
    body: 'Abre Complex_ para verla.', tag: String(d.etiqueta || 'complex').slice(0, 64), data: { ruta }, icon: './img/icono.svg', badge: './img/simbolo.svg',
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const destino = new URL('./' + (e.notification.data?.ruta || '#/inicio'), self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
    const abierta = ventanas.find((v) => v.url.startsWith(self.registration.scope));
    if (abierta) { abierta.navigate(destino).catch(() => {}); return abierta.focus(); }
    return self.clients.openWindow(destino);
  }));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Red primero (para tener siempre lo último); si no hay internet, lo guardado.
  // cache: 'no-cache' revalida con el servidor (304 si no cambió): sin esto, tras publicar se seguían viendo archivos viejos hasta 10 min.
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then((r) => {
      const copia = r.clone();
      caches.open(VERSION).then((c) => c.put(e.request, copia));
      return r;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});
