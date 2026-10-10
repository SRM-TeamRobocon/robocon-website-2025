// Dashboard service worker for PWA installability and attendance push. It does
// no caching: dashboard data (attendance, CMS, approvals) is live and must never
// be served stale.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Lab attendance", body: event.data?.text() || "Your attendance tap was recorded." };
  }

  event.waitUntil(self.registration.showNotification(payload.title || "Lab attendance", {
    body: payload.body || "Your attendance tap was recorded.",
    icon: payload.icon || "/icons/icon-192.png",
    badge: payload.badge || "/icons/icon-monochrome-192.png",
    tag: payload.tag || `lab-attendance-${Date.now()}`,
    data: { url: payload.url || "/dashboard/attendance" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = new URL(event.notification.data?.url || "/dashboard/attendance", self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(self.location.origin) && "focus" in client) {
        await client.focus();
        if ("navigate" in client && client.url !== destination) await client.navigate(destination);
        return;
      }
    }
    await self.clients.openWindow(destination);
  })());
});
