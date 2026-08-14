import type sodium from 'libsodium-wrappers-sumo';

const SALT_LENGTH = 16;
const NONCE_LENGTH = 24;
const KEY_LENGTH = 32;
const VERIFY_PLAINTEXT = '4SEND_VERIFIED';

export interface EncryptedValue {
  v: 2;
  salt: string;
  iv: string;
  aad: string;
  data: string;
}

let ready = false;
let _sodium: typeof sodium;

async function getSodium(): Promise<typeof sodium> {
  if (!_sodium) {
    const mod = await import('libsodium-wrappers-sumo');
    _sodium = mod.default || mod;
  }
  return _sodium;
}

export async function ensureReady() {
  if (!ready) {
    const s = await getSodium();
    await s.ready;
    ready = true;
  }
}

export async function generateSalt(): Promise<Uint8Array> {
  const s = await getSodium();
  return s.randombytes_buf(SALT_LENGTH);
}

export async function deriveKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
  await ensureReady();
  const s = _sodium;
  return s.crypto_pwhash(
    KEY_LENGTH,
    password,
    salt,
    s.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    s.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    s.crypto_pwhash_ALG_ARGON2ID13,
  );
}

export async function encrypt(plaintext: string, key: Uint8Array, aad: string): Promise<EncryptedValue> {
  await ensureReady();
  const s = _sodium;
  const nonce = s.randombytes_buf(NONCE_LENGTH);
  const encrypted = s.crypto_aead_xchacha20poly1305_ietf_encrypt(
    s.from_string(plaintext),
    s.from_string(aad),
    null,
    nonce,
    key,
  );
  return {
    v: 2,
    salt: '',
    iv: s.to_base64(nonce),
    aad,
    data: s.to_base64(encrypted),
  };
}

export async function encryptWithSalt(plaintext: string, key: Uint8Array, salt: Uint8Array, aad: string): Promise<EncryptedValue> {
  const result = await encrypt(plaintext, key, aad);
  const s = await getSodium();
  result.salt = s.to_base64(salt);
  return result;
}

export async function decrypt(enc: EncryptedValue, key: Uint8Array): Promise<string> {
  await ensureReady();
  const s = _sodium;
  const nonce = s.from_base64(enc.iv);
  const ciphertext = s.from_base64(enc.data);
  const aadBytes = s.from_string(enc.aad);
  const decrypted = s.crypto_aead_xchacha20poly1305_ietf_decrypt(
    null,
    ciphertext,
    aadBytes,
    nonce,
    key,
  );
  return s.to_string(decrypted);
}

export async function createVerificationBlob(key: Uint8Array, salt: Uint8Array): Promise<EncryptedValue> {
  return encryptWithSalt(VERIFY_PLAINTEXT, key, salt, 'verify');
}

export async function verifyPassword(password: string, saltBase64: string, blob: EncryptedValue): Promise<boolean> {
  try {
    const s = await getSodium();
    const salt = s.from_base64(saltBase64);
    const key = await deriveKey(password, salt);
    const result = await decrypt(blob, key);
    return result === VERIFY_PLAINTEXT;
  } catch {
    return false;
  }
}

export function validatePasswordFormat(password: string): boolean {
  return /^[a-zA-Z]{3}\d{3}$/.test(password);
}

export function encodePassword(letters: string, digits: string): string {
  return letters.toLowerCase() + digits;
}

export async function encryptValue(value: unknown, key: Uint8Array, aad: string): Promise<EncryptedValue> {
  return encrypt(JSON.stringify(value), key, aad);
}

export async function decryptValue<T>(enc: EncryptedValue, key: Uint8Array): Promise<T> {
  const plaintext = await decrypt(enc, key);
  return JSON.parse(plaintext) as T;
}
