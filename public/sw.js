self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {}
  const title = data.title || 'clockin'
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: data.url ? { url: data.url } : undefined,
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url || '/punch'
  event.waitUntil(clients.openWindow(url))
})
