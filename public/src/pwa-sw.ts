/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
  ({ url }) => url.origin === 'https://res.cloudinary.com',
  new CacheFirst({
    cacheName: 'cloudinary-images',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
    ],
  })
);

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === 'POST' && url.pathname === '/share-target') {
    event.respondWith(handleShareTarget(event.request));
  }
});

async function handleShareTarget(request: Request): Promise<Response> {
  try {
    const formData = await request.formData();
    const file = formData.get('media') as File | null;
    if (file) {
      const cache = await caches.open('shared-files');
      const blob = await file.arrayBuffer();
      await cache.put('shared-file', new Response(blob, {
        headers: {
          'Content-Type': file.type,
          'X-File-Name': encodeURIComponent(file.name),
          'X-File-Size': String(file.size),
        },
      }));
    }
  } catch {}
  return Response.redirect('/', 303);
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

interface PushData {
  notification?: { title?: string; body?: string; icon?: string; click_action?: string };
  data?: { click_action?: string; url?: string };
  title?: string;
  body?: string;
  icon?: string;
  click_action?: string;
}

self.addEventListener('push', (event: PushEvent) => {
  let data: PushData = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: '4SEND', body: event.data ? event.data.text() : '' };
  }
  const notification = data.notification || data;
  const title = notification.title || data.title || '4SEND';
  const body = notification.body || data.body || '';
  const icon = notification.icon || '/ico.png';
  const clickAction = notification.click_action || data.data?.click_action || data.data?.url || '/';
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      data: { url: clickAction },
      tag: '4send-notification',
    })
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.focused) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clientList.length > 0) {
        return clientList[0].navigate(url).then((c) => c && c.focus());
      }
      return self.clients.openWindow(url);
    })
  );
});
