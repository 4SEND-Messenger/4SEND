import { useState, useCallback, useRef, useEffect } from 'react';
import { useI18n } from '../../hooks/useI18n';
import { useEncryption } from '../../context/EncryptionContext';
import ModalShell from './ModalShell';
import styles from './EncryptionModal.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'main' | 'progress' | 'done';

export default function EncryptionModal({ isOpen, onClose }: Props) {
  const { t } = useI18n();
  const { isEncrypted, enableEncryption, disableEncryption, isLoading, error, setError } = useEncryption();
  const [step, setStep] = useState<Step>('main');
  const [letters, setLetters] = useState('');
  const [digits, setDigits] = useState('');
  const [confirmLetters, setConfirmLetters] = useState('');
  const [confirmDigits, setConfirmDigits] = useState('');
  const [disableLetters, setDisableLetters] = useState('');
  const [disableDigits, setDisableDigits] = useState('');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setStep('main');
      setError(null);
    }
  }, [isOpen, setError]);

  const closeRef = useRef<(() => void) | null>(null);

  const handleEnable = useCallback(async () => {
    const password = letters.toLowerCase() + digits;
    if (letters.length !== 3 || digits.length !== 3) {
      setError(t('Введите 3 буквы и 3 цифры'));
      return;
    }
    if (password !== confirmLetters.toLowerCase() + confirmDigits) {
      setError(t('Пароли не совпадают'));
      return;
    }
    setStep('progress');
    setProgress(10);
    setTimeout(() => setProgress(30), 200);
    setTimeout(() => setProgress(60), 500);
    setTimeout(() => setProgress(90), 800);
    const ok = await enableEncryption(password);
    if (!ok) {
      setStep('main');
      return;
    }
    setProgress(100);
    setTimeout(() => setStep('done'), 500);
  }, [letters, digits, confirmLetters, confirmDigits, enableEncryption, setError]);

  const handleDisable = useCallback(async () => {
    const password = disableLetters.toLowerCase() + disableDigits;
    if (disableLetters.length !== 3 || disableDigits.length !== 3) {
      setError(t('Введите пароль'));
      return;
    }
    await disableEncryption(password);
  }, [disableLetters, disableDigits, disableEncryption, setError]);

  const shieldSvg = (
    <svg viewBox="0 0 48 48" width="52" height="52" fill="none">
      <path d="M24 4L8 12v10c0 11.1 6.8 21.5 16 24 9.2-2.5 16-12.9 16-24V12L24 4z" fill="rgba(var(--accent-rgb,167,79,255),0.1)" stroke="var(--accent-solid,#a74fff)" strokeWidth="2"/>
      <path d="M20 24l3 3 6-6" stroke="var(--accent-solid,#a74fff)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title={t('Шифрование базы')} maxWidth="400px" closeRef={closeRef}>
      {step === 'main' && !isEncrypted && (
        <div className={styles.step}>
          <div className={styles.heroIcon}>{shieldSvg}</div>

          <div className={styles.infoBlock}>
            <p className={styles.infoTitle}>{t('Что зашифровано')}</p>
            <div className={styles.featureList}>
              <div className={styles.featureItem}>
                <span className={styles.dot} style={{ background: '#34c759' }} />
                <span>{t('Сообщения, медиа, вложения')}</span>
              </div>
              <div className={styles.featureItem}>
                <span className={styles.dot} style={{ background: '#34c759' }} />
                <span>{t('Криптоключи E2EE (сессии, identity)')}</span>
              </div>
              <div className={styles.featureItem}>
                <span className={styles.dot} style={{ background: '#34c759' }} />
                <span>{t('Токен авторизации и данные аккаунтов')}</span>
              </div>
              <div className={styles.featureItem}>
                <span className={styles.dot} style={{ background: '#888' }} />
                <span className={styles.muted}>{t('Настройки интерфейса без изменений')}</span>
              </div>
            </div>
          </div>

          <div className={styles.infoBlock}>
            <p className={styles.infoTitle}>{t('Как работает')}</p>
            <p className={styles.infoText}>
              {t('При включении задаётся пароль (3 буквы + 3 цифры). Данные шифруются на устройстве алгоритмом Argon2id + XChaCha20. При каждом запуске приложения потребуется ввести пароль.')}
            </p>
          </div>

          <div className={styles.warnBox}>
            <svg viewBox="0 0 20 20" width="16" height="16" fill="#ff9500" style={{ flexShrink: 0, marginTop: 1 }}><path d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 10-2 0 1 1 0 002 0zm-1-2a.75.75 0 01-.75-.75v-3.5a.75.75 0 011.5 0v3.5A.75.75 0 0110 11z"/></svg>
            <div>
              <p className={styles.warnText}>{t('Восстановление пароля невозможно.')}</p>
              <p className={styles.warnText}>{t('При потере пароля данные будут безвозвратно утеряны.')}</p>
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>{t('Пароль')}</label>
            <div className={styles.passwordRow}>
              <input
                className={styles.passwordInput}
                type="text"
                maxLength={3}
                placeholder="ABC"
                value={letters}
                onChange={e => setLetters(e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 3))}
                autoComplete="off"
                autoCapitalize="off"
              />
              <input
                className={styles.passwordInput}
                type="text"
                maxLength={3}
                placeholder="123"
                value={digits}
                onChange={e => setDigits(e.target.value.replace(/\D/g, '').slice(0, 3))}
                autoComplete="off"
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>{t('Подтвердите пароль')}</label>
            <div className={styles.passwordRow}>
              <input
                className={styles.passwordInput}
                type="text"
                maxLength={3}
                placeholder="ABC"
                value={confirmLetters}
                onChange={e => setConfirmLetters(e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 3))}
                autoComplete="off"
                autoCapitalize="off"
              />
              <input
                className={styles.passwordInput}
                type="text"
                maxLength={3}
                placeholder="123"
                value={confirmDigits}
                onChange={e => setConfirmDigits(e.target.value.replace(/\D/g, '').slice(0, 3))}
                autoComplete="off"
              />
            </div>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button
            className={styles.primaryBtn}
            onClick={handleEnable}
            disabled={isLoading || letters.length < 3 || digits.length < 3}
          >
            {isLoading ? t('Шифрование...') : t('Включить шифрование')}
          </button>
        </div>
      )}

      {step === 'main' && isEncrypted && (
        <div className={styles.step}>
          <div className={styles.heroIcon}>
            <svg viewBox="0 0 48 48" width="52" height="52" fill="none">
              <path d="M24 4L8 12v10c0 11.1 6.8 21.5 16 24 9.2-2.5 16-12.9 16-24V12L24 4z" fill="rgba(52,199,89,0.1)" stroke="#34c759" strokeWidth="2"/>
              <path d="M20 24l3 3 6-6" stroke="#34c759" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          <div className={styles.activeBadge}>{t('Шифрование активно')}</div>

          <div className={styles.infoBlock}>
            <p className={styles.infoText}>
              {t('Сообщения, ключи E2EE и данные аккаунтов зашифрованы на этом устройстве.')}
            </p>
          </div>

          <div className={styles.infoBlock}>
            <p className={styles.infoTitle}>{t('Отключение шифрования')}</p>
            <p className={styles.infoText}>
              {t('Все данные будут расшифрованы и сохранены в открытом виде. Пароль введите для подтверждения.')}
            </p>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>{t('Пароль')}</label>
            <div className={styles.passwordRow}>
              <input
                className={styles.passwordInput}
                type="text"
                maxLength={3}
                placeholder="ABC"
                value={disableLetters}
                onChange={e => setDisableLetters(e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 3))}
                autoComplete="off"
                autoCapitalize="off"
              />
              <input
                className={styles.passwordInput}
                type="text"
                maxLength={3}
                placeholder="123"
                value={disableDigits}
                onChange={e => setDisableDigits(e.target.value.replace(/\D/g, '').slice(0, 3))}
                autoComplete="off"
              />
            </div>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button
            className={styles.dangerBtn}
            onClick={handleDisable}
            disabled={isLoading || disableLetters.length < 3 || disableDigits.length < 3}
          >
            {isLoading ? t('Расшифровка...') : t('Отключить шифрование')}
          </button>
        </div>
      )}

      {step === 'progress' && (
        <div className={styles.step}>
          <div className={styles.heroIcon}>{shieldSvg}</div>
          <p className={styles.progressText}>{t('Шифрование базы данных...')}</p>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className={styles.step}>
          <div className={styles.heroIcon}>
            <svg viewBox="0 0 48 48" width="52" height="52" fill="none">
              <circle cx="24" cy="24" r="20" fill="rgba(52,199,89,0.12)" stroke="#34c759" strokeWidth="2"/>
              <path d="M16 24l5 5 11-11" stroke="#34c759" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p className={styles.doneText}>{t('Шифрование активно')}</p>
          <p className={styles.muted}>{t('При следующем запуске потребуется ввести пароль.')}</p>
          <button className={styles.primaryBtn} onClick={() => closeRef.current?.()}>{t('Готово')}</button>
        </div>
      )}
    </ModalShell>
  );
}
