import { useState, useCallback, useRef, useEffect } from 'react';
import { useI18n } from '../../hooks/useI18n';
import { api } from '../../services/api';
import { getSocket } from '../../services/socket';
import styles from './CreateGroupModal.module.css';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (groupId: string) => void;
}

type RoomType = 'group' | 'channel';
type RoomPrivacy = 'private' | 'public';

export default function CreateGroupModal({ isOpen, onClose, onCreated }: CreateGroupModalProps) {
  const { t } = useI18n();
  const [roomType, setRoomType] = useState<RoomType>('group');
  const [roomPrivacy, setRoomPrivacy] = useState<RoomPrivacy>('private');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [closing, setClosing] = useState(false);
  const [visible, setVisible] = useState(isOpen);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      setClosing(false);
      setEntered(false);
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setEntered(true));
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
      onClose();
    }, 400);
    return () => clearTimeout(timer);
  }, [closing, onClose]);

  const handleClose = useCallback(() => {
    if (closing) return;
    setName('');
    setDescription('');
    setAvatarPreview(null);
    setAvatarFile(null);
    setClosing(true);
  }, [closing]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [handleClose]);

  const handleAvatarClick = useCallback(() => { fileInputRef.current?.click(); }, []);

  const handleAvatarChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleCreate = useCallback(async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      let avatarUrl = '';
      if (avatarFile) {
        const fd = new FormData();
        fd.append('file', avatarFile);
        const upRes = await api.upload('/upload', fd) as { url?: string };
        if (upRes.url) avatarUrl = upRes.url;
      }
      const socket = getSocket();
      socket.emit('create_room', {
        name: name.trim(),
        description: description.trim(),
        type: roomType,
        isPublic: roomPrivacy === 'public',
        avatar: avatarUrl,
      });
      const onListUpdated = () => {
        socket.off('update_chat_list', onListUpdated);
        clearTimeout(fallback);
        setName('');
        setDescription('');
        setAvatarPreview(null);
        setAvatarFile(null);
        setLoading(false);
        handleClose();
        onCreated('');
      };
      const fallback = setTimeout(onListUpdated, 4000);
      socket.on('update_chat_list', onListUpdated);
    } catch (err) {
      console.error('Failed to create room:', err);
      setLoading(false);
    }
  }, [name, description, roomType, roomPrivacy, avatarFile, onCreated, handleClose]);

  if (!visible) return null;

  return (
    <div className={`${styles.overlay} ${entered && !closing ? styles.open : ''} ${closing ? styles.closing : ''}`}
      onClick={handleClose}>
      <div className={`${styles.modal} ${entered && !closing ? styles.modalOpen : ''} ${closing ? styles.modalClosing : ''}`}
        onClick={e => e.stopPropagation()}>
        <h3 className={styles.title}>{t('Создать')}</h3>

        <div className={styles.avatarCircle} onClick={handleAvatarClick}>
          {avatarPreview ? (
            <img src={avatarPreview} alt="" className={styles.avatarImg} />
          ) : (
            <svg viewBox="0 0 24 24" className={styles.avatarIcon}>
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          )}
        </div>
        <input ref={fileInputRef} type="file" hidden accept="image/*" onChange={handleAvatarChange} />

        <input className={styles.input} type="text" maxLength={30}
          placeholder={t('Название')} value={name}
          onChange={e => setName(e.target.value)} />

        <textarea className={styles.textarea} maxLength={100}
          placeholder={t('Описание')} value={description}
          onChange={e => setDescription(e.target.value)} />

        <div className={styles.toggleGroup}>
          <button className={`${styles.toggleBtn} ${roomType === 'group' ? styles.toggleActive : ''}`}
            onClick={() => setRoomType('group')}>{t('Группа')}</button>
          <button className={`${styles.toggleBtn} ${roomType === 'channel' ? styles.toggleActive : ''}`}
            onClick={() => setRoomType('channel')}>{t('Канал')}</button>
        </div>

        <div className={styles.toggleGroup}>
          <button className={`${styles.toggleBtn} ${roomPrivacy === 'private' ? styles.toggleActive : ''}`}
            onClick={() => setRoomPrivacy('private')}>{t('Частный')}</button>
          <button className={`${styles.toggleBtn} ${roomPrivacy === 'public' ? styles.toggleActive : ''}`}
            onClick={() => setRoomPrivacy('public')}>{t('Публичный')}</button>
        </div>

        <div className={styles.buttonRow}>
          <button className={styles.createBtn} onClick={handleCreate} disabled={!name.trim() || loading}>
            {loading ? t('...') : t('СОЗДАТЬ')}
          </button>
          <button className={styles.cancelBtn} onClick={handleClose}>{t('ОТМЕНА')}</button>
        </div>
      </div>
    </div>
  );
}
