import { useState, useCallback, useEffect, useRef } from 'react';
import { useI18n } from '../../hooks/useI18n';
import { api } from '../../services/api';
import FullscreenVideo from './FullscreenVideo';
import styles from './MediaGallery.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  target: string;
  type?: 'photos' | 'videos' | 'voices' | 'music' | 'files';
  onGoToMessage?: (msgId: string) => void;
  onOpenLightbox?: (src: string) => void;
  isLightboxOpen?: boolean;
}

interface GalleryItem {
  id: string;
  fileUrl: string;
  fileName?: string;
  timestamp: string;
  text?: string;
  isVideoNote?: boolean;
  isAudio?: boolean;
}

const MONTHS_RU = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

const cache: Record<string, GalleryItem[]> = {};

export default function MediaGallery({ isOpen, onClose, target, type, onGoToMessage, onOpenLightbox, isLightboxOpen }: Props) {
  const { t } = useI18n();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [visible, setVisible] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; itemId: string } | null>(null);
  const [ctxMenuClosing, setCtxMenuClosing] = useState(false);
  const [fullscreenVideoSrc, setFullscreenVideoSrc] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const animateClose = useCallback(() => {
    setClosing(true);
    timerRef.current = setTimeout(() => {
      onCloseRef.current();
    }, 300);
  }, []);

  const closeCtxMenu = useCallback(() => {
    if (!ctxMenu) return;
    setCtxMenuClosing(true);
    setTimeout(() => {
      setCtxMenu(null);
      setCtxMenuClosing(false);
    }, 200);
  }, [ctxMenu]);

  useEffect(() => {
    const handleClick = () => { if (ctxMenu) closeCtxMenu(); };
    if (ctxMenu) {
      document.addEventListener('click', handleClick, true);
      return () => document.removeEventListener('click', handleClick, true);
    }
    return;
  }, [ctxMenu, closeCtxMenu]);

  const title = type
    ? ({ photos: t('Фотографии'), videos: t('Видео'), voices: t('Голосовые сообщения'), music: t('Аудиозаписи'), files: t('Файлы') } as const)[type]
    : t('Медиафайлы');

  useEffect(() => {
    if (!isOpen || !target || !type) return;
    setPlayingId(null);
    const cacheKey = `${target}_${type}`;
    if (cache[cacheKey]) {
      setItems(cache[cacheKey]);
      setLoading(false);
    } else {
      setLoading(true);
    }
    api.get<GalleryItem[]>(`/api/shared-media-list/${encodeURIComponent(target)}?type=${type}`)
      .then(res => {
        const data = Array.isArray(res) ? res : [];
        cache[cacheKey] = data;
        setItems(data);
      })
      .catch(() => {
        if (!cache[cacheKey]) {
          cache[cacheKey] = [];
          setItems([]);
        }
      })
      .finally(() => { setLoading(false); });
  }, [isOpen, target, type]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      e.stopPropagation();
      animateClose();
    }
  }, [animateClose]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (ctxMenu) closeCtxMenu();
      else if (!isLightboxOpen) animateClose();
    }
  }, [animateClose, ctxMenu, closeCtxMenu, isLightboxOpen]);

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const handleCtxMenu = useCallback((e: React.MouseEvent, itemId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 80);
    setCtxMenu({ x, y, itemId });
  }, []);

  const handleGoToMessage = useCallback((itemId: string) => {
    const msgId = itemId.replace(/_\d+$/, '');
    closeCtxMenu();
    animateClose();
    onGoToMessage?.(msgId);
  }, [closeCtxMenu, animateClose, onGoToMessage]);

  if (!isOpen || !type) return null;

  const grouped: Record<string, GalleryItem[]> = {};
  const currentYear = new Date().getFullYear();
  items.forEach(item => {
    const d = new Date(item.timestamp);
    const monthStr = t(MONTHS_RU[d.getMonth()]) + (d.getFullYear() !== currentYear ? ' ' + d.getFullYear() : '');
    if (!grouped[monthStr]) grouped[monthStr] = [];
    grouped[monthStr].push(item);
  });

  const playIcon = (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
      <path d="M8 5v14l11-7z"/>
    </svg>
  );

  const pauseIcon = (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
    </svg>
  );

  let overlayClass = styles.overlay;
  if (visible && !closing) overlayClass += ` ${styles.active}`;
  if (closing) overlayClass += ` ${styles.closing}`;

  return (
    <>
      <div className={overlayClass} onClick={handleOverlayClick}>
         <div className={`${styles.modal}${visible || closing ? ` ${styles.modalVisible}` : ''}${closing ? ` ${styles.modalClosing}` : ''}`} onClick={e => e.stopPropagation()}>
          <div className={styles.modalHeader}>
            <button className={styles.backBtn} onClick={animateClose}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
              </svg>
            </button>
            <span className={styles.title}>{title}</span>
            <button className={styles.closeBtn} onClick={animateClose}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>

          <div className={styles.content}>
            {loading ? (
              <div className={styles.emptyState}>{t('Загрузка...')}</div>
            ) : items.length === 0 ? (
              <div className={styles.emptyState}>{t('Пусто')}</div>
            ) : (
              Object.entries(grouped).map(([month, monthItems]) => (
                <div key={month}>
                  <div className={styles.monthHeader}>{month}</div>

                  {(type === 'photos' || type === 'videos') ? (
                    <div className={styles.grid}>
                      {monthItems.map(item => (
                        <div
                          key={item.id}
                          className={styles.gridItem}
                          onClick={() => {
                            if (type === 'photos') onOpenLightbox?.(item.fileUrl);
                            else setFullscreenVideoSrc(item.fileUrl);
                          }}
                          onContextMenu={e => handleCtxMenu(e, item.id)}
                        >
                          {type === 'photos' ? (
                            <img
                              src={item.fileUrl}
                              alt=""
                              className={styles.thumb}
                              loading="lazy"
                            />
                          ) : (
                            <>
                              <video src={item.fileUrl} className={styles.thumb} />
                              <div className={styles.videoBadge}>
                                <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                                  <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                                </svg>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.list}>
                      {monthItems.map(item => {
                        const icon = (() => {
                          if (type === 'voices') {
                            return item.isVideoNote ? (
                              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                                <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                              </svg>
                            ) : (
                              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                              </svg>
                            );
                          }
                          if (type === 'music') {
                            return (
                              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                              </svg>
                            );
                          }
                          return (
                            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                              <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                            </svg>
                          );
                        })();

                        const date = new Date(item.timestamp).toLocaleDateString([], { day: 'numeric', month: 'short' });

                        let label = item.fileName || t('Файл');
                        if (type === 'voices') label = item.isVideoNote ? t('Видосообщение') : t('Голосовое сообщение');
                        if (type === 'music') label = item.fileName || t('Аудиозапись');

                        const isPlaying = playingId === item.id;
                        const isAudioType = type === 'voices' || type === 'music';

                        const showIcon = isAudioType
                          ? (item.isVideoNote ? icon : (isPlaying ? pauseIcon : playIcon))
                          : icon;

                        return (
                          <div
                            key={item.id}
                            className={styles.listItem}
                            onClick={() => {
                              if (item.isVideoNote) {
                                setFullscreenVideoSrc(item.fileUrl);
                              } else if (isAudioType) {
                                if (isPlaying) {
                                  setPlayingId(null);
                                } else {
                                  setPlayingId(item.id);
                                }
                              } else if (type === 'files') {
                                handleGoToMessage(item.id);
                              } else {
                                window.open(item.fileUrl, '_blank');
                              }
                            }}
                            onContextMenu={e => handleCtxMenu(e, item.id)}
                          >
                            <div className={styles.listIconWrap}>
                              {showIcon}
                            </div>
                            <div className={styles.listInfo}>
                              <div className={styles.listName}>{label}</div>
                              <div className={styles.listDate}>{date}</div>
                            </div>
                            {isAudioType && isPlaying && (
                              <audio src={item.fileUrl} autoPlay onEnded={() => setPlayingId(null)} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {fullscreenVideoSrc && (
        <FullscreenVideo
          isOpen={!!fullscreenVideoSrc}
          onClose={() => setFullscreenVideoSrc(null)}
          src={fullscreenVideoSrc}
        />
      )}

      {ctxMenu && (
        <div
          className={`${styles.ctxMenu}${ctxMenuClosing ? ` ${styles.ctxMenuClosing}` : ''}`}
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
        >
          <div className={styles.ctxMenuItem} onClick={() => handleGoToMessage(ctxMenu.itemId)}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
            </svg>
            <span>{t('Перейти к сообщению')}</span>
          </div>
        </div>
      )}
    </>
  );
}
