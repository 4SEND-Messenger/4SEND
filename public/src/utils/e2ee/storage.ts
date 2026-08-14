import type { IdentityKeyPair, SignedPreKey, OneTimePreKey, SessionState } from './types';
import { encryptValue, decryptValue, type EncryptedValue } from '../crypto/encryption';
import { getCryptoKey } from '../crypto/keyStore';

const DB_NAME = '4send_e2ee';
const DB_VERSION = 1;

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

      if (!db.objectStoreNames.contains('identity')) {
        db.createObjectStore('identity', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('signedPreKey')) {
        db.createObjectStore('signedPreKey', { keyPath: 'keyId' });
      }
      if (!db.objectStoreNames.contains('oneTimePreKeys')) {
        const store = db.createObjectStore('oneTimePreKeys', { keyPath: 'keyId' });
        store.createIndex('used', 'used', { unique: false });
      }
      if (!db.objectStoreNames.contains('sessions')) {
        const store = db.createObjectStore('sessions', { keyPath: 'contactUsername' });
        store.createIndex('lastActive', 'lastActive', { unique: false });
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

function waitForTx(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function toArray(data: Uint8Array): ArrayBuffer {
  return new Uint8Array(data).buffer as ArrayBuffer;
}

function fromArray(buf: ArrayBuffer): Uint8Array {
  return new Uint8Array(buf);
}

export function toBase64(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data));
}

export function fromBase64(s: string): Uint8Array {
  const standard = s.replace(/-/g, '+').replace(/_/g, '/');
  const padded = standard.padEnd(Math.ceil(standard.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

function isEnc(v: unknown): v is EncryptedValue {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return o.v === 2 && typeof o.data === 'string' && typeof o.iv === 'string' && typeof o.aad === 'string';
}

interface EncEnvelope {
  _enc: EncryptedValue;
  [key: string]: unknown;
}

function isEnvelope(v: unknown): v is EncEnvelope {
  return !!v && typeof v === 'object' && isEnc((v as Record<string, unknown>)._enc);
}

async function encStorePut(store: IDBObjectStore, record: Record<string, unknown>, keyField: string, storeName: string) {
  const key = getCryptoKey();
  const keyVal = record[keyField];
  if (key) {
    const enc = await encryptValue(record, key, `${storeName}:${keyVal}`);
    store.put({ [keyField]: keyVal, _enc: enc });
  } else {
    store.put(record);
  }
}

async function encStoreGet<T>(raw: any, keyField: string): Promise<T | null> {
  if (!raw) return null;
  const key = getCryptoKey();
  if (key && isEnvelope(raw)) {
    return decryptValue<T>(raw._enc, key);
  }
  return raw as T;
}

async function encStoreGetAll<T>(raws: any[], keyField: string): Promise<T[]> {
  const key = getCryptoKey();
  const results: T[] = [];
  for (const raw of raws) {
    try {
      if (key && isEnvelope(raw)) {
        results.push(await decryptValue<T>(raw._enc, key));
      } else {
        results.push(raw as T);
      }
    } catch {
      // Skip corrupted
    }
  }
  return results;
}

export async function getIdentity(): Promise<IdentityKeyPair | null> {
  try {
    const db = await openDB();
    const tx = db.transaction('identity', 'readonly');
    const store = tx.objectStore('identity');
    const result = await new Promise<any>((resolve, reject) => {
      const req = store.get('default');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const data = await encStoreGet<any>(result, 'key');
    if (!data) return null;
    return {
      publicKey: fromArray(data.publicKey),
      privateKey: fromArray(data.privateKey),
      signingPublicKey: data.signingPublicKey ? fromArray(data.signingPublicKey) : new Uint8Array(0),
      signingPrivateKey: data.signingPrivateKey ? fromArray(data.signingPrivateKey) : new Uint8Array(0),
    };
  } catch { return null; }
}

export async function saveIdentity(keyPair: IdentityKeyPair): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('identity', 'readwrite');
  const store = tx.objectStore('identity');
  const record = {
    key: 'default',
    publicKey: toArray(keyPair.publicKey),
    privateKey: toArray(keyPair.privateKey),
    signingPublicKey: toArray(keyPair.signingPublicKey),
    signingPrivateKey: toArray(keyPair.signingPrivateKey),
    createdAt: Date.now(),
  };
  await encStorePut(store, record, 'key', 'identity');
  await waitForTx(tx);
}

export async function getSignedPreKey(): Promise<SignedPreKey | null> {
  try {
    const db = await openDB();
    const tx = db.transaction('signedPreKey', 'readonly');
    const store = tx.objectStore('signedPreKey');
    const results = await new Promise<any[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (!results || results.length === 0) return null;
    const decrypted = await encStoreGetAll<any>(results, 'keyId');
    const keys = decrypted.sort((a: any, b: any) => b.keyId - a.keyId);
    return {
      keyId: keys[0].keyId,
      publicKey: fromArray(keys[0].publicKey),
      privateKey: fromArray(keys[0].privateKey),
      signature: fromArray(keys[0].signature),
      createdAt: keys[0].createdAt,
    };
  } catch { return null; }
}

export async function saveSignedPreKey(key: SignedPreKey): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('signedPreKey', 'readwrite');
  const store = tx.objectStore('signedPreKey');
  const record = {
    keyId: key.keyId,
    publicKey: toArray(key.publicKey),
    privateKey: toArray(key.privateKey),
    signature: toArray(key.signature),
    createdAt: key.createdAt,
  };
  await encStorePut(store, record, 'keyId', 'signedPreKey');
  await waitForTx(tx);
}

export async function getOneTimePreKeys(): Promise<OneTimePreKey[]> {
  try {
    const db = await openDB();
    const tx = db.transaction('oneTimePreKeys', 'readonly');
    const store = tx.objectStore('oneTimePreKeys');
    const results = await new Promise<any[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (!results) return [];
    return encStoreGetAll<any>(results, 'keyId').then(keys =>
      keys.map(r => ({
        keyId: r.keyId,
        publicKey: fromArray(r.publicKey),
        privateKey: fromArray(r.privateKey),
        used: r.used,
      }))
    );
  } catch { return []; }
}

export async function getUnusedOneTimePreKeys(): Promise<OneTimePreKey[]> {
  const all = await getOneTimePreKeys();
  return all.filter(k => !k.used);
}

export async function saveOneTimePreKeys(keys: OneTimePreKey[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('oneTimePreKeys', 'readwrite');
  const store = tx.objectStore('oneTimePreKeys');
  for (const key of keys) {
    const record = {
      keyId: key.keyId,
      publicKey: toArray(key.publicKey),
      privateKey: toArray(key.privateKey),
      used: key.used,
    };
    await encStorePut(store, record, 'keyId', 'oneTimePreKeys');
  }
  await waitForTx(tx);
}

export async function markOneTimePreKeyUsed(keyId: number): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('oneTimePreKeys', 'readwrite');
  const store = tx.objectStore('oneTimePreKeys');
  const existing = await new Promise<any>((resolve, reject) => {
    const req = store.get(keyId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  if (existing) {
    const key = getCryptoKey();
    if (key && isEnvelope(existing)) {
      const decrypted = await decryptValue<any>(existing._enc, key);
      decrypted.used = true;
      const enc = await encryptValue(decrypted, key, `oneTimePreKeys:${keyId}`);
      store.put({ keyId, _enc: enc });
    } else {
      existing.used = true;
      store.put(existing);
    }
  }
  await waitForTx(tx);
}

export async function deleteUsedOneTimePreKeys(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('oneTimePreKeys', 'readwrite');
  const store = tx.objectStore('oneTimePreKeys');
  const request = store.openCursor();
  await new Promise<void>((resolve, reject) => {
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        const val = cursor.value;
        if (val && (val.used === true || val.used === 1)) {
          cursor.delete();
        }
        cursor.continue();
      } else {
        resolve();
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getSession(contactUsername: string): Promise<SessionState | null> {
  try {
    const db = await openDB();
    const tx = db.transaction('sessions', 'readonly');
    const store = tx.objectStore('sessions');
    const result = await new Promise<any>((resolve, reject) => {
      const req = store.get(contactUsername);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const data = await encStoreGet<any>(result, 'contactUsername');
    if (!data) return null;
    return {
      contactUsername: data.contactUsername,
      theirIdentityKey: fromArray(data.theirIdentityKey),
      theirSignedPreKeyId: data.theirSignedPreKeyId,
      rootKey: fromArray(data.rootKey),
      sendingChain: { key: fromArray(data.sendingChain.key), index: data.sendingChain.index },
      receivingChain: { key: fromArray(data.receivingChain.key), index: data.receivingChain.index },
      dhRatchetPublic: fromArray(data.dhRatchetPublic),
      dhRatchetPrivate: fromArray(data.dhRatchetPrivate),
      theirRatchetPub: fromArray(data.theirRatchetPub),
      messageCount: data.messageCount,
      createdAt: data.createdAt,
      lastActive: data.lastActive,
    };
  } catch { return null; }
}

export async function saveSession(session: SessionState): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('sessions', 'readwrite');
  const store = tx.objectStore('sessions');
  const record = {
    contactUsername: session.contactUsername,
    theirIdentityKey: toArray(session.theirIdentityKey),
    theirSignedPreKeyId: session.theirSignedPreKeyId,
    rootKey: toArray(session.rootKey),
    sendingChain: { key: toArray(session.sendingChain.key), index: session.sendingChain.index },
    receivingChain: { key: toArray(session.receivingChain.key), index: session.receivingChain.index },
    dhRatchetPublic: toArray(session.dhRatchetPublic),
    dhRatchetPrivate: toArray(session.dhRatchetPrivate),
    theirRatchetPub: toArray(session.theirRatchetPub),
    messageCount: session.messageCount,
    createdAt: session.createdAt,
    lastActive: session.lastActive,
  };
  await encStorePut(store, record, 'contactUsername', 'sessions');
  await waitForTx(tx);
}

export async function deleteSession(contactUsername: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('sessions', 'readwrite');
  const store = tx.objectStore('sessions');
  store.delete(contactUsername);
  await waitForTx(tx);
}

export async function getAllSessions(): Promise<SessionState[]> {
  try {
    const db = await openDB();
    const tx = db.transaction('sessions', 'readonly');
    const store = tx.objectStore('sessions');
    const results = await new Promise<any[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (!results) return [];
    const decrypted = await encStoreGetAll<any>(results, 'contactUsername');
    return decrypted.map(r => ({
      contactUsername: r.contactUsername,
      theirIdentityKey: fromArray(r.theirIdentityKey),
      theirSignedPreKeyId: r.theirSignedPreKeyId,
      rootKey: fromArray(r.rootKey),
      sendingChain: { key: fromArray(r.sendingChain.key), index: r.sendingChain.index },
      receivingChain: { key: fromArray(r.receivingChain.key), index: r.receivingChain.index },
      dhRatchetPublic: fromArray(r.dhRatchetPublic),
      dhRatchetPrivate: fromArray(r.dhRatchetPrivate),
      theirRatchetPub: fromArray(r.theirRatchetPub),
      messageCount: r.messageCount,
      createdAt: r.createdAt,
      lastActive: r.lastActive,
    }));
  } catch { return []; }
}
