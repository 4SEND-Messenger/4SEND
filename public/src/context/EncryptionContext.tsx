import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  deriveKey,
  createVerificationBlob,
  verifyPassword,
  generateSalt,
  ensureReady,
  validatePasswordFormat,
  type EncryptedValue,
} from '../utils/crypto/encryption';
import {
  migrateLocalStorageToEncrypted,
  migrateLocalStorageFromEncrypted,
} from '../utils/crypto/encryptedLocalStorage';
import { setCryptoKey as setKeyStoreKey } from '../utils/crypto/keyStore';
import { migrateIDBToEncrypted, migrateIDBFromEncrypted } from '../utils/crypto/migrateIDB';
import { translate } from '../hooks/useI18n';

interface EncryptionContextValue {
  isEncrypted: boolean;
  isUnlocked: boolean;
  cryptoKey: Uint8Array | null;
  isLoading: boolean;
  error: string | null;
  enableEncryption: (password: string) => Promise<boolean>;
  disableEncryption: (password: string) => Promise<void>;
  unlock: (password: string) => Promise<boolean>;
  markUnlocked: () => void;
  lock: () => void;
  setError: (err: string | null) => void;
}

const EncryptionContext = React.createContext<EncryptionContextValue | null>(null);

const STORAGE_PREFIX = '4send_enc_';

function base64ToBytes(b64: string): Uint8Array {
  const normal = b64.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normal);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function getEncKey(account: string): string {
  return `${STORAGE_PREFIX}salt_${account}`;
}

function getVerifyKey(account: string): string {
  return `${STORAGE_PREFIX}verify_${account}`;
}

function getFlagKey(account: string): string {
  return `${STORAGE_PREFIX}enabled_${account}`;
}

export function EncryptionProvider({ children }: { children: React.ReactNode }) {
  const [cryptoKey, setCryptoKey] = useState<Uint8Array | null>(null);
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const keyRef = useRef<Uint8Array | null>(null);
  const accountRef = useRef<string>('');

  useEffect(() => {
    const account = localStorage.getItem('4send_user') || '';
    accountRef.current = account;
    const flag = localStorage.getItem(getFlagKey(account));
    const saltBlob = localStorage.getItem(getEncKey(account));
    const encrypted = flag === '1' || !!saltBlob;
    setIsEncrypted(encrypted);

    ensureReady().then(() => {
      setIsLoading(false);
    }).catch(() => {
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    keyRef.current = cryptoKey;
    setKeyStoreKey(cryptoKey);
  }, [cryptoKey]);

  useEffect(() => {
    const handler = () => {
      if (keyRef.current) {
        keyRef.current = null;
        setCryptoKey(null);
        setIsUnlocked(false);
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const enableEncryption = useCallback(async (password: string): Promise<boolean> => {
    if (!validatePasswordFormat(password)) {
      setError(translate('Формат: 3 буквы + 3 цифры'));
      return false;
    }
    setIsLoading(true);
    setError(null);
    try {
      const account = accountRef.current || localStorage.getItem('4send_user') || '';
      const salt = await generateSalt();
      const key = await deriveKey(password, salt);
      const blob = await createVerificationBlob(key, salt);

      localStorage.setItem(getEncKey(account), JSON.stringify(blob));
      localStorage.setItem(getVerifyKey(account), JSON.stringify(blob));
      localStorage.setItem(getFlagKey(account), '1');

      await migrateLocalStorageToEncrypted(key);
      await migrateIDBToEncrypted(key);

      setCryptoKey(key);
      setKeyStoreKey(key);
      setIsEncrypted(true);
      setIsUnlocked(true);
      return true;
    } catch (e) {
      console.error('[Encryption] enableEncryption failed:', e);
      setError(translate('Ошибка шифрования'));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const disableEncryption = useCallback(async (password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const account = accountRef.current || localStorage.getItem('4send_user') || '';
      const verifyRaw = localStorage.getItem(getVerifyKey(account));
      if (!verifyRaw) {
        setError(translate('Данные повреждены'));
        setIsLoading(false);
        return;
      }
      const blob: EncryptedValue = JSON.parse(verifyRaw);
      const saltBase64 = blob.salt;
      const ok = await verifyPassword(password, saltBase64, blob);
      if (!ok) {
        setError(translate('Неверный пароль'));
        setIsLoading(false);
        return;
      }

      const key = await deriveKey(password, base64ToBytes(saltBase64));
      await migrateIDBFromEncrypted(key);
      await migrateLocalStorageFromEncrypted(key);

      localStorage.removeItem(getEncKey(account));
      localStorage.removeItem(getVerifyKey(account));
      localStorage.removeItem(getFlagKey(account));

      setCryptoKey(null);
      setKeyStoreKey(null);
      setIsEncrypted(false);
      setIsUnlocked(false);
    } catch {
      setError(translate('Ошибка расшифровки'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const unlock = useCallback(async (password: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const account = accountRef.current || localStorage.getItem('4send_user') || '';
      const verifyRaw = localStorage.getItem(getVerifyKey(account));
      if (!verifyRaw) {
        setError(translate('Данные повреждены'));
        setIsLoading(false);
        return false;
      }
      const blob: EncryptedValue = JSON.parse(verifyRaw);
      const saltBase64 = blob.salt;
      const ok = await verifyPassword(password, saltBase64, blob);
      if (!ok) {
        setError(translate('Неверный пароль'));
        setIsLoading(false);
        return false;
      }

      const salt = base64ToBytes(saltBase64);
      const key = await deriveKey(password, salt);
      setCryptoKey(key);
      setKeyStoreKey(key);
      setIsLoading(false);
      return true;
    } catch {
      setError(translate('Ошибка разблокировки'));
      setIsLoading(false);
      return false;
    }
  }, []);

  const markUnlocked = useCallback(() => {
    setIsUnlocked(true);
  }, []);

  const lock = useCallback(() => {
    setCryptoKey(null);
    setKeyStoreKey(null);
    setIsUnlocked(false);
    keyRef.current = null;
  }, []);

  return (
    <EncryptionContext.Provider value={{
      isEncrypted,
      isUnlocked,
      cryptoKey,
      isLoading,
      error,
      enableEncryption,
      disableEncryption,
      unlock,
      markUnlocked,
      lock,
      setError,
    }}>
      {children}
    </EncryptionContext.Provider>
  );
}

export function useEncryption(): EncryptionContextValue {
  const ctx = useContext(EncryptionContext);
  if (!ctx) throw new Error('useEncryption must be used within EncryptionProvider');
  return ctx;
}
