// Web Push handlers, pulled into the generated service worker via
// workbox.importScripts (vite.config.ts). Plain JS on purpose: it runs in
// the SW global scope, outside the app bundle.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  // iOS revokes push permission if a push doesn't result in a visible
  // notification, so always show one — even for an unreadable payload.
  event.waitUntil(
    self.registration.showNotification(data.title || "Shift", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const requested = event.notification.data && event.notification.data.url;
  // Same-origin paths only; anything else falls back to the staff home.
  const url = typeof requested === "string" && requested.startsWith("/") && !requested.startsWith("//") ? requested : "/staff-home";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ("focus" in client) {
          if ("navigate" in client) client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
