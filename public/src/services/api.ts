import { getCryptoKey } from '../utils/crypto/keyStore';
import type { EncryptedValue } from '../utils/crypto/encryption';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

let cachedRaw: string | null = null;
let cachedDecrypted: string | null = null;

const parseLang = (fallback: string): string => {
  const raw = localStorage.getItem('4send_language') || fallback;
  try { return JSON.parse(raw); } catch { return raw; }
};

function isEncryptedValue(v: unknown): v is EncryptedValue {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return o.v === 2 && typeof o.data === 'string' && typeof o.iv === 'string' && typeof o.aad === 'string';
}

export async function resolveToken(): Promise<string | null> {
  const raw = localStorage.getItem('4send_token');
  if (!raw) {
    cachedDecrypted = null;
    cachedRaw = null;
    return null;
  }
  if (raw === cachedRaw && cachedDecrypted !== null) {
    try {
      const parsed = JSON.parse(raw);
      if (isEncryptedValue(parsed) && !getCryptoKey()) {
        cachedDecrypted = null;
        return null;
      }
    } catch {}
    return cachedDecrypted;
  }

  cachedRaw = raw;
  try {
    const parsed = JSON.parse(raw);
    if (isEncryptedValue(parsed)) {
      const cryptoKey = getCryptoKey();
      if (cryptoKey) {
        const { decrypt } = await import('../utils/crypto/encryption');
        cachedDecrypted = await decrypt(parsed, cryptoKey);
        return cachedDecrypted;
      }
      cachedDecrypted = null;
      return null;
    }
  } catch {}
  cachedDecrypted = raw;
  return raw;
}

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const token = await resolveToken();
  return {
    'Content-Type': 'application/json',
    'X-Language': parseLang('ru'),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

async function handleResponse<T>(r: Response): Promise<T> {
  if (!r.ok) {
    const text = await r.text();
    let body: Record<string, unknown>;
    try { body = JSON.parse(text); } catch { body = { error: text }; }
    if (r.status === 401 && (body.error === 'Session expired' || body.error === 'Unauthorized')) {
      window.dispatchEvent(new CustomEvent('4send:session-expired'));
    }
    throw body;
  }
  return r.json();
}

export const api = {
  get: async <T>(url: string) => fetch(`${API_BASE}${url}`, { headers: await getAuthHeaders() }).then(r => handleResponse<T>(r)),
  post: async <T>(url: string, body: unknown) => fetch(`${API_BASE}${url}`, { method: 'POST', headers: await getAuthHeaders(), body: JSON.stringify(body) }).then(r => handleResponse<T>(r)),
  upload: async (url: string, formData: FormData) => {
    const token = await resolveToken();
    const headers: Record<string, string> = { 'X-Language': parseLang('ru') };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(`${API_BASE}${url}`, { method: 'POST', headers, body: formData }).then(r => handleResponse(r));
  },
};