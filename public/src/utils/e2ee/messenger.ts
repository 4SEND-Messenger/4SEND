import { e2ee } from './index';
import type { EncryptedPayload } from './types';

export const SECRET_PREFIX = 'secret::';

export function stripSecret(t?: string | null): string {
  if (!t) return '';
  return t.startsWith(SECRET_PREFIX) ? t.slice(SECRET_PREFIX.length) : t;
}

export interface E2EEMessageFields {
  is_encrypted?: boolean;
  encrypted_text?: string;
  encrypted_ratchet_key?: string;
  encrypted_nonce?: string;
  encrypted_ratchet_index?: number;
}

const sessionCache = new Map<string, boolean>();

function cachedHasSession(contact: string): boolean {
  return sessionCache.get(contact.toLowerCase()) ?? false;
}

export function updateSessionCache(contact: string, has: boolean): void {
  sessionCache.set(contact.toLowerCase(), has);
}

const DECRYPTED_KEY = '4send_e2ee_decrypted';
function loadDecryptedCache(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(DECRYPTED_KEY) || '{}');
  } catch {
    return {};
  }
}
function cacheDecrypted(id: string, text: string): void {
  if (!id) return;
  const cache = loadDecryptedCache();
  cache[id] = text;
  try {
    localStorage.setItem(DECRYPTED_KEY, JSON.stringify(cache));
  } catch {
    /* ignore quota errors */
  }
}

export function cacheOwnMessagePlaintext(tempId: string, text: string): void {
  cacheDecrypted(tempId, text);
}

export async function prepareOutgoing(
  text: string,
  receiver: string
): Promise<E2EEMessageFields> {
  const lower = (receiver || '').toLowerCase();
  if (!lower.startsWith(SECRET_PREFIX)) return {};
  const contact = lower.slice(SECRET_PREFIX.length);
  if (!cachedHasSession(contact)) return {};

  try {
    const encrypted = await e2ee.encryptMessage(contact, text);
    return {
      is_encrypted: true,
      encrypted_text: encrypted.ciphertext,
      encrypted_ratchet_key: encrypted.ratchetKey,
      encrypted_nonce: encrypted.nonce,
      encrypted_ratchet_index: encrypted.ratchetIndex,
    };
  } catch {
    return {};
  }
}

export async function processIncoming<T extends { id?: string; tempId?: string; sender?: string; receiver?: string; text?: string; is_encrypted?: boolean; encrypted_text?: string; encrypted_ratchet_key?: string; encrypted_nonce?: string; encrypted_ratchet_index?: number }>(
  msg: T
): Promise<T> {
  if (!msg.is_encrypted || !msg.encrypted_text) return msg;

  const cache = loadDecryptedCache();
  const cachedKey =
    (msg.id && cache[msg.id] != null) ? msg.id
    : (msg.tempId && cache[msg.tempId] != null) ? msg.tempId
    : null;
  if (cachedKey) {
    return { ...msg, text: cache[cachedKey], is_encrypted: true };
  }

  const payload = {
    ciphertext: msg.encrypted_text as string,
    ratchetKey: msg.encrypted_ratchet_key || '',
    nonce: msg.encrypted_nonce || '',
    ratchetIndex: msg.encrypted_ratchet_index || 0,
  };

  const peer = (msg.sender || '').toLowerCase();

  try {
    const plaintext = await e2ee.decryptMessage(peer, payload);
    if (msg.id) cacheDecrypted(msg.id, plaintext);
    return { ...msg, text: plaintext, is_encrypted: true, e2ee_failed: false };
  } catch (err) {
    const message = (err as Error)?.message || '';
    if (message.includes('No session')) return { ...msg, e2ee_failed: true };
    return { ...msg, text: '[E2EE: unable to decrypt]', e2ee_failed: true };
  }
}

export async function processBatch<T extends { sender?: string; text?: string; is_encrypted?: boolean; encrypted_text?: string; encrypted_ratchet_key?: string; encrypted_nonce?: string; encrypted_ratchet_index?: number }>(
  msgs: T[]
): Promise<T[]> {
  return Promise.all(msgs.map(m => processIncoming(m)));
}
