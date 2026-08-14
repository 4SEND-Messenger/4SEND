import { useState, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '../../hooks/useI18n';
import styles from './ProfileMoreMenu.module.css';

interface ProfileMoreMenuProps {
  isOpen: boolean;
  onClose: () => void;
  isBlocked: boolean;
  onBlock: () => void;
  onPrivacy: () => void;
  buttonRect: DOMRect;
}

export default function ProfileMoreMenu({
  isOpen,
  onClose,
  isBlocked,
  onBlock,
  onPrivacy,
  buttonRect,
}: ProfileMoreMenuProps) {
  const { t } = useI18n();
  const [closing, setClosing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const closingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  onCloseRef.current = onClose;

  const startClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    timerRef.current = setTimeout(() => {
      onCloseRef.current();
    }, 200);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        startClose();
      }
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [isOpen, startClose]);

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  const handleBlock = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onBlock();
    startClose();
  }, [onBlock, startClose]);

  const handlePrivacy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onPrivacy();
    startClose();
  }, [onPrivacy, startClose]);

  if (!isOpen) return null;

  const top = buttonRect.bottom + 5;
  const left = buttonRect.right - 200;

  return (
    <div
      ref={menuRef}
      className={`${styles.menu}${closing ? ` ${styles.closing}` : ''}`}
      style={{ left, top, transformOrigin: 'top right' }}
    >
      <button className={`${styles.item} ${styles.danger}`} onClick={handleBlock}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          {isBlocked
            ? <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            : <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z" />
          }
        </svg>
        {isBlocked ? t('Разблокировать') : t('Заблокировать')}
      </button>
      <button className={styles.item} onClick={handlePrivacy}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          <line x1="3" y1="3" x2="21" y2="21" />
        </svg>
        {t('Приватность чата')}
      </button>
    </div>
  );
}
