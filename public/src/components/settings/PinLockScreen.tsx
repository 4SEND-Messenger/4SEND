import { useState, useCallback, useRef, useEffect } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { useI18n } from '../../hooks/useI18n';
import styles from './PinLockScreen.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function PinLockScreen({ isOpen, onClose }: Props) {
  const { t } = useI18n();
  const { unlockApp, confirmUnlock } = useSettings();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError(false);
      setUnlocking(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleUnlock = useCallback(async (pinStr?: string) => {
    const code = pinStr || pin;
    if (code.length !== 4) return;
    const ok = unlockApp(code);
    if (ok) {
      setPin('');
      setUnlocking(true);
      setTimeout(() => {
        confirmUnlock();
        onClose();
      }, 600);
    } else {
      setError(true);
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
      setPin('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [pin, unlockApp, confirmUnlock, onClose]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    setPin(val);
    setError(false);
    if (val.length === 4) {
      handleUnlock(val);
    }
  }, [handleUnlock]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleUnlock();
  }, [handleUnlock]);

  if (!isOpen) return null;

  return (
    <div className={`${styles.overlay} ${unlocking ? styles.unlocking : ''}`}>
      <div className={`${styles.content} ${shaking ? styles.shake : ''} ${unlocking ? styles.unlockContent : ''}`}>
        <div className={styles.glowRing} />

        <div className={styles.lockIcon}>
          <svg viewBox="0 0 24 24" className={styles.lockSvg}>
            <rect x="3" y="11" width="18" height="11" rx="3" ry="3" style={{ fill: 'rgba(var(--accent-rgb), 0.1)', stroke: 'var(--accent-solid)' }} strokeWidth="1.5" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" fill="none" style={{ stroke: 'var(--accent-solid)' }} strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="12" cy="16" r="1.5" fill="var(--accent-solid)" className={styles.lockDot} />
          </svg>
        </div>

        <h2 className={styles.title}>{t('4SEND ЗАБЛОКИРОВАН')}</h2>
        <p className={styles.subtitle}>{t('Введите PIN-код для доступа')}</p>

        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          maxLength={4}
          placeholder="••••"
          className={`${styles.pinInput} ${error ? styles.errorBorder : ''}`}
          value={pin}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          disabled={unlocking}
        />

        {error && <p className={styles.errorText}>{t('Неверный PIN')}</p>}

        <button className={styles.unlockBtn} onClick={() => handleUnlock()} disabled={unlocking}>
          {t('РАЗБЛОКИРОВАТЬ')}
        </button>
      </div>
    </div>
  );
}
