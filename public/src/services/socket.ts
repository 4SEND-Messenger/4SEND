import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'https://4send-messenger.hf.space';

let socketInstance: Socket | null = null;
let pendingToken: string | null = null;

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