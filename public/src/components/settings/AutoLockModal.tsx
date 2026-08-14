import { useState, useCallback, useRef, useEffect } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { useI18n } from '../../hooks/useI18n';
import ModalShell from './ModalShell';
import styles from './AutoLockModal.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const PIN_LENGTH = 4;

export default function AutoLockModal({ isOpen, onClose }: Props) {
  const { t } = useI18n();
  const { autoLockMinutes, setAutoLockMinutes, pin, setPin } = useSettings();

  const [showPinInput, setShowPinInput] = useState(false);
  const [pinClosing, setPinClosing] = useState(false);
  const [pinDigits, setPinDigits] = useState<string[]>(['', '', '', '']);
  const [pinSaved, setPinSaved] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const options = [
    { value: 1, label: t('1 минута') },
    { value: 3, label: t('3 минуты') },
    { value: 5, label: t('5 минут') },
    { value: 0, label: t('Выкл') },
  ];

  const handleSelect = useCallback((minutes: number) => {
    setAutoLockMinutes(minutes);
  }, [setAutoLockMinutes]);

  const handlePinToggle = useCallback(() => {
    if (showPinInput) {
      setPinClosing(true);
      setTimeout(() => {
        setShowPinInput(false);
        setPinClosing(false);
      }, 250);
    } else {
      setShowPinInput(true);
      setPinClosing(false);
    }
    setPinSaved(false);
  }, [showPinInput]);

  const handlePinChange = useCallback((index: number, value: string) => {
    if (value.length > 1) return;
    if (value && !/^\d$/.test(value)) return;
    const newDigits = [...pinDigits];
    newDigits[index] = value;
    setPinDigits(newDigits);
    if (value && index < PIN_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
    if (newDigits.every(d => d !== '') && newDigits.join('').length === PIN_LENGTH) {
      setPin(newDigits.join(''));
      setPinSaved(true);
      setTimeout(() => setPinSaved(false), 2000);
    }
  }, [pinDigits, setPin]);

  const handlePinKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pinDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }, [pinDigits]);

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title={t('Автоблокировка')}>
      <div className={styles.sectionHeader}>{t('Таймер блокировки')}</div>
      <div className={styles.optionsGrid}>
        {options.map(opt => (
          <button
            key={opt.value}
            className={`${styles.optionBtn} ${autoLockMinutes === opt.value ? styles.optionSelected : ''}`}
            onClick={() => handleSelect(opt.value)}
          >
            <span className={styles.optionLabel}>{opt.label}</span>
            {autoLockMinutes === opt.value && (
              <span className={styles.checkBadge}>
                <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12l4 4L18 6" />
                </svg>
              </span>
            )}
          </button>
        ))}
      </div>
      <div className={styles.pinSection}>
        <button className={styles.pinBtn} onClick={handlePinToggle}>
          <svg viewBox="0 0 24 24" className={styles.pinBtnIcon}>
            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM12 17c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM9 8V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9z" />
          </svg>
          {pin ? t('Изменить PIN') : t('Установить PIN-код')}
        </button>
        {showPinInput && (
          <div className={`${styles.pinInputs} ${pinClosing ? styles.pinClosing : ''}`}>
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <input key={i} ref={el => { inputRefs.current[i] = el; }}
                type="password" inputMode="numeric" maxLength={1}
                className={styles.pinInput} value={pinDigits[i]}
                onChange={e => handlePinChange(i, e.target.value)}
                onKeyDown={e => handlePinKeyDown(i, e)} autoFocus={i === 0 && !pinClosing} />
            ))}
          </div>
        )}
        {pinSaved && <div className={styles.pinSaved}>{t('PIN сохранён!')}</div>}
      </div>
    </ModalShell>
  );
}
