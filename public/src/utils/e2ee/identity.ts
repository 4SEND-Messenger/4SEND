import type sodium from 'libsodium-wrappers-sumo';
import type { IdentityKeyPair } from './types';
import { getIdentity, saveIdentity } from './storage';

let _sodium: typeof sodium | null = null;

async function getSodium(): Promise<typeof sodium> {
  if (!_sodium) {
    const mod = await import('libsodium-wrappers-sumo');
    _sodium = mod.default || mod;
  }
  return _sodium;
}

export async function loadOrCreateIdentity(): Promise<IdentityKeyPair> {
  const s = await getSodium();
  await s.ready;

  const existing = await getIdentity();
  if (existing && existing.privateKey.length === 32 && existing.signingPrivateKey?.length === 64) return existing;

  const dhKeyPair = s.crypto_box_keypair();
  const signKeyPair = s.crypto_sign_keypair();

  const identity: IdentityKeyPair = {
    publicKey: dhKeyPair.publicKey,
    privateKey: dhKeyPair.privateKey,
    signingPublicKey: signKeyPair.publicKey,
    signingPrivateKey: signKeyPair.privateKey,
  };

  await saveIdentity(identity);
  return identity;
}

export async function getIdentityPublicKeyBase64(): Promise<string> {
  const identity = await loadOrCreateIdentity();
  const s = await getSodium();
  return s.to_base64(identity.publicKey);
}
