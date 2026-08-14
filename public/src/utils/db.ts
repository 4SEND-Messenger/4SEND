import type { Message } from '../types/message';
import { encryptValue, decryptValue, type EncryptedValue } from './crypto/encryption';
import { getCryptoKey } from './crypto/keyStore';

const DB_NAME = '4send_cache';
const DB_VERSION = 1;

interface CachedMessage extends Message {
  chatId: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains('messages')) {
        const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
        msgStore.createIndex('chatId', 'chatId', { unique: false });
      }

      if (!db.objectStoreNames.contains('pins')) {
        db.createObjectStore('pins', { keyPath: 'chatId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function isEncryptedValue(v: unknown): v is EncryptedValue {
  if (!v || typeof v !== 'object') return false;
  const obj = v as Record<string, unknown>;
  return obj.v === 2 && typeof obj.data === 'string' && typeof obj.iv === 'string' && typeof obj.aad === 'string';
}

export async function cacheMessages(chatId: string, messages: Message[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction('messages', 'readwrite');
    const store = tx.objectStore('messages');

    const index = store.index('chatId');
    const delReq = index.openCursor(IDBKeyRange.only(chatId));
    await new Promise<void>((resolve, reject) => {
      delReq.onsuccess = () => {
        const cursor = delReq.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      delReq.onerror = () => reject(delReq.error);
    });

    const key = getCryptoKey();

    const indexed: CachedMessage[] = messages.map((msg) => ({
      ...msg,
      chatId,
      id: `${chatId}_${msg.id || msg.tempId || Math.random().toString(36).slice(2)}`,
    }));

    for (const msg of indexed) {
      if (key) {
        const enc = await encryptValue(msg, key, `msg:${msg.id}`);
        store.put({ ...enc, chatId, id: msg.id });
      } else {
        store.put(msg);
      }
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch {
    // IndexedDB not available or operation failed
  }
}

export async function getCachedMessages(chatId: string): Promise<Message[] | null> {
  try {
    const db = await openDB();
    const tx = db.transaction('messages', 'readonly');
    const store = tx.objectStore('messages');
    const index = store.index('chatId');
    const request = index.getAll(chatId);

    const results = await promisifyRequest<any[]>(request);
    if (!results || results.length === 0) return null;

    const key = getCryptoKey();

    const messages: Message[] = [];
    for (const raw of results) {
      try {
        let msg: any;
        if (key && isEncryptedValue(raw)) {
          msg = await decryptValue(raw, key);
        } else {
          const { chatId: _, id: fullId, ...rest } = raw;
          const originalId = fullId.startsWith(chatId + '_') ? fullId.slice(chatId.length + 1) : fullId;
          msg = { ...rest, id: originalId };
        }
        messages.push(msg as Message);
      } catch {
        // Skip corrupted records
      }
    }

    return messages.length > 0 ? messages : null;
  } catch {
    return null;
  }
}

export async function clearCachedMessages(chatId: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction('messages', 'readwrite');
    const store = tx.objectStore('messages');
    const index = store.index('chatId');
    const request = index.openCursor(IDBKeyRange.only(chatId));

    await new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch {
  }
}

export interface PinnedMessageCache {
  id: string;
  text: string;
  chatId: string;
  mediaType?: string;
}

export async function cachePin(chatId: string, pins: Array<{ id: string; text: string; mediaType?: string }> | null): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction('pins', 'readwrite');
    const store = tx.objectStore('pins');
    const key = getCryptoKey();

    if (pins) {
      const record = { chatId, items: pins };
      if (key) {
        const enc = await encryptValue(record, key, `pins:${chatId}`);
        store.put({ ...enc, chatId });
      } else {
        store.put(record);
      }
    } else {
      store.delete(chatId);
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch {
  }
}

export async function getCachedPin(chatId: string): Promise<Array<{ id: string; text: string; mediaType?: string }> | null> {
  try {
    const db = await openDB();
    const tx = db.transaction('pins', 'readonly');
    const store = tx.objectStore('pins');
    const raw = await promisifyRequest<any>(store.get(chatId));
    if (!raw) return null;

    const key = getCryptoKey();
    if (key && isEncryptedValue(raw)) {
      const record = await decryptValue<{ chatId: string; items: Array<{ id: string; text: string; mediaType?: string }> }>(raw, key);
      return record.items || null;
    }

    return raw.items || null;
  } catch {
    return null;
  }
}
