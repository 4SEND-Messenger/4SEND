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
  data?: Record<string, unknown> | string;
  title?: string;
  body?: string;
  icon?: string;
  click_action?: string;
}

async function setWorkerBadge(count: number): Promise<void> {
  try {
    const nav = self.navigator as unknown as {
      setAppBadge?: (contents?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (typeof nav.setAppBadge !== 'function') return;
    if (count > 0) await nav.setAppBadge(count);
    else await nav.clearAppBadge?.();
  } catch {}
}

self.addEventListener('push', (event: PushEvent) => {
  let payload: PushData = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: '4SEND', body: event.data ? event.data.text() : '' };
  }
  let nested: Record<string, any> = {};
  if (typeof payload.data === 'string') {
    try { nested = JSON.parse(payload.data); } catch { nested = {}; }
  } else if (payload.data && typeof payload.data === 'object') {
    nested = payload.data as Record<string, any>;
  }
  const n: Record<string, any> = payload.notification ||
    (typeof nested.notification === 'object' && nested.notification ? nested.notification : {});
  const pick = (...vals: unknown[]) => vals.find(v => typeof v === 'string' && v);
  const title = String(pick(n.title, payload.title, nested.title, nested['gcm.n.title'], '4SEND'));
  const body = String(pick(n.body, payload.body, nested.body, nested['gcm.n.body'], nested.message, '') || '');
  const icon = String(pick(n.icon, payload.icon, nested['gcm.n.icon'], '/ico.png'));
  const clickUrl = String(pick(nested.click_action, nested.url, payload.click_action, '/'));
  const chatId = typeof nested.chatId === 'string' && nested.chatId ? nested.chatId : undefined;
  const tag = chatId ? `4send-chat-${chatId.toLowerCase()}` : '4send-notification';
  event.waitUntil((async () => {
    await self.registration.showNotification(title, {
      body,
      icon,
      badge: '/ico.png',
      data: { url: clickUrl, chatId },
      tag,
    });
    if (nested.unread !== undefined) {
      const num = Number(nested.unread);
      if (Number.isFinite(num)) await setWorkerBadge(num);
    }
  })());
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
