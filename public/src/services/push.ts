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

export async function initPush(): Promise<string | null> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('Notification' in window)) {
      return null;
    }
    const cfg = await loadConfig();
    if (!cfg) return null;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return null;
      const firebaseApp = getApp(cfg);
      messaging = getMessaging(firebaseApp);
      const swRegistration = await navigator.serviceWorker.ready;
      const token = await getToken(messaging, {
        vapidKey: cfg.vapidKey,
        serviceWorkerRegistration: swRegistration,
      });
      if (!token) return null;
      try {
        await fetch('/api/save-push-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(localStorage.getItem('4send_token')
              ? { Authorization: `Bearer ${localStorage.getItem('4send_token')}` }
              : {}),
          },
          body: JSON.stringify({ token }),
        });
      } catch {}
      return token;
    } catch {
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
