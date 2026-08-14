import { useMemo, useState } from 'react';
import { useI18n } from '../../hooks/useI18n';
import { getFolders, getFolderForChat, addChatToFolder, removeChatFromFolder, type ChatFolder } from '../../utils/folders';
import styles from './ChatContextMenu.module.css';

interface Props {
  x: number;
  y: number;
  username: string;
  isPinned?: boolean;
  isMuted?: boolean;
  onClose: () => void;
  onPin: () => void;
  onMute: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

export default function ChatContextMenu({ x, y, username, isPinned, isMuted, onClose, onPin, onMute, onArchive, onDelete }: Props) {
  const { t } = useI18n();
  const [showFolders, setShowFolders] = useState(false);

  const folders = useMemo(() => getFolders(), []);
  const currentFolder = useMemo(() => getFolderForChat(username), [username]);

  const top = Math.min(y, window.innerHeight - (showFolders ? 280 : 220));
  const maxHeight = window.innerHeight - top - 20;

  const handleSelectFolder = (folderId: string | null) => {
    if (folderId) {
      addChatToFolder(username, folderId);
    } else {
      removeChatFromFolder(username);
    }
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.menu}
        style={{ top, left: Math.min(x, window.innerWidth - 220), maxHeight }}
        onClick={e => e.stopPropagation()}
      >
        {showFolders ? (
          <>
            <div className={styles.menuItem} onClick={() => setShowFolders(false)}>
              <svg viewBox="0 0 24 24" className={styles.menuIcon}>
                <polyline points="15 18 9 12 15 6" />
              </svg>
              {t('Назад')}
            </div>
            <div className={styles.menuDivider} />
            {currentFolder && (
              <div className={styles.menuItem} onClick={() => handleSelectFolder(null)}>
                <svg viewBox="0 0 24 24" className={styles.menuIcon}>
                  <path d="M12 5v14M5 12h14" />
                </svg>
                {t('Убрать из папки')}
              </div>
            )}
            {folders.map(f => (
              <div
                key={f.id}
                className={`${styles.menuItem} ${currentFolder?.id === f.id ? styles.menuItemActive : ''}`}
                onClick={() => handleSelectFolder(f.id)}
              >
                <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{f.icon}</span>
                <span style={{ flex: 1 }}>{f.name}</span>
                {currentFolder?.id === f.id && (
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--accent-solid)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            ))}
          </>
        ) : (
          <>
            <div className={styles.menuItem} onClick={onPin}>
              <svg viewBox="0 0 24 24" className={styles.menuIcon}>
                <path d="M16 5h.99L17 3H7v2h1v7l-2 2v2h5v6l1 1 1-1v-6h5v-2l-2-2V5z" />
              </svg>
              {isPinned ? t('Открепить') : t('Закрепить')}
            </div>
            <div className={styles.menuItem} onClick={onMute}>
              <svg viewBox="0 0 24 24" className={styles.menuIcon}>
                {isMuted ? (
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                ) : (
                  <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
                )}
              </svg>
              {isMuted ? t('Включить уведомления') : t('Выключить уведомления')}
            </div>
            <div className={styles.menuItem} onClick={() => setShowFolders(true)}>
              <svg viewBox="0 0 24 24" className={styles.menuIcon}>
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <span style={{ flex: 1 }}>{t('Папка')}</span>
              {currentFolder && (
                <span style={{ fontSize: 12, color: '#888', marginLeft: 'auto' }}>{currentFolder.icon}</span>
              )}
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: '#555' }}>
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
            <div className={styles.menuItem} onClick={onArchive}>
              <svg viewBox="0 0 24 24" className={styles.menuIcon}>
                <path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" />
              </svg>
              {t('Архивировать')}
            </div>
            <div className={`${styles.menuItem} ${styles.danger}`} onClick={onDelete}>
              <svg viewBox="0 0 24 24" className={`${styles.menuIcon} ${styles.dangerIcon}`}>
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
              </svg>
              {t('Удалить чат')}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
