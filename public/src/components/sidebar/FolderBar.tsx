import { useMemo } from 'react';
import { useChat } from '../../context/ChatContext';
import { getFolders, FOLDER_ICONS } from '../../utils/folders';
import { useI18n } from '../../hooks/useI18n';
import styles from './FolderBar.module.css';

interface Props {
  activeFolderId: string | null;
  onSelectFolder: (id: string | null) => void;
  onEdit: () => void;
}

export default function FolderBar({ activeFolderId, onSelectFolder, onEdit }: Props) {
  const { contacts } = useChat();
  const { t } = useI18n();

  const folders = getFolders();

  const unreadCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of folders) {
      counts[f.id] = contacts.filter(c => f.chatUsernames.includes(c.username)).reduce((sum, c) => sum + (c.unreadCount || 0), 0);
    }
    return counts;
  }, [folders, contacts]);

  const allUnread = useMemo(() => contacts.reduce((sum, c) => sum + (c.unreadCount || 0), 0), [contacts]);

  return (
    <div className={styles.folderBar}>
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeFolderId === null ? styles.active : ''}`}
          onClick={() => onSelectFolder(null)}
        >
          {t('Все')}
          {allUnread > 0 && <span className={styles.badge}>{allUnread}</span>}
        </button>
        {folders.map(f => (
          <button
            key={f.id}
            className={`${styles.tab} ${activeFolderId === f.id ? styles.active : ''}`}
            onClick={() => onSelectFolder(f.id)}
          >
            <span className={styles.tabIcon}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d={FOLDER_ICONS[f.icon] || ''} /></svg>
            </span>
            <span>{f.name}</span>
            {unreadCounts[f.id] > 0 && (
              <span className={styles.badge}>{unreadCounts[f.id]}</span>
            )}
          </button>
        ))}
      </div>
      <button className={styles.addBtn} onClick={onEdit} title={t('Управление папками')}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
}
