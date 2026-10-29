/* Michi V9: notificaciones push, sin texto de los mensajes. */
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) {}
  const name = data.nombre === 'Michi' ? 'Michi' : 'Coquito';
  const title = name;
  const options = {
    body: 'Te envió un mensaje 💌',
    tag: 'michi-' + String(data.id || Date.now()).slice(0,60),
    data: { url: '/chat.html' },
    renotify: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL('/chat.html', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const windowClient of windows) {
      if (new URL(windowClient.url).origin === self.location.origin && 'focus' in windowClient) {
        await windowClient.navigate(target);
        return windowClient.focus();
      }
    }
    return clients.openWindow(target);
  })());
});
