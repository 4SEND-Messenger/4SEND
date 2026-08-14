import { useEffect, useState, useCallback, useRef } from 'react';
import { useI18n } from '../../hooks/useI18n';
import styles from './ModalShell.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
  title?: string;
  showClose?: boolean;
  danger?: boolean;
  dangerColor?: string;
  onBack?: () => void;
  closeRef?: React.MutableRefObject<(() => void) | null>;
}

export default function ModalShell({ isOpen, onClose, children, maxWidth = '380px', title, showClose = true, danger = false, dangerColor, onBack, closeRef }: Props) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(isOpen);
  const [closing, setClosing] = useState(false);
  const [entered, setEntered] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const handleClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
  }, [closing]);

  useEffect(() => {
    if (closeRef) closeRef.current = handleClose;
  }, [closeRef, handleClose]);

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      setClosing(false);
      setEntered(false);
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setEntered(true);
        });
      });
      return () => cancelAnimationFrame(raf);
    }
    return undefined;
  }, [isOpen]);

  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => {
      setVisible(false);
      setClosing(false);
      setEntered(false);
      onCloseRef.current();
    }, 400);
    return () => clearTimeout(timer);
  }, [closing]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  if (!visible) return null;

  return (
    <div
      className={`${styles.overlay} ${entered && !closing ? styles.open : ''} ${closing ? styles.closing : ''}`}
      onClick={handleClose}
    >
      <div
        className={`${styles.content} ${danger ? styles.dangerBorder : ''}`}
        style={{ maxWidth }}
        onClick={e => e.stopPropagation()}
      >
        {onBack && (
          <button className={styles.backBtn} onClick={onBack}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}
        {title && (
          <h3
            className={styles.title}
            style={danger ? { color: dangerColor || '#ff3b30' } : undefined}
          >
            {t(title)}
          </h3>
        )}
        {children}
        {showClose && (
          <button className={styles.closeBtn} onClick={handleClose}>
            {t('Закрыть')}
          </button>
        )}
      </div>
    </div>
  );
}
