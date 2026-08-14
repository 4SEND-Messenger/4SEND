import { useState, useCallback, useEffect, useRef } from 'react';
import { useI18n } from '../../hooks/useI18n';
import { useEncryption } from '../../context/EncryptionContext';
import styles from './EncryptionUnlockScreen.module.css';

export default function EncryptionUnlockScreen() {
  const { t } = useI18n();
  const { unlock, markUnlocked, isLoading, error, setError } = useEncryption();
  const [letters, setLetters] = useState('');
  const [digits, setDigits] = useState('');
  const [entered, setEntered] = useState(false);
  const [closing, setClosing] = useState(false);
  const unlockCalledRef = useRef(false);
  const digitsRef = useCallback((node: HTMLInputElement | null) => {
    if (node) node.focus();
  }, []);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setEntered(true));
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => markUnlocked(), 400);
    return () => clearTimeout(timer);
  }, [closing, markUnlocked]);

  const handleUnlock = useCallback(async () => {
    if (unlockCalledRef.current) return;
    const password = letters.toLowerCase() + digits;
    if (letters.length < 3 || digits.length < 3) return;
    unlockCalledRef.current = true;
    const ok = await unlock(password);
    if (ok) {
      setClosing(true);
    } else {
      unlockCalledRef.current = false;
    }
  }, [letters, digits, unlock]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleUnlock();
  }, [handleUnlock]);

  return (
    <div className={`${styles.overlay} ${entered && !closing ? styles.visible : ''} ${closing ? styles.closing : ''}`}>
      <div className={styles.card}>
        <div className={styles.heroIcon}>
          <svg viewBox="0 0 80 80" width="80" height="80" fill="none">
            <circle cx="40" cy="40" r="38" fill="rgba(var(--accent-rgb,167,79,255),0.08)" stroke="var(--accent-solid,#a74fff)" strokeWidth="2" strokeDasharray="6 4"/>
            <rect x="24" y="36" width="32" height="24" rx="6" fill="rgba(var(--accent-rgb,167,79,255),0.12)" stroke="var(--accent-solid,#a74fff)" strokeWidth="2.5"/>
            <path d="M32 36v-6a8 8 0 0116 0v6" stroke="var(--accent-solid,#a74fff)" strokeWidth="2.5" strokeLinecap="round"/>
            <circle cx="40" cy="48" r="3" fill="var(--accent-solid,#a74fff)"/>
            <line x1="40" y1="51" x2="40" y2="54" stroke="var(--accent-solid,#a74fff)" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </div>

        <h2 className={styles.title}>{t('База данных зашифрована')}</h2>
        <p className={styles.subtitle}>{t('Введите пароль для доступа к сообщениям')}</p>

        <div className={styles.passwordRow} onKeyDown={handleKeyDown}>
          <input
            ref={digitsRef}
            className={styles.input}
            type="text"
            maxLength={3}
            placeholder="ABC"
            value={letters}
            onChange={e => setLetters(e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 3))}
            autoComplete="off"
            autoCapitalize="off"
          />
          <input
            className={styles.input}
            type="text"
            maxLength={3}
            placeholder="123"
            value={digits}
            onChange={e => setDigits(e.target.value.replace(/\D/g, '').slice(0, 3))}
            onKeyDown={e => { if (e.key === 'Enter') handleUnlock(); }}
            autoComplete="off"
          />
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <button
          className={styles.unlockBtn}
          onClick={handleUnlock}
          disabled={isLoading || letters.length < 3 || digits.length < 3}
        >
          {isLoading ? (
            <span className={styles.spinner} />
          ) : (
            t('Разблокировать')
          )}
        </button>
      </div>
    </div>
  );
}
