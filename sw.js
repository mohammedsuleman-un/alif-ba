const VERSION = "v1";
const CORE = [
  "./", "index.html", "style.css", "app.js", "book-data.js", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png",
  "pages/p-03.jpg",
  "pages/p-05.jpg",
  "pages/p-06.jpg",
  "pages/p-07.jpg",
  "pages/p-08.jpg",
  "pages/p-09.jpg",
  "pages/p-10.jpg",
  "pages/p-11.jpg",
  "pages/p-12.jpg",
  "pages/p-13.jpg",
  "pages/p-14.jpg",
  "pages/p-15.jpg",
  "pages/p-16.jpg",
  "pages/p-17.jpg",
  "pages/p-18.jpg",
  "pages/p-19.jpg",
  "pages/p-20.jpg",
  "pages/p-21.jpg",
  "pages/p-22.jpg",
  "pages/p-23.jpg",
  "pages/p-24.jpg",
  "pages/p-25.jpg",
  "pages/p-26.jpg",
  "pages/p-27.jpg",
  "pages/p-28.jpg",
  "pages/p-29.jpg",
  "pages/p-30.jpg",
  "pages/p-31.jpg",
  "pages/p-32.jpg",
  "pages/p-33.jpg",
  "pages/p-34.jpg",
  "pages/p-35.jpg",
  "pages/p-36.jpg",
  "pages/p-37.jpg",
  "pages/p-38.jpg",
  "pages/p-39.jpg",
  "pages/p-40.jpg",
  "pages/p-41.jpg",
  "pages/p-42.jpg",
  "pages/p-43.jpg",
  "pages/p-44.jpg",
  "pages/p-45.jpg",
  "pages/p-46.jpg",
  "pages/p-47.jpg",
  "pages/p-48.jpg",
];

// App en pagina's direct offline beschikbaar; audio wordt bewaard zodra hij één keer is afgespeeld.
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) =>
      hit ||
      fetch(e.request).then((res) => {
        if (res.ok && res.status === 200 && new URL(e.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(e.request, copy));
        }
        return res;
      })
    )
  );
});
