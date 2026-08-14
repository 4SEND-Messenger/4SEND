import { encryptValue, decryptValue, type EncryptedValue } from './encryption';

function isEnc(v: unknown): v is EncryptedValue {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return o.v === 2 && typeof o.data === 'string' && typeof o.iv === 'string' && typeof o.aad === 'string';
}

function isEnvelope(v: unknown): boolean {
  return !!v && typeof v === 'object' && isEnc((v as Record<string, unknown>)._enc);
}

function waitForTx(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function migrateStore(
  dbName: string,
  storeName: string,
  keyField: string,
  key: Uint8Array,
  encrypt: boolean,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const req = indexedDB.open(dbName);
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.close();
        resolve();
        return;
      }
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const cursorReq = store.openCursor();
      let migrated = 0;

      cursorReq.onsuccess = async () => {
        const cursor = cursorReq.result;
        if (!cursor) {
          await waitForTx(tx);
          db.close();
          resolve();
          return;
        }

        const value = cursor.value;
        try {
          if (encrypt) {
            if (!isEnvelope(value)) {
              const enc = await encryptValue(value, key, `${storeName}:${value[keyField]}`);
              cursor.update({ [keyField]: value[keyField], _enc: enc });
              migrated++;
            }
          } else {
            if (isEnvelope(value)) {
              const decrypted = await decryptValue(value._enc, key);
              cursor.update(decrypted);
              migrated++;
            }
          }
        } catch {
          // Skip corrupted records
        }
        cursor.continue();
      };

      cursorReq.onerror = () => {
        db.close();
        reject(cursorReq.error);
      };
    };
    req.onerror = () => reject(req.error);
  });
}

async function migrateKVStore(
  dbName: string,
  storeName: string,
  key: Uint8Array,
  encrypt: boolean,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const req = indexedDB.open(dbName);
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.close();
        resolve();
        return;
      }
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const cursorReq = store.openCursor();

      cursorReq.onsuccess = async () => {
        const cursor = cursorReq.result;
        if (!cursor) {
          await waitForTx(tx);
          db.close();
          resolve();
          return;
        }

        const idbKey = cursor.key;
        const value = cursor.value;
        try {
          if (encrypt) {
            if (!isEnc(value)) {
              const enc = await encryptValue(value, key, `${storeName}:${idbKey}`);
              cursor.update(enc);
            }
          } else {
            if (isEnc(value)) {
              const decrypted = await decryptValue(value, key);
              cursor.update(decrypted);
            }
          }
        } catch {
          // Skip corrupted
        }
        cursor.continue();
      };

      cursorReq.onerror = () => {
        db.close();
        reject(cursorReq.error);
      };
    };
    req.onerror = () => reject(req.error);
  });
}

export async function migrateIDBToEncrypted(key: Uint8Array): Promise<void> {
  await migrateStore('4send_cache', 'messages', 'chatId', key, true);
  await migrateStore('4send_cache', 'pins', 'chatId', key, true);

  await migrateStore('4send_e2ee', 'identity', 'key', key, true);
  await migrateStore('4send_e2ee', 'signedPreKey', 'keyId', key, true);
  await migrateStore('4send_e2ee', 'oneTimePreKeys', 'keyId', key, true);
  await migrateStore('4send_e2ee', 'sessions', 'contactUsername', key, true);

  await migrateKVStore('4send_db', 'cache', key, true);
}

export async function migrateIDBFromEncrypted(key: Uint8Array): Promise<void> {
  await migrateStore('4send_cache', 'messages', 'chatId', key, false);
  await migrateStore('4send_cache', 'pins', 'chatId', key, false);

  await migrateStore('4send_e2ee', 'identity', 'key', key, false);
  await migrateStore('4send_e2ee', 'signedPreKey', 'keyId', key, false);
  await migrateStore('4send_e2ee', 'oneTimePreKeys', 'keyId', key, false);
  await migrateStore('4send_e2ee', 'sessions', 'contactUsername', key, false);

  await migrateKVStore('4send_db', 'cache', key, false);
}
