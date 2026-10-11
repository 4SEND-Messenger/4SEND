import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'https://4send-messenger.hf.space';

let socketInstance: Socket | null = null;
let pendingToken: string | null = null;

const dispatchSessionExpired = () => {
  window.dispatchEvent(new CustomEvent('4send:session-expired'));
};

const isAuthErrorMessage = (message?: string) =>
  /Authentication error|Banned/i.test(String(message || ''));

export const getSocket = (): Socket => {
  if (!socketInstance) {
    const raw = localStorage.getItem('4send_language') || 'en';
    const lang = (() => { try { return JSON.parse(raw); } catch { return raw; } })();
    socketInstance = io(SOCKET_URL, {
      auth: { token: pendingToken },
      query: { lang },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    socketInstance.on('session_revoked', () => dispatchSessionExpired());

    socketInstance.on('connect_error', (err) => {
      if (!isAuthErrorMessage(err?.message)) return;
      if (!pendingToken) return;
      void (async () => {
        try {
          const { resolveToken } = await import('./api');
          const current = await resolveToken();
          if (current && current === pendingToken) dispatchSessionExpired();
        } catch { /* ignore */ }
      })();
    });

    void (async () => {
      try {
        const { resolveToken } = await import('./api');
        const token = await resolveToken();
        if (token !== pendingToken) {
          pendingToken = token;
          if (socketInstance) {
            socketInstance.auth = { token };
            if (!socketInstance.connected) socketInstance.connect();
          }
        }
      } catch { /* ignore */ }
    })();
  }
  return socketInstance;
};

export const updateSocketToken = async (): Promise<void> => {
  const { resolveToken } = await import('./api');
  pendingToken = await resolveToken();
  if (socketInstance) {
    socketInstance.auth = { token: pendingToken };
    if (socketInstance.connected) {
      socketInstance.disconnect().connect();
    }
  }
};
