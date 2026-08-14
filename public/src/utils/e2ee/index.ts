import type sodium from 'libsodium-wrappers-sumo';
import type { IdentityKeyPair, PreKeyBundle, EncryptedPayload, SessionState } from './types';
import { loadOrCreateIdentity } from './identity';
import { ensureSignedPreKey, ensureOneTimePreKeys } from './prekeys';
import {
  toBase64, fromBase64,
  getSession, saveSession, deleteSession,
  getIdentity,
} from './storage';

let _sodium: typeof sodium | null = null;

async function getSodium(): Promise<typeof sodium> {
  if (!_sodium) {
    const mod = await import('libsodium-wrappers-sumo');
    _sodium = mod.default || mod;
  }
  return _sodium;
}

export class E2EEService {
  private identity: IdentityKeyPair | null = null;
  private ready = false;

  async init(): Promise<void> {
    const s = await getSodium();
    await s.ready;
    this.identity = await loadOrCreateIdentity();
    await ensureSignedPreKey();
    await ensureOneTimePreKeys();
    this.ready = true;
  }

  isReady(): boolean {
    return this.ready;
  }

  async getMyPublicKeyBase64(): Promise<string> {
    if (!this.identity) this.identity = await loadOrCreateIdentity();
    const s = await getSodium();
    return s.to_base64(this.identity.publicKey);
  }

  async uploadBundle(): Promise<{
    identityKey: string;
    signedPreKey: { keyId: number; publicKey: string; signature: string };
    oneTimePreKeys: { keyId: number; publicKey: string }[];
    signingPublicKey: string;
  }> {
    const identity = this.identity || await loadOrCreateIdentity();
    const signedPreKey = await ensureSignedPreKey();
    const oneTimeKeys = await ensureOneTimePreKeys();
    const s = await getSodium();

    return {
      identityKey: s.to_base64(identity.publicKey),
      signedPreKey: {
        keyId: signedPreKey.keyId,
        publicKey: s.to_base64(signedPreKey.publicKey),
        signature: s.to_base64(signedPreKey.signature),
      },
      oneTimePreKeys: oneTimeKeys.filter(k => !k.used).map(k => ({
        keyId: k.keyId,
        publicKey: s.to_base64(k.publicKey),
      })),
      signingPublicKey: s.to_base64(identity.signingPublicKey),
    };
  }

  async createOutboundSession(
    contactUsername: string,
    bundle: PreKeyBundle
  ): Promise<SessionState> {
    if (!this.identity) this.identity = await loadOrCreateIdentity();

    if (!bundle.identityKey || !bundle.signedPreKey?.publicKey || !bundle.signedPreKey?.signature) {
      throw new Error('Invalid pre-key bundle: missing required fields');
    }

    let bobIdentityPub: Uint8Array;
    let bobSignedPreKeyPub: Uint8Array;
    let bobSignature: Uint8Array;
    let bobSigningPub: Uint8Array | null = null;
    try {
      bobIdentityPub = fromBase64(bundle.identityKey);
      bobSignedPreKeyPub = fromBase64(bundle.signedPreKey.publicKey);
      bobSignature = fromBase64(bundle.signedPreKey.signature);
      if (bundle.signingPublicKey) bobSigningPub = fromBase64(bundle.signingPublicKey);
    } catch {
      throw new Error('Invalid base64 in pre-key bundle');
    }

    const s = await getSodium();

    if (bobSigningPub) {
      const valid = s.crypto_sign_verify_detached(
        bobSignature,
        bobSignedPreKeyPub,
        bobSigningPub
      );
      if (!valid) throw new Error('Signed pre-key signature verification failed');
    }

    const ephemeral = s.crypto_box_keypair();
    const dh1 = s.crypto_scalarmult(this.identity.privateKey, bobSignedPreKeyPub);
    const dh2 = s.crypto_scalarmult(ephemeral.privateKey, bobIdentityPub);
    const dh3 = s.crypto_scalarmult(ephemeral.privateKey, bobSignedPreKeyPub);

    const parts = [dh1, dh2, dh3];

    let usedKeyId = -1;
    if (bundle.oneTimePreKey) {
      const bobOneTimePub = fromBase64(bundle.oneTimePreKey.publicKey);
      const dh4 = s.crypto_scalarmult(ephemeral.privateKey, bobOneTimePub);
      parts.push(dh4);
      usedKeyId = bundle.oneTimePreKey.keyId;
    }

    const combined = new Uint8Array(parts.reduce((len, p) => len + p.length, 0));
    let offset = 0;
    for (const p of parts) { combined.set(p, offset); offset += p.length; }

    const rootKey = s.crypto_generichash(32, combined, new Uint8Array(0));

    const session: SessionState = {
      contactUsername,
      theirIdentityKey: bobIdentityPub,
      theirSignedPreKeyId: bundle.signedPreKey.keyId,
      rootKey,
      sendingChain: { key: s.crypto_generichash(32, s.crypto_generichash(32, new Uint8Array([...rootKey, 0x01]), new Uint8Array(0)), new Uint8Array(0)), index: 0 },
      receivingChain: { key: s.crypto_generichash(32, s.crypto_generichash(32, new Uint8Array([...rootKey, 0x02]), new Uint8Array(0)), new Uint8Array(0)), index: 0 },
      dhRatchetPublic: ephemeral.publicKey,
      dhRatchetPrivate: ephemeral.privateKey,
      theirRatchetPub: fromBase64(bundle.signedPreKey.publicKey),
      messageCount: 0,
      createdAt: Date.now(),
      lastActive: Date.now(),
    };

    await saveSession(session);
    return session;
  }

  async createInboundSession(
    contactUsername: string,
    theirIdentityKeyB64: string,
    ephemeralKeyB64: string,
    usedKeyId: number
  ): Promise<SessionState> {
    if (!this.identity) this.identity = await loadOrCreateIdentity();
    if (!this.identity) throw new Error('Identity not loaded');

    const theirIdentityPub = fromBase64(theirIdentityKeyB64);
    const theirEphemeralPub = fromBase64(ephemeralKeyB64);

    const signedPreKey = await ensureSignedPreKey();
    const s = await getSodium();

    const dh1 = s.crypto_scalarmult(signedPreKey.privateKey, theirIdentityPub);
    const dh2 = s.crypto_scalarmult(this.identity.privateKey, theirEphemeralPub);
    const dh3 = s.crypto_scalarmult(signedPreKey.privateKey, theirEphemeralPub);

    const parts = [dh1, dh2, dh3];

    if (usedKeyId >= 0) {
      const { markOneTimePreKeyUsed, getOneTimePreKeys } = await import('./storage');
      const allKeys = await getOneTimePreKeys();
      const usedKey = allKeys.find(k => k.keyId === usedKeyId && !k.used);
      if (usedKey) {
        const dh4 = s.crypto_scalarmult(usedKey.privateKey, theirEphemeralPub);
        parts.push(dh4);
        await markOneTimePreKeyUsed(usedKeyId);
      }
    }

    const combined = new Uint8Array(parts.reduce((len, p) => len + p.length, 0));
    let offset = 0;
    for (const p of parts) { combined.set(p, offset); offset += p.length; }

    const rootKey = s.crypto_generichash(32, combined, new Uint8Array(0));

    const session: SessionState = {
      contactUsername,
      theirIdentityKey: theirIdentityPub,
      theirSignedPreKeyId: signedPreKey.keyId,
      rootKey,
      receivingChain: { key: s.crypto_generichash(32, s.crypto_generichash(32, new Uint8Array([...rootKey, 0x01]), new Uint8Array(0)), new Uint8Array(0)), index: 0 },
      sendingChain: { key: s.crypto_generichash(32, s.crypto_generichash(32, new Uint8Array([...rootKey, 0x02]), new Uint8Array(0)), new Uint8Array(0)), index: 0 },
      dhRatchetPublic: signedPreKey.publicKey,
      dhRatchetPrivate: signedPreKey.privateKey,
      theirRatchetPub: theirEphemeralPub,
      messageCount: 0,
      createdAt: Date.now(),
      lastActive: Date.now(),
    };

    await saveSession(session);
    return session;
  }

  async encryptMessage(contactUsername: string, plaintext: string): Promise<EncryptedPayload> {
    let session = await getSession(contactUsername);
    if (!session) throw new Error(`No session for ${contactUsername}`);

    const s = await getSodium();

    if (session.messageCount > 0 && session.messageCount % 3 === 0) {
      const newRatchet = s.crypto_box_keypair();
      const dh = s.crypto_scalarmult(newRatchet.privateKey, session.theirRatchetPub);
      const kdfInput = new Uint8Array([...session.rootKey, ...dh]);
      const newKeys = s.crypto_generichash(64, kdfInput, new Uint8Array(0));
      session.rootKey = newKeys.slice(0, 32);
      session.sendingChain.key = newKeys.slice(32, 64);
      session.dhRatchetPublic = newRatchet.publicKey;
      session.dhRatchetPrivate = newRatchet.privateKey;
    }

    const messageKey = s.crypto_generichash(32, new Uint8Array([...session.sendingChain.key, 0x01]), new Uint8Array(0));
    session.sendingChain.key = s.crypto_generichash(32, new Uint8Array([...session.sendingChain.key, 0x02]), new Uint8Array(0));
    const msgIndex = session.sendingChain.index++;

    const nonce = s.randombytes_buf(24);
    const ciphertext = s.crypto_aead_xchacha20poly1305_ietf_encrypt(
      plaintext,
      null,
      null,
      nonce,
      messageKey
    );

    session.messageCount++;
    session.lastActive = Date.now();
    await saveSession(session);

    return {
      ciphertext: s.to_base64(ciphertext),
      ratchetKey: s.to_base64(session.dhRatchetPublic),
      nonce: s.to_base64(nonce),
      ratchetIndex: msgIndex,
    };
  }

  async decryptMessage(
    contactUsername: string,
    payload: EncryptedPayload
  ): Promise<string> {
    let session = await getSession(contactUsername);
    if (!session) throw new Error(`No session for ${contactUsername}`);

    const s = await getSodium();

    const ratchetKey = fromBase64(payload.ratchetKey);
    const nonce = fromBase64(payload.nonce);
    const ciphertext = fromBase64(payload.ciphertext);

    if (s.to_base64(ratchetKey) !== s.to_base64(session.theirRatchetPub)) {
      const dh = s.crypto_scalarmult(session.dhRatchetPrivate, ratchetKey);
      const kdfInput = new Uint8Array([...session.rootKey, ...dh]);
      const newKeys = s.crypto_generichash(64, kdfInput, new Uint8Array(0));
      session.rootKey = newKeys.slice(0, 32);
      session.receivingChain.key = newKeys.slice(32, 64);
      session.theirRatchetPub = ratchetKey;
    }

    const messageKey = s.crypto_generichash(32, new Uint8Array([...session.receivingChain.key, 0x01]), new Uint8Array(0));
    session.receivingChain.key = s.crypto_generichash(32, new Uint8Array([...session.receivingChain.key, 0x02]), new Uint8Array(0));
    session.receivingChain.index++;

    const plaintextBytes = s.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      ciphertext,
      null,
      nonce,
      messageKey
    );
    const plaintext = typeof plaintextBytes === 'string' ? plaintextBytes : s.to_string(plaintextBytes);

    session.lastActive = Date.now();
    await saveSession(session);

    return plaintext;
  }

  async hasSession(contactUsername: string): Promise<boolean> {
    return !!(await getSession(contactUsername));
  }

  async getFingerprint(theirIdentityKeyB64: string): Promise<string> {
    if (!this.identity) this.identity = await loadOrCreateIdentity();
    const theirPub = fromBase64(theirIdentityKeyB64);
    const s = await getSodium();
    const combined = new Uint8Array([...this.identity.publicKey, ...theirPub]);
    const hash = s.crypto_generichash(16, combined, new Uint8Array(0));
    const hex = Array.from(hash).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    return hex.match(/.{4}/g)!.join(' ');
  }
}

export const e2ee = new E2EEService();
