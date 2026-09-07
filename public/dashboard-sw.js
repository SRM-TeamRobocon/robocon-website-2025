// Minimal service worker scoped to /dashboard - exists only to satisfy the
// installability checks Chromium browsers use before firing beforeinstallprompt.
// Deliberately does no caching: dashboard data (attendance, CMS, approvals) is
// live and must never be served stale.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
