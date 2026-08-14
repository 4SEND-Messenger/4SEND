import { useState, useCallback, useEffect, useRef } from 'react';
import { useI18n } from '../../hooks/useI18n';
import { useAuthContext } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { useChats } from '../../hooks/useChats';
import { api } from '../../services/api';
import { getSocket } from '../../services/socket';
import { globalLocale } from '../../services/storage';
import ProfileMoreMenu from './ProfileMoreMenu';
import ChatPrivacyModal from './ChatPrivacyModal';
import ProfileMediaGrid from './ProfileMediaGrid';
import MediaGallery from './MediaGallery';
import Lightbox from './Lightbox';
import styles from './ProfileModal.module.css';

interface Props {
  username: string;
  displayName?: string;
  avatar?: string;
  bio?: string;
  lastSeen?: string;
  isOnline?: boolean;
  isVerified?: boolean;
  isBlocked?: boolean;
  isRoom?: boolean;
  roomType?: 'group' | 'channel';
  roomDescription?: string;
  onClose: () => void;
  onBlockChange?: (blocked: boolean) => void;
  onChat?: () => void;
  onDeleteChat?: () => void;
  onPrivacyChange?: (type: 'copy' | 'forward' | 'screenshot', state: boolean) => void;
  onGoToMessage?: (msgId: string) => void;
  onEditProfile?: () => void;
  onRoomSettings?: () => void;
}

export default function ProfileModal({ username, displayName, avatar, bio, lastSeen, isOnline, isVerified, isBlocked = false, isRoom, roomType, roomDescription, onClose, onBlockChange, onChat, onDeleteChat, onPrivacyChange, onGoToMessage, onEditProfile, onRoomSettings }: Props) {
  const { t } = useI18n();
  const { me } = useAuthContext();
  const { showToast } = useUI();
  const { contacts } = useChats();
  const [blocked, setBlocked] = useState(isBlocked);
  const [isMuted, setIsMuted] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [moreMenuRect, setMoreMenuRect] = useState<DOMRect | null>(null);
  const [galleryType, setGalleryType] = useState<'photos' | 'videos' | 'voices' | 'music' | 'files' | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [privacyValues, setPrivacyValues] = useState<{ copy: boolean; forward: boolean; screenshot: boolean }>({ copy: false, forward: false, screenshot: false });
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const closingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const handleClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    timerRef.current = setTimeout(() => {
      onCloseRef.current();
    }, 300);
  }, []);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !galleryType) handleClose();
    };
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('keydown', onEsc);
    };
  }, [handleClose, galleryType]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setVisible(true);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!me || !username) return;
    const meLower = me.toLowerCase();
    const targetLower = username.toLowerCase();
    if (meLower === targetLower) return;
    const contact = contacts.find((c: { username: string }) => c.username.toLowerCase() === targetLower);
    setIsMuted(!!contact?.is_muted);
  }, [me, username, contacts]);

  const handleOpenPrivacy = useCallback(async () => {
    setShowMoreMenu(false);
    setShowPrivacyModal(true);
    setPrivacyValues({ copy: false, forward: false, screenshot: false });
    try {
      const status = await api.get<{ copyRestriction?: boolean; forwardRestriction?: boolean; screenshotNotification?: boolean }>(`/api/status/${encodeURIComponent(username)}?me=${encodeURIComponent(me || '')}`);
      setPrivacyValues({
        copy: !!status?.copyRestriction,
        forward: !!status?.forwardRestriction,
        screenshot: !!status?.screenshotNotification,
      });
    } catch {
      setPrivacyValues({ copy: false, forward: false, screenshot: false });
    }
  }, [username, me]);

  const getInitial = (name: string) => name?.charAt(0)?.toUpperCase() || '?';

  const statusColor = isOnline ? '#4caf50' : 'var(--text-muted)';
  const isMe = me?.toLowerCase() === username.toLowerCase();
  const isSystem = username.toLowerCase() === '4send_system' || username.toLowerCase() === '4send_help';

  const getStatusText = () => {
    if (isMe) return t('Это вы');
    if (isOnline) return t('в сети');
    if (lastSeen) {
      const d = new Date(lastSeen);
      if (!isNaN(d.getTime())) {
        const isToday = d.toDateString() === new Date().toDateString();
        const timeStr = d.toLocaleTimeString(globalLocale(), { hour: '2-digit', minute: '2-digit' });
        return isToday ? `${t('был(а)')} в ${timeStr}` : `${t('был(а)')} ${d.toLocaleDateString(globalLocale(), { day: 'numeric', month: 'long' })} в ${timeStr}`;
      }
    }
    return t('был(а) недавно');
  };

  const handleBlock = useCallback(async () => {
    try {
      const res = await api.post<{ status: string }>('/api/toggle-block', { me, target: username });
      const newBlocked = res.status === 'blocked';
      setBlocked(newBlocked);
      if (newBlocked) {
        showToast(t('Пользователь заблокирован'), true);
      } else {
        showToast(t('Пользователь разблокирован'), false);
      }
      onBlockChange?.(newBlocked);
    } catch {}
  }, [me, username, onBlockChange]);

  const handleToggleMute = useCallback(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('toggle_mute', { contact: username, me });
    setIsMuted(prev => !prev);
  }, [username, me]);

  const handleMoreClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setMoreMenuRect(e.currentTarget.getBoundingClientRect());
    setShowMoreMenu(true);
  }, []);

  const handleChatClick = useCallback(() => {
    handleClose();
    onChat?.();
  }, [handleClose, onChat]);

  const handleDeleteClick = useCallback(() => {
    handleClose();
    onDeleteChat?.();
  }, [handleClose, onDeleteChat]);

  let overlayClass = styles.overlay;
  if (closing) overlayClass += ` ${styles.closing}`;
  else if (visible) overlayClass += ` ${styles.active}`;

  const showActions = !isMe && !isSystem;

  return (
    <div className={overlayClass} onClick={handleClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.closeX} onClick={handleClose}>&#10005;</button>

        <div className={styles.avatarWrap}>
          <div className={styles.avatarSection}>
            {isMe ? (
              <div className={styles.avatarPlaceholder} style={{ background: 'var(--accent-solid)', color: 'var(--on-accent, #fff)' }}>
                <svg viewBox="0 0 24 24" style={{ width: '60%', height: '60%', fill: 'currentColor' }}>
                  <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                </svg>
              </div>
            ) : avatar ? (
              <img src={avatar} alt="" className={styles.avatarImg} />
            ) : (
              <div className={styles.avatarPlaceholder}>
                {getInitial(displayName || username)}
              </div>
            )}
          </div>

          <div className={styles.displayName}>
            {isMe ? t('Избранное') : (displayName || username)}
            {isVerified && (
              <svg viewBox="0 0 24 24" className={styles.verifiedIcon}>
                <path d="M23 11.99l-2.44-2.79.34-3.69-3.61-.82-1.89-3.2L12 2.96 8.6 1.5 6.71 4.69 3.1 5.5l.34 3.7L1 11.99l2.44 2.79-.34 3.7 3.61.82L8.6 22.5l3.4-1.47 3.4 1.46 1.89-3.19 3.61-.82-.34-3.69L23 11.99zm-12.93 4.46l-3.53-3.54 1.41-1.41 2.12 2.12 4.24-4.24 1.41 1.41-5.65 5.66z" />
              </svg>
            )}
            {isMuted && (
              <svg viewBox="0 0 24 24" className={styles.mutedIcon}>
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
              </svg>
            )}
          </div>

          {isSystem && (
            <div className={styles.username}>{t('Системный бот')}</div>
          )}
          {isMe && (
            <div className={styles.username}>{t('Сохраненные сообщения')}</div>
          )}
          {isMe && onEditProfile && (
            <button className={styles.editProfileBtn} onClick={() => { handleClose(); onEditProfile(); }}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
              </svg>
              {t('Редактировать профиль')}
            </button>
          )}
          {isRoom && roomType && (
            <div className={`${styles.username} ${styles.roomBadge}`}>
              <span className={styles.roomBadgeDot} />
              {roomType === 'channel' ? t('Канал') : t('Группа')}
            </div>
          )}
          {!isSystem && !isMe && !isRoom && (
            <div className={styles.username}>@{username}</div>
          )}

          {!isSystem && !isMe && !isRoom && (
            <div className={styles.status} style={{ color: statusColor }}>{getStatusText()}</div>
          )}
          {isRoom && roomDescription && (
            <div className={styles.bioText} style={{ marginTop: 8, textAlign: 'center' }}>{roomDescription}</div>
          )}
        </div>

        {showActions && !isRoom && (
          <div className={styles.actionRow}>
            <div className={styles.actionBtn} onClick={handleChatClick}>
              <svg viewBox="0 0 24 24" className={styles.actionIcon}>
                <path d="M12 3c5.5 0 10 4.5 10 10s-4.5 10-10 10c-1.7 0-3.3-.4-4.8-1.1l-4.2 1.1 1.1-4.2C3.4 17.3 3 15.7 3 13 3 7.5 7.5 3 12 3z"/>
              </svg>
              <span className={styles.actionLabel}>{t('Чат')}</span>
            </div>

            <div className={styles.actionBtn} onClick={handleToggleMute}>
              {isMuted ? (
                <svg viewBox="0 0 24 24" className={styles.actionIcon}>
                  <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6zM4.41 2.86L3 4.27l16.73 16.73 1.41-1.41L4.41 2.86z"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className={styles.actionIcon}>
                  <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
                </svg>
              )}
              <span className={styles.actionLabel}>{t('Звук')}</span>
            </div>

            <div className={styles.actionBtn} onClick={handleDeleteClick}>
              <svg viewBox="0 0 24 24" className={styles.actionIcon} style={{ fill: 'var(--error)' }}>
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
              </svg>
              <span className={styles.actionLabel} style={{ color: 'var(--error)' }}>{t('Удалить')}</span>
            </div>

            <div className={styles.actionBtn} onClick={handleMoreClick}>
              <svg viewBox="0 0 24 24" className={styles.actionIcon}>
                <path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
              </svg>
              <span className={styles.actionLabel}>{t('Ещё')}</span>
            </div>
          </div>
        )}

        {isRoom && onRoomSettings && (
          <div className={styles.actionRow} style={{ justifyContent: 'center' }}>
            <div className={styles.actionBtn} onClick={() => { handleClose(); onRoomSettings(); }}>
              <svg viewBox="0 0 24 24" className={styles.actionIcon}>
                <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
              </svg>
              <span className={styles.actionLabel}>{t('Управление')}</span>
            </div>
          </div>
        )}

        {bio && !isRoom && (
          <div className={styles.bioSection}>
            <div className={styles.sectionLabel}>{t('О себе')}</div>
            <div className={styles.bioText}>{bio}</div>
          </div>
        )}

        {!isRoom && (
          <div className={styles.mediaSection}>
            <ProfileMediaGrid target={username} onMediaClick={setGalleryType} />
          </div>
        )}
      </div>

      {galleryType && (
        <MediaGallery isOpen={!!galleryType} onClose={() => setGalleryType(null)} target={username} type={galleryType} onGoToMessage={onGoToMessage} onOpenLightbox={(src) => setLightboxSrc(src)} isLightboxOpen={!!lightboxSrc} />
      )}

      {lightboxSrc && (
        <Lightbox isOpen={!!lightboxSrc} onClose={() => setLightboxSrc(null)} src={lightboxSrc} />
      )}

      {showMoreMenu && moreMenuRect && (
        <ProfileMoreMenu
          isOpen={showMoreMenu}
          onClose={() => setShowMoreMenu(false)}
          isBlocked={blocked}
          onBlock={handleBlock}
          onPrivacy={handleOpenPrivacy}
          buttonRect={moreMenuRect}
        />
      )}

      {showPrivacyModal && (
        <ChatPrivacyModal
          isOpen={showPrivacyModal}
          onClose={() => setShowPrivacyModal(false)}
          target={username}
          copyRestricted={privacyValues.copy}
          forwardRestricted={privacyValues.forward}
          screenshotNotified={privacyValues.screenshot}
          onToggle={onPrivacyChange}
        />
      )}
    </div>
  );
}
