import { memo, useRef } from 'react';
import type { ContactItem as ContactItemType } from '../../types/user';
import { useChat } from '../../context/ChatContext';
import { useI18n } from '../../hooks/useI18n';
import { useAuthContext } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import styles from './ContactItem.module.css';

function formatTime(timestamp: Date | string | undefined): string {
  if (!timestamp) return '';
  let date = new Date(timestamp);
  if (isNaN(date.getTime())) date = new Date(String(timestamp).replace(' ', 'T'));
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
}

function getAvatarColor(name: string): string {
  const colors = ['#f44336', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#009688', '#4caf50', '#ff9800'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length]!;
}

interface Props {
  chat: ContactItemType;
  onClick: (username: string) => void;
  onContextMenu?: (e: React.MouseEvent, username: string) => void;
  onLongPress?: (username: string, x: number, y: number) => void;
  isContextMenuActive?: boolean;
  isSearchResult?: boolean;
  e2eeSessions?: Set<string>;
}

function ContactItem({ chat, onClick, onContextMenu, onLongPress, isContextMenuActive, isSearchResult, e2eeSessions }: Props) {
  const { t } = useI18n();
  const { me } = useAuthContext();
  const { target, onlineUsers } = useChat();
  const { statusIndicator } = useSettings();
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      try { navigator.vibrate?.(40); } catch {}
      onLongPress?.(chat.username, touch.clientX, touch.clientY);
    }, 500);
  };
  const handleTouchMove = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };
  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const chatUserLower = chat.username.toLowerCase();
  const isSaved = chatUserLower === (me || '').toLowerCase();
  const isActive = chatUserLower === (target || '').toLowerCase();
  const isMuted = chat.is_muted;
  const isPinned = chat.is_pinned;
  const amIBlocked = chat.is_blocked_me;
  const isOn = onlineUsers?.has(chatUserLower);
  const isSystem = chat.username === '4send_system' || chat.username === '4send_help'
    || chat.lastSender === '4send_system' || chat.lastSender === '4send_help';

  const timeStr = amIBlocked ? '' : formatTime(chat.timestamp);
  const displayName = isSaved
    ? t('Избранное')
    : isSystem
      ? (chat.username === '4send_system' ? t('Системные уведомления') : t('Поддержка 4SEND'))
      : (chat.displayName || chat.username);

  let preview = chat.lastText || '';
  if (!chat.isSecret) {
    preview = preview.replace(/🔒/g, '').trim();
    if (!preview && chat.previousText) {
      preview = chat.previousText;
    }
  }
  if (chat.isRoom && (preview === 'Канал' || preview === 'Группа' || preview === 'Публичный канал' || preview === 'Публичная группа')) {
    preview = t(preview);
  }
  let previewIcon: React.ReactNode = null;
  let iconColor = 'var(--accent-solid)';
  if (chat.lastIsVideoNote) {
    preview = t('Видеосообщение');
    previewIcon = <svg viewBox="0 0 24 24" className={styles.previewIcon}><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" /></svg>;
  } else if (chat.lastIsMusic) {
    preview = t('Аудиозапись');
    previewIcon = <svg viewBox="0 0 24 24" className={styles.previewIcon}><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" /></svg>;
  } else if (chat.lastIsAudio) {
    preview = t('Голосовое сообщение');
    previewIcon = <svg viewBox="0 0 24 24" className={styles.previewIcon}><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" /><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" /></svg>;
  } else if (chat.lastCallType) {
    if (chat.lastCallType === 'missed') { preview = t('Пропущенный звонок'); iconColor = '#ff4d4d'; }
    else if (chat.lastCallType === 'rejected') { preview = t('Отклонённый звонок'); iconColor = '#ff4d4d'; }
    else preview = t('Исходящий звонок');
    previewIcon = <svg viewBox="0 0 24 24" className={styles.previewIcon}><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg>;
  } else if (/^📂\s/.test(chat.lastText || '')) {
    preview = t('Пересланное сообщение');
    previewIcon = <svg viewBox="0 0 24 24" className={styles.previewIcon}><path d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z" /></svg>;
  } else if (chat.lastFileUrl) {
    const imageExts = ['jpg','jpeg','png','gif','webp','bmp','svg','ico','tiff','tif','heic','heif'];
    const isImage = new RegExp(`\\.(${imageExts.join('|')})(\\?|#|$)`,'i').test(chat.lastFileUrl) || (chat.lastFileName && new RegExp(`\\.(${imageExts.join('|')})$`,'i').test(chat.lastFileName));
    const isSticker = (chat.lastText || '').trim() === t('Стикер') || (chat.lastText || '').trim() === 'Стикер';
    const isGif = /\.gif(\?|#|$)/i.test(chat.lastFileUrl) || (chat.lastText || '').trim() === 'GIF';
    const audioExts = ['mp3','wav','ogg','m4a','flac','opus'];
    const isAudioFile = new RegExp(`\\.(${audioExts.join('|')})(\\?|#|$)`,'i').test(chat.lastFileUrl) || (chat.lastFileName && new RegExp(`\\.(${audioExts.join('|')})$`,'i').test(chat.lastFileName));
    const videoExts = ['mp4','webm','mov','avi','mkv','wmv','flv','m4v'];
    const isVideo = new RegExp(`\\.(${videoExts.join('|')})(\\?|#|$)`,'i').test(chat.lastFileUrl) || (chat.lastFileName && new RegExp(`\\.(${videoExts.join('|')})$`,'i').test(chat.lastFileName));
    if (isGif) {
      preview = t('GIF');
      previewIcon = <svg viewBox="0 0 24 24" className={styles.previewIcon}><path d="M19 19H5V5h14v14zM5 3c-1.1 0-2 .9-2 2v14c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2H5zm6.5 10h-2v-2h2v2zm0-4h-2V7h2v2zm4 4h-2v-2h2v2zm0-4h-2V7h2v2z" /></svg>;
    } else if (isVideo) {
      preview = t('Видео');
      previewIcon = <svg viewBox="0 0 24 24" className={styles.previewIcon}><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" /></svg>;
    } else if (isAudioFile) {
      preview = t('Аудиозапись');
      previewIcon = <svg viewBox="0 0 24 24" className={styles.previewIcon}><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" /></svg>;
    } else if (isSticker) {
      preview = t('Стикер');
      previewIcon = <svg viewBox="0 0 24 24" className={styles.previewIcon}><path d="M12 2L2 22h20L12 2zm0 3.83L18.17 19H5.83L12 5.83z" /></svg>;
    } else if (isImage) {
      preview = t('Фотография');
      previewIcon = <svg viewBox="0 0 24 24" className={styles.previewIcon}><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" /></svg>;
    } else {
      preview = t('Файл');
      previewIcon = <svg viewBox="0 0 24 24" className={styles.previewIcon}><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" /></svg>;
    }
  }

  if (chat.isSecret) {
    preview = t('Секретное сообщение');
    previewIcon = (
      <svg viewBox="0 0 24 24" className={styles.previewIcon} style={{ color: '#4caf50' }}>
        <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z" />
      </svg>
    );
  }

  const isLastSenderMe = chat.lastSender?.toLowerCase() === (me || '').toLowerCase();
  const showTicks = isLastSenderMe && !isSaved && !amIBlocked && !isSystem;
  const isLastRead = chat.isLastMessageRead;

  let senderPrefix = null;
  if (!amIBlocked && chat.lastSender && !isSystem && !chat.lastCallType) {
    if (chat.isRoom && chat.roomType !== 'channel') {
      senderPrefix = <span className={styles.previewSender}>{isLastSenderMe ? t('Вы') : (chat.lastSenderDisplay || chat.lastSender)}: </span>;
    } else if (!chat.isRoom) {
      senderPrefix = <span className={styles.previewSender}>{isLastSenderMe ? t('Вы') : (chat.lastSenderDisplay || chat.lastSender)}: </span>;
    }
  }

  const borderCol = isSaved ? 'var(--accent-solid)' : amIBlocked ? '#333' : isOn && !chat.isRoom ? '#4caf50' : '#333';
  const isDot = statusIndicator === 'dot';
  const avatarBorder = isDot ? 'transparent' : borderCol;

  return (
    <div
      className={`${styles.contactItem} ${chat.isSecret ? styles.secretChat : ''} ${isActive ? styles.active : ''} ${isContextMenuActive ? styles.contextActive : ''}`}
      onClick={() => onClick(chat.username)}
      onContextMenu={e => { e.preventDefault(); onContextMenu?.(e, chat.username); }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className={styles.avatarBox}
        style={{ borderColor: avatarBorder }}
      >
        <div className={styles.avatarClip}>
        {isSaved ? (
          <div className={styles.avatarPlaceholder} style={{ background: 'var(--accent, #a74fff)', color: 'var(--on-accent, #fff)' }}>
            <svg viewBox="0 0 24 24" style={{ width: '60%', height: '60%', fill: 'currentColor' }}>
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
            </svg>
          </div>
        ) : chat.avatar && chat.avatar !== 'null' ? (
          <img className={styles.avatarImg} src={chat.avatar} alt="" loading="lazy" decoding="async" />
        ) : (
          <div
            className={styles.avatarPlaceholder}
            style={{ background: getAvatarColor(chat.username) }}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
        </div>
        {isDot && isOn && !chat.isRoom && !isSaved && <div className={styles.statusDot} />}
      </div>

      <div className={styles.infoBox}>
        <div className={styles.topRow}>
          <b className={styles.contactName}>
              <span className={styles.nameText}>{displayName}</span>
              {!isSearchResult && chat.isRoom && (
                <span className={styles.roomTypeBadge}>
                  {chat.roomType === 'channel' ? t('Канал') : t('Группа')}
                </span>
              )}
            {chat.isSecret && (
              <svg className={styles.secretBadge} viewBox="0 0 24 24" style={{ fill: '#4caf50' }} role="img" aria-label={t('Секретный чат')}>
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z" />
              </svg>
            )}
            {!!chat.isVerified && !isSaved && (
              <svg className={styles.verifiedBadge} viewBox="0 0 24 24">
                <path d="M23 11.99l-2.44-2.79.34-3.69-3.61-.82-1.89-3.2L12 2.96 8.6 1.5 6.71 4.69 3.1 5.5l.34 3.7L1 11.99l2.44 2.79-.34 3.7 3.61.82L8.6 22.5l3.4-1.47 3.4 1.46 1.89-3.19 3.61-.82-.34-3.69L23 11.99zm-12.93 4.46l-3.53-3.54 1.41-1.41 2.12 2.12 4.24-4.24 1.41 1.41-5.65 5.66z" />
              </svg>
            )}
          </b>
          {!isSearchResult && (
            <div className={styles.timeLabel}>
              {amIBlocked ? '' : (
                <>
                  {showTicks && (
                    <span className={styles.tickWrap}>
                      {isLastRead ? (
                        <>
                          <svg viewBox="0 0 24 24" className={styles.tickSvg}><path d="M4 12l4 4L18 6" /></svg>
                          <svg viewBox="0 0 24 24" className={`${styles.tickSvg} ${styles.tickOffset}`}><path d="M4 12l4 4L18 6" /></svg>
                        </>
                      ) : (
                        <svg viewBox="0 0 24 24" className={`${styles.tickSvg} ${styles.tickSingle}`}><path d="M4 12l4 4L18 6" /></svg>
                      )}
                    </span>
                  )}
                  {timeStr}
                </>
              )}
            </div>
          )}
        </div>
        <div className={styles.bottomRow}>
          {isSearchResult ? (
            <div className={styles.searchUsername}>
              {chat.isRoom
                ? (chat.roomType === 'channel' ? t('Публичный канал') : t('Публичная группа'))
                : `@${chat.username}`
              }
            </div>
          ) : (
            <>
              <div className={styles.preview}>
                {amIBlocked ? t('был(а) давно') : <>{senderPrefix}{previewIcon && <span className={styles.previewIconWrap} style={{ color: iconColor }}>{previewIcon}</span>}<span className={styles.previewText}>{preview}</span></>}
              </div>
              <div className={styles.meta}>
                {!!isMuted && (
                  <svg className={styles.mutedIcon} viewBox="0 0 24 24">
                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                  </svg>
                )}
                {!!isPinned && (
                  <svg className={styles.pinIcon} viewBox="0 0 24 24">
                    <path d="M16 5h.99L17 3H7v2h1v7l-2 2v2h5v6l1 1 1-1v-6h5v-2l-2-2V5z" />
                  </svg>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      {!!chat.unreadCount && chat.unreadCount > 0 && !isSaved && !amIBlocked && (
        <div className={`${styles.unreadBadge} ${isMuted ? styles.mutedBadge : ''}`}>
          {chat.unreadCount}
        </div>
      )}
    </div>
  );
}

export default memo(ContactItem, (prev, next) => {
  if (prev.chat.username !== next.chat.username) return false;
  if (prev.chat.displayName !== next.chat.displayName) return false;
  if (prev.chat.avatar !== next.chat.avatar) return false;
  if (prev.chat.unreadCount !== next.chat.unreadCount) return false;
  if (prev.chat.isOnline !== next.chat.isOnline) return false;
  if (prev.chat.lastText !== next.chat.lastText) return false;
  if (prev.chat.timestamp !== next.chat.timestamp) return false;
  if (prev.chat.is_pinned !== next.chat.is_pinned) return false;
  if (prev.chat.is_muted !== next.chat.is_muted) return false;
  if (prev.isSearchResult !== next.isSearchResult) return false;
  if (prev.isContextMenuActive !== next.isContextMenuActive) return false;
  return true;
});
