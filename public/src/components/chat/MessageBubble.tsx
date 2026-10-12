import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { Message } from '../../types/message';
import { useAuthContext } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useI18n } from '../../hooks/useI18n';
import { getSocket } from '../../services/socket';
import { api } from '../../services/api';
import ReactionsDisplay, { playReactionParticles } from './ReactionsDisplay';
import LinkPreviewCard from './LinkPreviewCard';
import VoicePlayer from './VoicePlayer';
import MusicPlayer from './MusicPlayer';
import VideoNotePlayer from './VideoNotePlayer';
import VideoMessage from './VideoMessage';
import MessageImage from './MessageImage';
import MessageImageGrid from './MessageImageGrid';
import FileMessage from './FileMessage';
import ForwardedMessage from './ForwardedMessage';
import CallMessage from './CallMessage';
import ServiceMessage from './ServiceMessage';
import { computeMediaFlags, getContentPaddingBottom, getSafeFileName, getFileExt, isGifFile } from '../../utils/media';
import { formatMessageText, extractFirstUrl } from '../../utils/textFormat';
import { getSenderColor } from '../../utils/senderColor';
import styles from './MessageBubble.module.css';

interface Props {
  message: Message;
  showDateSeparator?: boolean;
  isSelected?: boolean;
  multiSelectActive?: boolean;
  copyRestricted?: boolean;
  onClick?: (msg: Message) => void;
  onContextMenu?: (e: React.MouseEvent, msg: Message) => void;
  onDoubleClick?: (msg: Message) => void;
  onReact?: (msgId: string, emoji: string) => void;
  isHighlighted?: boolean;
  isDeleting?: boolean;
  isSaved?: boolean;
  isChannel?: boolean;
  id?: string;
  onOpenLightbox?: (url: string) => void;
  onScrollToReply?: (replyId: string) => void;
  onReply?: (msg: Message) => void;
  onLongPress?: (msg: Message, x: number, y: number) => void;
}

const VERIFIED_BADGE = (
  <svg viewBox="0 0 24 24" className={styles.verifiedBadge}>
    <path d="M23 11.99l-2.44-2.79.34-3.69-3.61-.82-1.89-3.2L12 2.96 8.6 1.5 6.71 4.69 3.1 5.5l.34 3.7L1 11.99l2.44 2.79-.34 3.7 3.61.82L8.6 22.5l3.4-1.47 3.4 1.46 1.89-3.19 3.61-.82-.34-3.69L23 11.99zm-12.93 4.46l-3.53-3.54 1.41-1.41 2.12 2.12 4.24-4.24 1.41 1.41-5.65 5.66z" />
  </svg>
);

const MEDIA_REPLY_MAP: Record<string, { icon: string; label: string }> = {
  '📹 Видеосообщение': { icon: 'video', label: 'Видео' },
  '🎤 Голосовое сообщение': { icon: 'voice', label: 'Голосовое сообщение' },
  '🎵 Аудиозапись': { icon: 'audio', label: 'Аудиозапись' },
  '📁 Файл': { icon: 'file', label: 'Файл' },
  '📷 Фотография': { icon: 'photo', label: 'Фотография' },
  'Стикер': { icon: 'sticker', label: 'Стикер' },
  'GIF': { icon: 'gif', label: 'GIF' },
};

function ReplyIcon({ kind }: { kind: string }) {
  const common = { width: 12, height: 12, style: { fill: 'var(--accent-solid)', verticalAlign: 'middle', marginRight: 4 } as React.CSSProperties };
  switch (kind) {
    case 'video':
      return <svg viewBox="0 0 24 24" {...common}><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" /></svg>;
    case 'voice':
      return <svg viewBox="0 0 24 24" {...common}><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" /><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" /></svg>;
    case 'audio':
      return <svg viewBox="0 0 24 24" {...common}><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" /></svg>;
    case 'file':
      return <svg viewBox="0 0 24 24" {...common}><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" /></svg>;
    case 'photo':
      return <svg viewBox="0 0 24 24" {...common}><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" /></svg>;
    case 'sticker':
      return <svg viewBox="0 0 24 24" {...common}><path d="M12 2L2 22h20L12 2zm0 3.83L18.17 19H5.83L12 5.83z" /></svg>;
    case 'gif':
      return <svg viewBox="0 0 24 24" {...common}><path d="M19 19H5V5h14v14zM5 3c-1.1 0-2 .9-2 2v14c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2H5zm6.5 10h-2v-2h2v2zm0-4h-2V7h2v2zm4 4h-2v-2h2v2zm0-4h-2V7h2v2z" /></svg>;
    default:
      return null;
  }
}

function MessageBubble({ message, showDateSeparator, isSelected, multiSelectActive, copyRestricted, onClick, onContextMenu, onDoubleClick, onReact, isHighlighted, isDeleting, isSaved, isChannel, id, onOpenLightbox, onScrollToReply, onReply, onLongPress }: Props) {
  const { me } = useAuthContext();
  const { quickReaction } = useSettings();
  const { t } = useI18n();

  const isSent = (message.sender || '').toLowerCase() === (me || '').toLowerCase();
  const msgId = message.id || message.tempId || '';

  const replySwipeRef = useRef<{ x: number; y: number; active: boolean; locked?: boolean } | null>(null);
  const [swipeX, setSwipeX] = useState(0);
  const swipeXRef = useRef(0);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const swipeHandlersRef = useRef({ message, onReply, onLongPress });
  swipeHandlersRef.current = { message, onReply, onLongPress };

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const clearLongPress = () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      replySwipeRef.current = { x: touch.clientX, y: touch.clientY, active: true, locked: false };
      setSwipeX(0);
      swipeXRef.current = 0;
      longPressTriggeredRef.current = false;
      longPressTimerRef.current = setTimeout(() => {
        longPressTriggeredRef.current = true;
        try { navigator.vibrate?.(40); } catch {}
        const h = swipeHandlersRef.current;
        h.onLongPress?.(h.message, touch.clientX, touch.clientY);
      }, 500);
    };

    const onTouchMove = (e: TouchEvent) => {
      const ref = replySwipeRef.current;
      if (!ref || !ref.active) return;
      const touch = e.touches[0];
      if (!touch) return;
      const dx = touch.clientX - ref.x;
      const dy = touch.clientY - ref.y;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) clearLongPress();
      if (!ref.locked && Math.abs(dx) > Math.abs(dy) && dx < 0) ref.locked = true;
      if (ref.locked) {
        e.preventDefault();
        const val = Math.max(dx, -80);
        setSwipeX(val);
        swipeXRef.current = val;
      }
    };

    const finish = (allowReply: boolean) => {
      clearLongPress();
      const ref = replySwipeRef.current;
      replySwipeRef.current = null;
      if (!ref || !ref.active) return;
      if (allowReply && swipeXRef.current <= -60 && !longPressTriggeredRef.current) {
        const h = swipeHandlersRef.current;
        h.onReply?.(h.message);
        try { navigator.vibrate?.(30); } catch {}
      }
      setSwipeX(0);
      swipeXRef.current = 0;
    };

    const onTouchEnd = () => finish(true);
    const onTouchCancel = () => finish(false);

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchCancel, { passive: true });
    return () => {
      clearLongPress();
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchCancel);
    };
  }, []);

  const [summaries, setSummaries] = useState<Record<string, { loading: boolean; text: string; visible: boolean }>>({});

  const handleSummarize = useCallback(async (id: string, fileUrl: string) => {
    setSummaries(prev => {
      const cur = prev[id];
      if (cur?.text && !cur.loading) {
        return { ...prev, [id]: { ...cur, visible: !cur.visible } };
      }
      if (cur?.loading) return prev;
      return { ...prev, [id]: { loading: true, text: '', visible: true } };
    });
    const cur = summaries[id];
    if (cur?.text && !cur.loading) return;

    try {
      const data = await api.post<{ summary: string }>('/api/summarize-voice', { fileUrl });
      if (data.summary) {
        setSummaries(prev => ({ ...prev, [id]: { loading: false, text: data.summary, visible: true } }));
      } else {
        setSummaries(prev => ({ ...prev, [id]: { loading: false, text: '', visible: false } }));
      }
    } catch {
      setSummaries(prev => ({ ...prev, [id]: { loading: false, text: '', visible: false } }));
    }
  }, [summaries]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onContextMenu?.(e, message);
  }, [message, onContextMenu]);

  const handleClick = useCallback(() => {
    onClick?.(message);
  }, [message, onClick]);

  const handleDoubleClick = useCallback(() => {
    const socket = getSocket();
    socket.emit('set_reaction', { msgId, emoji: quickReaction, receiver: message.receiver || message.sender });
    playReactionParticles(wrapperRef.current, quickReaction, isSent);
    onReact?.(msgId, quickReaction);
  }, [msgId, quickReaction, message, onReact]);

  if (message.callType) {
    return (
      <>
        {showDateSeparator && (
          <div className={styles.dateSeparator}>
            <div className={styles.dateBubble}>{formatDateSeparator(message.timestamp, t)}</div>
          </div>
        )}
        <CallMessage message={message} onContextMenu={handleContextMenu} onClick={handleClick} />
      </>
    );
  }
  if (message.isService) {
    return (
      <>
        {showDateSeparator && (
          <div className={styles.dateSeparator}>
            <div className={styles.dateBubble}>{formatDateSeparator(message.timestamp, t)}</div>
          </div>
        )}
        <ServiceMessage message={message} />
      </>
    );
  }

  const text = typeof message.text === 'string' ? message.text : '';
  const ext = getFileExt(message.fileName, message.fileUrl);

  const forwardedMatch = text.match(/^📂 (?:Переслано от|Forwarded from) (.*?):\n?([\s\S]*)$/);
  const forwardedFrom = forwardedMatch
    ? (['скрыто', 'hidden'].includes(forwardedMatch[1]!.toLowerCase().trim())
      ? null
      : forwardedMatch[1])
    : null;
  const displayText = forwardedMatch ? (forwardedMatch[2] || '').trim() : text;

  const mediaCtx = {
    fileUrl: message.fileUrl,
    fileUrls: message.fileUrls,
    fileName: message.fileName,
    isAudio: message.isAudio,
    isVideoNote: message.isVideoNote,
    isMusic: message.isMusic,
    text: displayText,
  };
  const flags = computeMediaFlags(mediaCtx);
  const showText = flags.showText && displayText.trim() !== '';
  const isDarkPill = !!message.isVideoNote || !!message.isAudio || flags.isMediaOnly;
  const contentPaddingBottom = getContentPaddingBottom(mediaCtx, flags.isMediaOnly);
  const isRead = !!message.is_read;
  const timeStr = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const firstUrl = showText && !message.fileUrl ? extractFirstUrl(displayText) : null;

  const replyToId = message.reply_to_id || message.reply_to;
  const replyText = message.reply_to ? String(message.reply_to) : '';
  const replyMapped = replyText ? MEDIA_REPLY_MAP[replyText] : undefined;

  const safeFileName = getSafeFileName({ fileName: message.fileName, fileUrl: message.fileUrl, text: displayText });
  const isSticker = displayText === t('Стикер');
  const isGif = isGifFile(displayText, ext);

  const isMediaPill = !!message.isVideoNote || !!message.isAudio;

  const senderDisplay = message.displayName || message.sender || '';

  return (
    <>
      {showDateSeparator && (
        <div className={styles.dateSeparator}>
          <div className={styles.dateBubble}>{formatDateSeparator(message.timestamp, t)}</div>
        </div>
      )}
      <div className={styles.swipeRow}>
        <div className={styles.replyIndicator} style={{ opacity: swipeX < -30 ? Math.min(1, (-swipeX - 30) / 30) : 0 }}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="var(--accent-solid)"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" /></svg>
        </div>
        <div
          ref={wrapperRef}
          id={id}
          className={`${styles.msgRow} ${isSelected ? styles.msgRowSelected : ''} ${multiSelectActive ? styles.selectMode : ''} ${isDeleting ? styles.msgRowDeleting : ''} ${swipeX < 0 ? styles.msgSwiping : ''}`}
          data-id={msgId}
          onContextMenu={handleContextMenu}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          style={swipeX ? { transform: `translateX(${swipeX}px)`, transition: 'none' } : undefined}
        >
        <div className={`${styles.selectCircle} ${isSelected ? styles.selectCircleActive : ''}`}>
          {isSelected ? (
            <svg viewBox="0 0 24 24" className={styles.checkIcon}><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" /></svg>
          ) : (
            <div className={styles.emptyCircle} />
          )}
        </div>
        <div
          className={`${styles.msgWrapper} ${isSent ? styles.sent : styles.received} ${message.reactions && message.reactions.length > 0 ? styles.hasReactions : ''}`}
        >
          <div
            data-bubble
            className={`${styles.bubble} ${isSent ? styles.bubbleSent : styles.bubbleReceived} ${isMediaPill ? styles.bubbleMediaPill : ''} ${isHighlighted ? styles.bubbleHighlighted : ''}`}
          >
            <div className={styles.contentWrapper} style={{ paddingBottom: contentPaddingBottom }}>

              {forwardedFrom && <ForwardedMessage from={forwardedFrom} />}

            {replyToId && (
              <div
                className={styles.replyPreview}
                onClick={(e) => { e.stopPropagation(); if (replyToId) onScrollToReply?.(String(replyToId)); }}
              >
                <div className={styles.replyContent}>
                  <div className={styles.replyLabel}>{t('Ответ на:')}</div>
                  <div className={styles.replyText}>
                    {replyMapped ? (<><ReplyIcon kind={replyMapped.icon} />{t(replyMapped.label)}</>) : replyText}
                  </div>
                </div>
              </div>
            )}

            {!isChannel && !isSent && !forwardedFrom && senderDisplay && (
              <div
                className={styles.senderName}
                style={{ color: getSenderColor(message.sender || '') }}
              >
                <span className={styles.senderNameText}>
                  {message.sender === '4send_system' ? t('Системные уведомления')
                    : message.sender === '4send_help' ? t('Поддержка 4SEND')
                    : senderDisplay}
                </span>
                {!!message.isVerified && VERIFIED_BADGE}
              </div>
            )}

            {message.fileUrls && message.fileUrls.length > 1 && (
              <MessageImageGrid urls={message.fileUrls} onOpenLightbox={copyRestricted ? undefined : onOpenLightbox} />
            )}

            {message.isVideoNote && message.fileUrl && message.fileUrl !== 'dummy' && (
              <VideoNotePlayer src={message.fileUrl} />
            )}

            {message.isAudio && message.fileUrl && message.fileUrl !== 'dummy' && !message.isMusic && (
              <div className={styles.voiceContainer}>
                <VoicePlayer src={message.fileUrl} duration={message.duration} msgId={msgId} isMe={isSent} />
                <div className={styles.voiceMetaRow}>
                  <button
                    className={styles.summarizeBtn}
                    onClick={() => handleSummarize(msgId, message.fileUrl!)}
                  >
                    {summaries[msgId]?.loading ? (
                      <><span className={styles.summarizeSpinner} /> {t('Обработка...')}</>
                    ) : (
                      t('Пересказать')
                    )}
                  </button>
                  <div className={styles.voiceMeta}>
                    {isChannel && (
                      <div className={styles.viewsIcon} title={t('Просмотры')}>
                        <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                        <span className={styles.viewsCount}>{message.read_by ? message.read_by.length : 1}</span>
                      </div>
                    )}
                    {message.expires_at && (
                      <div className={styles.timerIcon} title={t('Сообщение с таймером')}>
                        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 15 15" /></svg>
                      </div>
                    )}
                    {message.is_edited && <span className={styles.editedMark}>{t('ред.')}</span>}
                    {message.is_encrypted && (
                      <span className={styles.encryptedIcon} title={t('End-to-end encrypted')}>
                        <svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z"/></svg>
                      </span>
                    )}
                    <span className={styles.msgTime}>{timeStr}</span>
                    {isSent && !isSaved && !isChannel && (
                      <div className={`${styles.msgStatus} ${isRead ? (isDarkPill ? styles.readDark : styles.read) : (isDarkPill ? styles.dark : '')}`}>
                        <svg viewBox="0 0 24 24" className={styles.tick}><path d="M4 12l4 4L18 6" /></svg>
                        {isRead && <svg viewBox="0 0 24 24" className={`${styles.tick} ${styles.tickSecond}`}><path d="M4 12l4 4L18 6" /></svg>}
                      </div>
                    )}
                  </div>
                </div>
                {summaries[msgId]?.visible && summaries[msgId]?.text && (
                  <div className={styles.summaryText}>
                    <b>{t('Краткий пересказ:')}</b><br />{summaries[msgId].text}
                  </div>
                )}
              </div>
            )}

            {message.isMusic && message.fileUrl && message.fileUrl !== 'dummy' && (
              <MusicPlayer src={message.fileUrl} fileName={safeFileName} duration={message.duration} />
            )}

            {!message.isVideoNote && !message.isAudio && flags.isImage && message.fileUrl && message.fileUrl !== 'dummy' && (
              <MessageImage src={message.fileUrl} isSticker={isSticker} isGif={isGif} onOpenLightbox={copyRestricted ? undefined : onOpenLightbox} />
            )}

            {!message.isVideoNote && !message.isAudio && !flags.isImage && flags.isVideo && message.fileUrl && message.fileUrl !== 'dummy' && (
              <VideoMessage src={message.fileUrl} copyRestricted={copyRestricted} />
            )}

            {!message.isVideoNote && !message.isAudio && !flags.isImage && !flags.isVideo && flags.isAudioExt && message.fileUrl && message.fileUrl !== 'dummy' && (
              <MusicPlayer src={message.fileUrl} fileName={safeFileName} duration={message.duration} />
            )}

            {!message.isVideoNote && !message.isAudio && !flags.isImage && !flags.isVideo && !flags.isAudioExt && message.fileUrl && message.fileUrl !== 'dummy' && (
              <FileMessage url={message.fileUrl} fileName={message.fileName} disabled={copyRestricted} />
            )}

            {showText && (
              <div className={`${styles.msgText} ${copyRestricted ? styles.msgTextBlocked : ''}`} style={{ marginTop: (message.fileUrl && message.fileUrl !== 'dummy') || (message.fileUrls && message.fileUrls.length > 0) ? 8 : 0 }}>
                {formatMessageText(displayText)}
              </div>
            )}

            {firstUrl && <LinkPreviewCard url={firstUrl} />}

            {!message.isAudio && (
            <div className={`${styles.msgMeta} ${flags.isMediaOnly ? styles.mediaOnly : ''} ${(message.isVideoNote || (flags.isVideo && !message.isAudio)) ? styles.videoMeta : ''}`}>
              {isChannel && (
                <div className={styles.viewsIcon} title={t('Просмотры')}>
                  <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  <span className={styles.viewsCount}>{message.read_by ? message.read_by.length : 1}</span>
                </div>
              )}
              {message.expires_at && (
                <div className={styles.timerIcon} title={t('Сообщение с таймером')}>
                  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 15 15" /></svg>
                </div>
              )}
              {message.is_edited && <span className={styles.editedMark}>{t('ред.')}</span>}
              {message.is_encrypted && (
                <span className={styles.encryptedIcon} title={t('End-to-end encrypted')}>
                  <svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z"/></svg>
                </span>
              )}
              <span className={styles.msgTime}>{timeStr}</span>
              {isSent && !isSaved && !isChannel && (
                <div className={`${styles.msgStatus} ${isRead ? (isDarkPill ? styles.readDark : styles.read) : (isDarkPill ? styles.dark : '')}`}>
                  <svg viewBox="0 0 24 24" className={styles.tick}><path d="M4 12l4 4L18 6" /></svg>
                  {isRead && <svg viewBox="0 0 24 24" className={`${styles.tick} ${styles.tickSecond}`}><path d="M4 12l4 4L18 6" /></svg>}
                </div>
              )}
            </div>
            )}

            {(message as Message & { isLoading?: boolean }).isLoading && (
              <div className={styles.loadingOverlay}>
                <div className={styles.loadingSpinner} />
              </div>
            )}
          </div>
        </div>

        {message.reactions && message.reactions.length > 0 && (
          <ReactionsDisplay msgId={msgId} reactions={message.reactions} me={me || ''} target={message.receiver || message.sender || ''} isSent={isSent} onReact={onReact} />
        )}
        </div>
      </div>
      </div>
    </>
  );
}

function formatDateSeparator(ts: Date | string, t: (key: string) => string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  if (isToday) return t('Сегодня');
  if (isYesterday) return t('Вчера');
  return d.toLocaleDateString([], { day: 'numeric', month: 'long' });
}

export default memo(MessageBubble, (prev, next) => {
  if (prev.message.id !== next.message.id) return false;
  if (prev.message.text !== next.message.text) return false;
  if (prev.message.is_edited !== next.message.is_edited) return false;
  if ((prev.message.reactions?.length ?? 0) !== (next.message.reactions?.length ?? 0)) return false;
  if (prev.isSelected !== next.isSelected) return false;
  if (prev.isHighlighted !== next.isHighlighted) return false;
  if (prev.isDeleting !== next.isDeleting) return false;
  if (prev.isSaved !== next.isSaved) return false;
  if (prev.showDateSeparator !== next.showDateSeparator) return false;
  if (prev.multiSelectActive !== next.multiSelectActive) return false;
  return true;
});
