import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import type { ContactItem } from '../../types/user';
import { useI18n } from '../../hooks/useI18n';
import styles from './ForwardModal.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  contacts: ContactItem[];
  me: string;
  onConfirm: (targetUser: string) => void;
  closeRef?: React.MutableRefObject<(() => void) | null>;
}

function getAvatarColor(name: string): string {
  const colors = ['#f44336', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#009688', '#4caf50', '#ff9800'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length] ?? '#9c27b0';
}

export default function ForwardModal({ isOpen, onClose, contacts, me, onConfirm, closeRef }: Props) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [entered, setEntered] = useState(false);
  const [closing, setClosing] = useState(false);
  const [search, setSearch] = useState('');
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
      setSearch('');
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setEntered(true));
      });
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
    setClosing(false);
    setEntered(false);
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
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [handleClose]);

  const meLower = me.toLowerCase();

  const filteredContacts = useMemo(() => {
    return contacts
      .filter(c => !(c.isRoom && c.roomType === 'channel'))
      .filter(c => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        const name = (c.displayName || c.username || '').toLowerCase();
        return name.includes(q);
      });
  }, [contacts, search]);

  const handleConfirm = useCallback((username: string) => {
    onConfirm(username);
  }, [onConfirm]);

  if (!visible) return null;

  return (
    <div
      className={`${styles.overlay} ${entered && !closing ? styles.open : ''} ${closing ? styles.closing : ''}`}
      onClick={handleClose}
    >
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h3 className={styles.title}>{t('Переслать в...')}</h3>

        <input
          className={styles.search}
          placeholder={t('Поиск контакта...')}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <div className={styles.list}>
          {filteredContacts.map(c => {
            const isSaved = c.username.toLowerCase() === meLower;
            const displayName = c.displayName || c.username || c.username;
            return (
              <div
                key={c.username}
                className={styles.row}
                onClick={() => handleConfirm(c.username)}
              >
                <div className={styles.avatar}>
                  {isSaved ? (
                    <div className={styles.savedIcon}>
                      <svg viewBox="0 0 24 24" className={styles.savedSvg}>
                        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                      </svg>
                    </div>
                  ) : c.avatar && c.avatar !== 'null' && c.avatar !== '' ? (
                    <img src={c.avatar} alt="" loading="lazy" decoding="async" className={styles.avatarImg} />
                  ) : (
                    <div
                      className={styles.avatarPlaceholder}
                      style={{ background: getAvatarColor(c.username) }}
                    >
                      {(displayName).charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className={styles.name}>
                  {isSaved ? t('Избранное') : displayName}
                </div>
              </div>
            );
          })}
        </div>

        <button className={styles.cancelBtn} onClick={handleClose}>
          {t('ОТМЕНА')}
        </button>
      </div>
    </div>
  );
}
