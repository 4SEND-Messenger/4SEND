import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, type Messaging } from 'firebase/messaging';

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  vapidKey: string;
}

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;
let initPromise: Promise<string | null> | null = null;

async function loadConfig(): Promise<FirebaseConfig | null> {
  try {
    const res = await fetch('/api/firebase-config');
    if (!res.ok) return null;
    const cfg = await res.json();
    if (!cfg || !cfg.apiKey || !cfg.projectId) return null;
    return cfg as FirebaseConfig;
  } catch {
    return null;
  }
}

function getApp(cfg: FirebaseConfig): FirebaseApp {
  if (!app) {
    app = initializeApp({
      apiKey: cfg.apiKey,
      authDomain: cfg.authDomain,
      projectId: cfg.projectId,
      storageBucket: cfg.storageBucket,
      messagingSenderId: cfg.messagingSenderId,
      appId: cfg.appId,
    });
  }
  return app;
}

function waitForGesture(): Promise<void> {
  return new Promise(resolve => {
    const done = () => {
      window.removeEventListener('pointerdown', done);
      window.removeEventListener('keydown', done);
      window.removeEventListener('click', done);
      resolve();
    };
    window.addEventListener('pointerdown', done, { once: true });
    window.addEventListener('keydown', done, { once: true });
    window.addEventListener('click', done, { once: true });
  });
}

async function ensurePermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  // Chrome может молча отклонить prompt, вызванный без жеста пользователя,
  // поэтому ждём первый клик/клавишу и только потом запрашиваем разрешение.
  // Для 'denied' тоже делаем повторную попытку: старое отклонение могло
  // произойти без жеста, а явный отказ пользователя requestPermission вернёт мгновенно.
  await waitForGesture();
  try {
    const result = await Notification.requestPermission();
    console.log('[push] requestPermission ->', result, 'state now:', Notification.permission);
    return result === 'granted';
  } catch (err) {
    console.log('[push] requestPermission threw:', err);
    return false;
  }
}

export async function initPush(): Promise<string | null> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('Notification' in window)) {
      return null;
    }
    const cfg = await loadConfig();
    if (!cfg) return null;
    try {
      const granted = await ensurePermission();
      if (!granted) return null;
      const firebaseApp = getApp(cfg);
      messaging = getMessaging(firebaseApp);
      const swRegistration = await navigator.serviceWorker.ready;
      console.log('[push] sw ready:', swRegistration.active && swRegistration.active.scriptURL);
      const token = await getToken(messaging, {
        vapidKey: cfg.vapidKey,
        serviceWorkerRegistration: swRegistration,
      });
      console.log('[push] getToken ->', token ? 'ok' : 'null');
      if (!token) return null;
      try {
        const res = await fetch('/api/save-push-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(localStorage.getItem('4send_token')
              ? { Authorization: `Bearer ${localStorage.getItem('4send_token')}` }
              : {}),
          },
          body: JSON.stringify({ token }),
        });
        if (!res.ok) console.warn('[push] save-push-token failed with', res.status);
      } catch {}
      return token;
    } catch (err) {
      console.warn('[push] init failed:', err);
      return null;
    }
  })();
  return initPromise;
}

export async function clearPushToken(): Promise<void> {
  try {
    await fetch('/api/save-push-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(localStorage.getItem('4send_token')
          ? { Authorization: `Bearer ${localStorage.getItem('4send_token')}` }
          : {}),
      },
      body: JSON.stringify({ token: '' }),
    });
  } catch {}
}
