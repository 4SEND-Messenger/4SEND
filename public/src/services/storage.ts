import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import { encryptValue, decryptValue, type EncryptedValue } from '../utils/crypto/encryption';
import { isEncryptedValue } from '../utils/crypto/encryptedStorage';
import { getCryptoKey } from '../utils/crypto/keyStore';

interface SendDBSchema extends DBSchema {
  cache: {
    key: string;
    value: unknown;
  };
}

let dbPromise: Promise<IDBPDatabase<SendDBSchema>> | null = null;

export const getDB = (): Promise<IDBPDatabase<SendDBSchema>> => {
  if (!dbPromise) {
    dbPromise = openDB<SendDBSchema>('4send_db', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache');
        }
      }
    });
  }
  return dbPromise;
};

function isEnc(v: unknown): v is EncryptedValue {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return o.v === 2 && typeof o.data === 'string' && typeof o.iv === 'string' && typeof o.aad === 'string';
}

export const idbSet = async (key: string, value: unknown): Promise<void> => {
  try {
    const db = await getDB();
    const cryptoKey = getCryptoKey();
    const tx = db.transaction('cache', 'readwrite');
    if (cryptoKey) {
      const enc = await encryptValue(value, cryptoKey, `cache:${key}`);
      tx.objectStore('cache').put(enc, key);
    } else {
      tx.objectStore('cache').put(value, key);
    }
    await tx.done;
  } catch {}
};

export const idbGet = async <T>(key: string): Promise<T | null> => {
  try {
    const db = await getDB();
    const tx = db.transaction('cache', 'readonly');
    const result = await tx.objectStore('cache').get(key);
    await tx.done;
    if (!result) return null;
    const cryptoKey = getCryptoKey();
    if (cryptoKey && isEnc(result)) {
      return decryptValue<T>(result, cryptoKey);
    }
    return result as T | null;
  } catch { return null; }
};

export const globalLocale = (): string => {
  let lang: string = 'ru';
  try {
    const raw = localStorage.getItem('4send_language');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed === 'en' || parsed === 'ru') lang = parsed;
    }
  } catch {}
  return lang === 'en' ? 'en-US' : 'ru-RU';
};

export const getLocalStorage = <T>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch { return defaultValue; }
};

export const setLocalStorage = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};

export interface StoredAccount {
  username: string;
  token: string;
  avatar?: string;
  avatarUrl?: string;
  displayName: string;
  isVerified: string;
  isActive?: boolean;
}

export const saveCurrentAccount = async (): Promise<void> => {
  const user = localStorage.getItem('4send_user');
  const token = localStorage.getItem('4send_token');
  if (!user || !token) return;

  const cryptoKey = getCryptoKey();
  const raw = localStorage.getItem('4send_accounts');
  let accounts: StoredAccount[] = [];
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (isEncryptedValue(parsed)) {
        if (cryptoKey) {
          accounts = await decryptValue<StoredAccount[]>(parsed, cryptoKey) || [];
        }
      } else if (Array.isArray(parsed)) {
        accounts = parsed;
      }
    } catch {}
  }

  const idx = accounts.findIndex(a => a.username === user);
  if (idx === -1 && !Array.isArray(accounts)) accounts = [];
  const accData: StoredAccount = {
    ...(idx > -1 ? accounts[idx] : {}),
    username: user,
    token,
    avatarUrl: localStorage.getItem('4send_avatar') || undefined,
    displayName: localStorage.getItem('4send_displayName') || '',
    isVerified: localStorage.getItem('4send_isVerified') || '0',
    isActive: true,
  };

  accounts.forEach(account => { account.isActive = false; });
  if (idx > -1) {
    accounts[idx] = accData;
  } else {
    accounts.push(accData);
  }

  if (cryptoKey) {
    const enc = await encryptValue(accounts, cryptoKey, '4send_accounts');
    localStorage.setItem('4send_accounts', JSON.stringify(enc));
  } else {
    setLocalStorage('4send_accounts', accounts);
  }
};
