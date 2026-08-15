/* Sicily Together — service worker: web push + notification clicks */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "סיציליה 2026 🍋", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag || undefined,
      dir: "rtl",
      lang: "he",
      data: { url: data.url || "/", navUrl: data.navUrl || null },
      actions: data.navUrl
        ? [{ action: "navigate", title: "נווט 🧭" }]
        : undefined,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const payload = event.notification.data || {};
  if (event.action === "navigate" && payload.navUrl) {
    event.waitUntil(self.clients.openWindow(payload.navUrl));
    return;
  }
  const url = payload.url || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => {
        for (const client of windows) {
          if ("focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      })
  );
});
