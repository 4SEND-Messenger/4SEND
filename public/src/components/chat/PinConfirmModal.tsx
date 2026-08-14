import { useState, useCallback, useEffect, useRef } from 'react';
import { useI18n } from '../../hooks/useI18n';
import styles from './PinConfirmModal.module.css';

interface PinConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPin: (forAll: boolean) => void;
  messageText?: string;
}

export default function PinConfirmModal({ isOpen, onClose, onPin, messageText }: PinConfirmModalProps) {
  const { t } = useI18n();
  const [isClosing, setIsClosing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!isOpen) {
      setIsClosing(false);
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    timerRef.current = setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 300);
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [isOpen, handleClose]);

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  if (!isOpen && !isClosing) return null;

  const preview = messageText
    ? messageText.length > 80
      ? messageText.slice(0, 80) + '...'
      : messageText
    : '';

  return (
    <>
      <div className={`${styles.overlay} ${isClosing ? styles.closing : ''}`} onClick={handleClose} />
      <div className={`${styles.modal} ${isClosing ? styles.closing : ''}`}>
        <div className={styles.title}>{t('Закрепить сообщение')}</div>
        {preview && <div className={styles.preview}>{preview}</div>}
        <button className={styles.pinAllBtn} onClick={() => onPin(true)}>
          {t('Закрепить для всех')}
        </button>
        <button className={styles.pinMeBtn} onClick={() => onPin(false)}>
          {t('Только для меня')}
        </button>
        <button className={styles.cancelBtn} onClick={handleClose}>
          {t('Отмена')}
        </button>
      </div>
    </>
  );
}
