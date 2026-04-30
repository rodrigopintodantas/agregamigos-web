/* Service Worker — notificações push (convocação). */
self.addEventListener("push", (event) => {
  let data = { title: "Convocação", body: "Você tem uma nova notificação." };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (_) {
    const t = event.data && event.data.text();
    if (t) {
      data = { title: "Convocação", body: t };
    }
  }
  const title = data.title || "Convocação";
  const options = {
    body: data.body || "",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    data: data.data || {},
    tag: data.data && data.data.partidaId ? `convocacao-${data.data.partidaId}` : "convocacao",
    renotify: true,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      if (clientList.length) {
        return clientList[0].focus();
      }
      return self.clients.openWindow("/");
    }),
  );
});
