// Michi V9.2 - Activar inmediatamente las actualizaciones del receptor push.
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

/* Michi V9: notificaciones push, sin texto de los mensajes. */
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) {}
  const name = data.nombre === 'Michi' ? 'Michi' : 'Coquito';
  const title = name;
  const incomingCall = data.tipo === 'llamada';
  const options = {
    body: incomingCall ? (data.modo === 'video' ? '📹 Videollamada entrante. Toca para contestar.' : '📞 Llamada entrante. Toca para contestar.') : 'Te envió un mensaje 💌',
    tag: (incomingCall ? 'michi-llamada-' : 'michi-') + String(data.id || Date.now()).slice(0,60),
    data: { url: '/chat.html' },
    renotify: incomingCall,
    requireInteraction: incomingCall,
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
