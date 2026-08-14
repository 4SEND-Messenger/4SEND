import type sodium from 'libsodium-wrappers-sumo';

export interface IdentityKeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
  signingPublicKey: Uint8Array;
  signingPrivateKey: Uint8Array;
}

export interface SignedPreKey {
  keyId: number;
  publicKey: Uint8Array;
  privateKey: Uint8Array;
  signature: Uint8Array;
  createdAt: number;
}

export interface OneTimePreKey {
  keyId: number;
  publicKey: Uint8Array;
  privateKey: Uint8Array;
  used: boolean;
}

export interface ChainState {
  key: Uint8Array;
  index: number;
}

export interface SessionState {
  contactUsername: string;
  theirIdentityKey: Uint8Array;
  theirSignedPreKeyId: number;
  rootKey: Uint8Array;
  sendingChain: ChainState;
  receivingChain: ChainState;
  dhRatchetPublic: Uint8Array;
  dhRatchetPrivate: Uint8Array;
  theirRatchetPub: Uint8Array;
  messageCount: number;
  createdAt: number;
  lastActive: number;
}

export interface EncryptedPayload {
  ciphertext: string;
  ratchetKey: string;
  nonce: string;
  ratchetIndex: number;
}

export interface PreKeyBundle {
  identityKey: string;
  signedPreKey: { keyId: number; publicKey: string; signature: string };
  oneTimePreKey: { keyId: number; publicKey: string } | null;
  signingPublicKey?: string;
}
