import { useState, useCallback, useEffect, useRef } from 'react';
import { useI18n } from '../../hooks/useI18n';
import styles from './FileLimitModal.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function FileLimitModal({ isOpen, onClose }: Props) {
  const { t } = useI18n();
  const [closing, setClosing] = useState(false);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const rafRef = useRef<number>(0);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const animateClose = useCallback(() => {
    setClosing(true);
    timerRef.current = setTimeout(() => {
      onCloseRef.current();
    }, 300);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') animateClose();
  }, [animateClose]);

  useEffect(() => {
    if (!isOpen) return;
    setClosing(false);
    setOpen(false);
    rafRef.current = requestAnimationFrame(() => setOpen(true));
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className={`${styles.overlay}${open ? ` ${styles.overlayOpen}` : ''}${closing ? ` ${styles.closing}` : ''}`}
      onClick={e => { if (e.target === e.currentTarget) animateClose(); }}
    >
      <div className={`${styles.modal}${open ? ` ${styles.modalOpen}` : ''}${closing ? ` ${styles.modalClosing}` : ''}`}>
        <div className={styles.iconWrap}>
          <svg viewBox="0 0 24 24" className={styles.icon}>
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
        </div>
        <h3 className={styles.title}>{t('Файл')} {t('слишком большой')}</h3>
        <p className={styles.desc}>
          {t('Максимальный размер файла для загрузки составляет')} <b>25 {t('МБ')}</b>. {t('Пожалуйста, выберите файл меньшего размера.')}
        </p>
        <button className={styles.btn} onClick={animateClose}>{t('ПОНЯТНО')}</button>
      </div>
    </div>
  );
}
