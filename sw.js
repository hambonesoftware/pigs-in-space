/* Offline shell for GitHub Pages. Bump version when the shell changes. */
const VERSION = "pigs-cosmic-v1";
const SHELL = ["./", "./index.html", "./styles.css", "./game.js", "./manifest.webmanifest", "./icon.svg", "./apple-icon.svg"];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(request).then((response) => {
      if (response.ok && new URL(request.url).pathname.startsWith(new URL(self.registration.scope).pathname)) {
        const copy = response.clone();
        caches.open(VERSION).then((cache) => cache.put(request, copy)).catch(() => {});
      }
      return response;
    }).catch(() => caches.match(request).then((cached) => cached || caches.match("./index.html")))
  );
});