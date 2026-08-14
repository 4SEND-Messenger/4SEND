import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../../hooks/useI18n';
import { useSettings } from '../../context/SettingsContext';
import { getSocket } from '../../services/socket';
import { api } from '../../services/api';
import styles from './ChatHeaderMenu.module.css';

const AUTO_DELETE_LABELS: Record<number, string> = {
  0: 'Выключено',
  604800: '1 неделя',
  2592000: '1 месяц',
  7776000: '3 месяца',
  31536000: '1 год',
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  target: string;
  me: string;
  meLower: string;
  isMuted: boolean;
  isBlocked: boolean;
  isSystemBot?: boolean;
  autoDeleteTimer?: number;
  onMuteToggle: () => void;
  onBlockChange: (blocked: boolean) => void;
  onDeleteChat: () => void;
  onSearch: () => void;
  onStats: () => void;
  onE2EESecret?: () => void;
  onAutoDelete: () => void;
  onProfile: () => void;
  onMembers: () => void;
  onClearHistory: () => void;
  showToast: (msg: string, isError?: boolean) => void;
}

export default function ChatHeaderMenu({
  isOpen, onClose, target, me, meLower,
  isMuted, isBlocked, isSystemBot, autoDeleteTimer = 0,
  onMuteToggle, onBlockChange, onDeleteChat, onSearch, onStats,
  onE2EESecret,
  onAutoDelete, onProfile, onMembers, onClearHistory, showToast
}: Props) {
  const { t } = useI18n();
  const { menuItems } = useSettings();
  const [closing, setClosing] = useState(false);
  const [visible, setVisible] = useState(isOpen);

  const base = menuItems?.chat_header || ['search', 'mute', 'block', 'autoDelete', 'stats', 'profile', 'members', 'delete_chat'];
  const order = base.includes('e2ee') ? base : base.flatMap(id => id === 'stats' ? ['e2ee', 'stats'] : [id]);

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      setClosing(false);
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      setVisible(false);
      onClose();
    }, 200);
  }, [onClose]);

  const handleAction = useCallback((action: string) => {
    const socket = getSocket();
    switch (action) {
      case 'mute':
        socket.emit('toggle_mute', { contact: target, me });
        onMuteToggle();
        showToast(isMuted ? t('Уведомления включены') : t('Уведомления отключены'));
        break;
      case 'block':
        (async () => {
          const res = await api.post<{ status: string }>('/api/toggle-block', { me, target });
          const nowBlocked = res.status === 'blocked';
          onBlockChange(nowBlocked);
          showToast(nowBlocked ? t('Пользователь заблокирован') : t('Пользователь разблокирован'));
        })();
        break;
      case 'delete':
        onDeleteChat();
        break;
      case 'search':
        onSearch();
        break;
      case 'stats':
        onStats();
        break;
      case 'e2ee':
        onE2EESecret?.();
        break;
      case 'autoDelete':
        onAutoDelete();
        break;
      case 'profile':
        onProfile();
        break;
      case 'members':
        onMembers();
        break;
      case 'clearHistory':
        socket.emit('clear_history', { user: meLower, contact: target });
        onClearHistory();
        showToast(t('История очищена'));
        break;
    }
    handleClose();
  }, [handleClose, target, me, meLower, isMuted, onMuteToggle, onBlockChange, onDeleteChat, onSearch, onStats, onAutoDelete, onProfile, onMembers, onClearHistory, showToast, t]);

  const itemMap: Record<string, React.ReactNode> = {
    search: (
      <button className={styles.menuItem} onClick={() => handleAction('search')}>
        <div className={styles.iconBox}>
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
        </div>
        <span className={styles.menuLabel}>{t('Поиск в чате')}</span>
      </button>
    ),
    mute: (
      <button className={styles.menuItem} onClick={() => handleAction('mute')}>
        <div className={styles.iconBox}>
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            {isMuted ? (
              <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
            ) : (
              <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
            )}
          </svg>
        </div>
        <span className={styles.menuLabel}>{isMuted ? t('Включить уведомления') : t('Отключить уведомления')}</span>
      </button>
    ),
    block: !isSystemBot ? (
      <button className={styles.menuItem} onClick={() => handleAction('block')}>
        <div className={styles.iconBox}>
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1C19.37 8.45 20 10.15 20 12c0 4.42-3.58 8-8 8z" />
          </svg>
        </div>
        <span className={styles.menuLabel}>{isBlocked ? t('Разблокировать') : t('Заблокировать')}</span>
      </button>
    ) : null,
    autoDelete: (
      <button className={styles.menuItem} onClick={() => handleAction('autoDelete')}>
        <div className={styles.iconBox}>
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <path d="M19 4h-3.5l-1-1h-5l-1 1H5v2h14V4zM6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12z" />
          </svg>
        </div>
        <span className={styles.menuLabel}>
          <span>{t('Автоудаление')}</span>
          <span className={styles.menuHint}>{t(AUTO_DELETE_LABELS[autoDeleteTimer] || '')}</span>
        </span>
      </button>
    ),
    e2ee: onE2EESecret ? (
      <button className={styles.menuItem} onClick={() => handleAction('e2ee')}>
        <div className={styles.iconBox}>
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z" />
          </svg>
        </div>
        <span className={styles.menuLabel}>{t('Секретный чат')}</span>
      </button>
    ) : null,
    stats: (
      <button className={styles.menuItem} onClick={() => handleAction('stats')}>
        <div className={styles.iconBox}>
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
          </svg>
        </div>
        <span className={styles.menuLabel}>{t('Статистика')}</span>
      </button>
    ),
    delete_chat: (
      <>
        <div className={styles.divider} />
        <button className={`${styles.menuItem} ${styles.danger}`} onClick={() => handleAction('delete')}>
          <div className={`${styles.iconBox} ${styles.dangerIcon}`}>
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
            </svg>
          </div>
          <span className={`${styles.menuLabel} ${styles.dangerText}`}>{t('Удалить чат')}</span>
        </button>
      </>
    ),
  };

  if (!visible) return null;

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div
        className={`${styles.menu} ${closing ? styles.closing : ''}`}
        onClick={e => e.stopPropagation()}
      >
        {order.map(id => {
          const el = itemMap[id];
          return el ? <div key={id}>{el}</div> : null;
        })}
      </div>
    </div>
  );
}
