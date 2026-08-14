import { encryptValue, decryptValue, type EncryptedValue } from './encryption';

export async function encryptIDBRecord<T extends Record<string, unknown>>(
  record: T,
  cryptoKey: Uint8Array,
  aad: string,
): Promise<EncryptedValue> {
  return encryptValue(record, cryptoKey, aad);
}

export async function decryptIDBRecord<T>(
  enc: EncryptedValue,
  cryptoKey: Uint8Array,
): Promise<T> {
  return decryptValue<T>(enc, cryptoKey);
}

export async function encryptIDBValue<T>(
  value: T,
  cryptoKey: Uint8Array,
  aad: string,
): Promise<EncryptedValue> {
  return encryptValue(value, cryptoKey, aad);
}

export async function decryptIDBValue<T>(
  enc: EncryptedValue,
  cryptoKey: Uint8Array,
): Promise<T> {
  return decryptValue<T>(enc, cryptoKey);
}

export function isEncryptedValue(value: unknown): value is EncryptedValue {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return v.v === 2 && typeof v.data === 'string' && typeof v.iv === 'string' && typeof v.aad === 'string';
}
