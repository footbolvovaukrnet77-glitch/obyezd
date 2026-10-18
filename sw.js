/* Объезд: работа без связи. Приложение и просмотренная карта хранятся в телефоне. */
const V = "obz-app-v7", TILES = "obz-tiles";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js", "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(V).then(c => Promise.allSettled(SHELL.map(u => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V && k !== TILES).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
let puts = 0;
async function prune(){
  const c = await caches.open(TILES), ks = await c.keys();
  if (ks.length > 9000) await Promise.all(ks.slice(0, 1500).map(k => c.delete(k)));
}
function isBaseTile(u){ return u.hostname === "tile.openstreetmap.org" || (u.hostname === "api.tomtom.com" && u.pathname.startsWith("/map/")); }
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const u = new URL(req.url);
  if (isBaseTile(u)){
    e.respondWith(caches.open(TILES).then(async c => {
      const hit = await c.match(req); if (hit) return hit;
      const res = await fetch(req);
      if (res.ok){ c.put(req, res.clone()); if (++puts % 200 === 0) prune(); }
      return res;
    }));
    return;
  }
  if (u.origin === location.origin){
    // своё приложение: сначала сеть (чтобы обновления приходили), без связи — из памяти
    e.respondWith(fetch(req).then(res => { if (res.ok){ const cl = res.clone(); caches.open(V).then(c => c.put(req, cl)); } return res; })
      .catch(() => caches.match(req).then(r => r || caches.match("index.html"))));
    return;
  }
  if (u.hostname === "cdnjs.cloudflare.com" || u.hostname.endsWith("gstatic.com") || u.hostname === "fonts.googleapis.com"){
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { const cl = res.clone(); caches.open(V).then(c => c.put(req, cl)); return res; })));
  }
});
