import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';

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

export const idbSet = async (key: string, value: unknown): Promise<void> => {
  try {
    const db = await getDB();
    const tx = db.transaction('cache', 'readwrite');
    tx.objectStore('cache').put(value, key);
    await tx.done;
  } catch {}
};

export const idbGet = async <T>(key: string): Promise<T | null> => {
  try {
    const db = await getDB();
    const tx = db.transaction('cache', 'readonly');
    const result = await tx.objectStore('cache').get(key);
    await tx.done;
    return result as T | null;
  } catch { return null; }
};

export const idbDelete = async (key: string): Promise<void> => {
  try {
    const db = await getDB();
    const tx = db.transaction('cache', 'readwrite');
    tx.objectStore('cache').delete(key);
    await tx.done;
  } catch {}
};

export const idbClear = async (): Promise<void> => {
  try {
    const db = await getDB();
    const tx = db.transaction('cache', 'readwrite');
    tx.objectStore('cache').clear();
    await tx.done;
  } catch {}
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

export const removeLocalStorage = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch {}
};