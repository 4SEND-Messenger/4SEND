import { useState, useCallback, useEffect } from 'react';
import ModalShell from '../settings/ModalShell';
import { useI18n } from '../../hooks/useI18n';
import { getFolders, saveFolders, createFolder, FOLDER_ICONS, type ChatFolder } from '../../utils/folders';
import styles from './FolderEditModal.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onChanged: () => void;
}

const ICON_IDS = Object.keys(FOLDER_ICONS);

const ICON_COLORS: Record<string, string> = {
  work: '#a74fff',
  people: '#34c759',
  family: '#ff6b6b',
  heart: '#ff3b30',
  star: '#ffd60a',
  book: '#5ac8fa',
  music: '#ff9500',
  sport: '#34aadc',
  travel: '#007aff',
  cart: '#ff9500',
  bolt: '#ffcc02',
  bell: '#e91e63',
  lock: '#af52de',
  tag: '#00c7be',
  photo: '#30d158',
  chat: '#5ac8fa',
};

const ICON_BG: Record<string, string> = {
  work: 'rgba(167,79,255,0.15)',
  people: 'rgba(52,199,89,0.15)',
  family: 'rgba(255,107,107,0.15)',
  heart: 'rgba(255,59,48,0.15)',
  star: 'rgba(255,214,10,0.15)',
  book: 'rgba(90,200,250,0.15)',
  music: 'rgba(255,149,0,0.15)',
  sport: 'rgba(52,170,220,0.15)',
  travel: 'rgba(0,122,255,0.15)',
  cart: 'rgba(255,149,0,0.15)',
  bolt: 'rgba(255,204,2,0.15)',
  bell: 'rgba(233,30,99,0.15)',
  lock: 'rgba(175,82,222,0.15)',
  tag: 'rgba(0,199,190,0.15)',
  photo: 'rgba(48,209,88,0.15)',
  chat: 'rgba(90,200,250,0.15)',
};

const ICON_LABELS: Record<string, string> = {
  work: 'Работа',
  people: 'Люди',
  family: 'Семья',
  heart: 'Избранное',
  star: 'Важное',
  book: 'Книги',
  music: 'Музыка',
  sport: 'Спорт',
  travel: 'Путешествия',
  cart: 'Покупки',
  bolt: 'Быстрое',
  bell: 'Оповещения',
  lock: 'Приватное',
  tag: 'Теги',
  photo: 'Фото',
  chat: 'Чаты',
};

export default function FolderEditModal({ isOpen, onClose, onChanged }: Props) {
  const { t } = useI18n();
  const [folders, setFolders] = useState<ChatFolder[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState(ICON_IDS[0]);

  useEffect(() => {
    if (isOpen) {
      setFolders(getFolders());
      setCreating(false);
      setNewName('');
      setNewIcon(ICON_IDS[0]);
    }
  }, [isOpen]);

  const persist = useCallback((next: ChatFolder[]) => {
    setFolders(next);
    saveFolders(next);
    onChanged();
  }, [onChanged]);

  const handleCreate = useCallback(() => {
    const name = newName.trim();
    if (!name) return;
    persist([...folders, createFolder(name, newIcon)]);
    setCreating(false);
    setNewName('');
  }, [newName, newIcon, folders, persist]);

  const handleDelete = useCallback((id: string) => {
    persist(folders.filter(f => f.id !== id));
  }, [folders, persist]);

  const handleMove = useCallback((index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= folders.length) return;
    const next = [...folders];
    [next[index], next[target]] = [next[target], next[index]];
    persist(next);
  }, [folders, persist]);

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title={t('Управление папками')} maxWidth="420px">
      <div className={styles.list}>
        {folders.map((f, i) => (
          <div key={f.id} className={styles.folderRow}>
            <button className={styles.moveBtn} onClick={() => handleMove(i, -1)} disabled={i === 0}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="18 15 12 9 6 15" /></svg>
            </button>
            <button className={styles.moveBtn} onClick={() => handleMove(i, 1)} disabled={i === folders.length - 1}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>
            </button>
            <div className={styles.folderIconWrap} style={{ background: ICON_BG[f.icon || ICON_IDS[0]] || ICON_BG[ICON_IDS[0]], color: ICON_COLORS[f.icon || ICON_IDS[0]] || ICON_COLORS[ICON_IDS[0]] }}>
              <FolderIcon iconId={f.icon || ICON_IDS[0]} />
            </div>
            <span className={styles.folderName}>{f.name}</span>
            <span className={styles.chatCount}>{f.chatUsernames.length}</span>
            <button className={styles.deleteBtn} onClick={() => handleDelete(f.id)}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
        ))}
      </div>

      {creating ? (
        <div className={styles.createForm}>
          <div className={styles.iconPicker}>
            {ICON_IDS.map(id => (
              <button
                key={id}
                className={`${styles.iconBtn} ${id === newIcon ? styles.iconActive : ''}`}
                style={id === newIcon ? { borderColor: ICON_COLORS[id], background: ICON_BG[id] } : {}}
                onClick={() => setNewIcon(id)}
                title={t(ICON_LABELS[id])}
              >
                <FolderIcon iconId={id} />
              </button>
            ))}
          </div>
          <input
            className={styles.nameInput}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder={t('Название папки')}
            maxLength={20}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
          />
          <div className={styles.createActions}>
            <button className={styles.cancelBtn} onClick={() => setCreating(false)}>{t('Отмена')}</button>
            <button className={styles.createBtn} onClick={handleCreate} disabled={!newName.trim()}>{t('Создать')}</button>
          </div>
        </div>
      ) : (
        <button className={styles.addFolderBtn} onClick={() => setCreating(true)}>
          + {t('Создать папку')}
        </button>
      )}

      <div className={styles.hint}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
        <span>{t('Папки хранятся локально и не синхронизируются между устройствами')}</span>
      </div>
    </ModalShell>
  );
}

function FolderIcon({ iconId }: { iconId: string }) {
  const path = FOLDER_ICONS[iconId] || FOLDER_ICONS[Object.keys(FOLDER_ICONS)[0]];
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d={path} />
    </svg>
  );
}
