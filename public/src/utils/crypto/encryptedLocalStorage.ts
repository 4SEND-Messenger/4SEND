import { encrypt, decrypt, type EncryptedValue } from './encryption';

const ENCRYPTED_KEYS = [
  '4send_token',
  '4send_accounts',
  '4send_e2ee_decrypted',
  '4send_privacy',
] as const;

type EncryptedLSKey = typeof ENCRYPTED_KEYS[number];

export function isEncryptedLSKey(key: string): key is EncryptedLSKey {
  return (ENCRYPTED_KEYS as readonly string[]).includes(key);
}

export async function setEncryptedLS(key: EncryptedLSKey, value: unknown, cryptoKey: Uint8Array): Promise<void> {
  const enc = await encrypt(JSON.stringify(value), cryptoKey, key);
  localStorage.setItem(key, JSON.stringify(enc));
}

export async function getEncryptedLS<T>(key: EncryptedLSKey, defaultValue: T, cryptoKey: Uint8Array | null): Promise<T> {
  if (!cryptoKey) {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    try { return JSON.parse(raw) as T; } catch { return defaultValue; }
  }

  const raw = localStorage.getItem(key);
  if (!raw) return defaultValue;

  try {
    const parsed = JSON.parse(raw) as EncryptedValue;
    if (parsed.v === 2 && parsed.data && parsed.iv && parsed.aad) {
      const plaintext = await decrypt(parsed, cryptoKey);
      return JSON.parse(plaintext) as T;
    }
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

export async function removeEncryptedLS(key: EncryptedLSKey): Promise<void> {
  localStorage.removeItem(key);
}

export async function migrateLocalStorageToEncrypted(cryptoKey: Uint8Array): Promise<void> {
  for (const key of ENCRYPTED_KEYS) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.v === 2) continue;

      const enc = await encrypt(JSON.stringify(parsed), cryptoKey, key);
      localStorage.setItem(key, JSON.stringify(enc));
    } catch {
      const enc = await encrypt(raw, cryptoKey, key);
      localStorage.setItem(key, JSON.stringify(enc));
    }
  }
}

export async function migrateLocalStorageFromEncrypted(cryptoKey: Uint8Array): Promise<void> {
  for (const key of ENCRYPTED_KEYS) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw) as EncryptedValue;
      if (parsed.v === 2 && parsed.data && parsed.iv && parsed.aad) {
        const plaintext = await decrypt(parsed, cryptoKey);
        localStorage.setItem(key, plaintext);
      }
    } catch {
      // Already plaintext or corrupted, skip
    }
  }
}
