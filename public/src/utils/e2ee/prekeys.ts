import type sodium from 'libsodium-wrappers-sumo';
import type { IdentityKeyPair, SignedPreKey, OneTimePreKey } from './types';
import {
  getSignedPreKey, saveSignedPreKey,
  getUnusedOneTimePreKeys, saveOneTimePreKeys, deleteUsedOneTimePreKeys,
} from './storage';
import { loadOrCreateIdentity } from './identity';

let _sodium: typeof sodium | null = null;

async function getSodium(): Promise<typeof sodium> {
  if (!_sodium) {
    const mod = await import('libsodium-wrappers-sumo');
    _sodium = mod.default || mod;
  }
  return _sodium;
}

const SIGNED_PRE_KEY_ROTATION_MS = 7 * 24 * 60 * 60 * 1000;
const ONE_TIME_PRE_KEY_TARGET = 100;
const ONE_TIME_PRE_KEY_REFILL_THRESHOLD = 20;

export async function ensureSignedPreKey(): Promise<SignedPreKey> {
  const s = await getSodium();
  await s.ready;

  const identity = await loadOrCreateIdentity();
  const existing = await getSignedPreKey();

  if (existing && Date.now() - existing.createdAt < SIGNED_PRE_KEY_ROTATION_MS) {
    const valid = s.crypto_sign_verify_detached(
      existing.signature,
      existing.publicKey,
      identity.signingPublicKey
    );
    if (valid) return existing;
  }

  const keyPair = s.crypto_box_keypair();

  const signature = s.crypto_sign_detached(
    keyPair.publicKey,
    identity.signingPrivateKey
  );

  const signedPreKey: SignedPreKey = {
    keyId: Date.now(),
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
    signature,
    createdAt: Date.now(),
  };

  await saveSignedPreKey(signedPreKey);
  return signedPreKey;
}

export async function ensureOneTimePreKeys(): Promise<OneTimePreKey[]> {
  const s = await getSodium();
  await s.ready;

  const unused = await getUnusedOneTimePreKeys();
  if (unused.length >= ONE_TIME_PRE_KEY_REFILL_THRESHOLD) return unused;

  const needed = ONE_TIME_PRE_KEY_TARGET - unused.length;
  if (needed <= 0) return unused;

  const startId = Date.now();
  const newKeys: OneTimePreKey[] = [];

  for (let i = 0; i < needed; i++) {
    const kp = s.crypto_box_keypair();
    newKeys.push({
      keyId: startId + i,
      publicKey: kp.publicKey,
      privateKey: kp.privateKey,
      used: false,
    });
  }

  await saveOneTimePreKeys(newKeys);

  await deleteUsedOneTimePreKeys();

  return [...unused, ...newKeys];
}
