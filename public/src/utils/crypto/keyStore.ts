let currentKey: Uint8Array | null = null;

export function setCryptoKey(key: Uint8Array | null): void {
  currentKey = key;
}

export function getCryptoKey(): Uint8Array | null {
  return currentKey;
}

export function hasCryptoKey(): boolean {
  return currentKey !== null;
}
