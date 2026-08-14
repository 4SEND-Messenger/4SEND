import { useState, useCallback, useEffect, type ReactNode } from 'react';
import { useI18n } from '../../hooks/useI18n';

interface PinnedItem {
  text: string;
  id: string;
  mediaType?: string;
}

interface Props {
  pinnedMessage: PinnedItem[] | null;
  onScrollTo: (id: string) => void;
  onUnpin: (id: string) => void;
  styles: Record<string, string>;
}

const MEDIA_ICONS: Record<string, ReactNode> = {
  photo: (
    <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, verticalAlign: 'middle', marginRight: 4 }}>
      <path fill="currentColor" d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
    </svg>
  ),
  video: (
    <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, verticalAlign: 'middle', marginRight: 4 }}>
      <path fill="currentColor" d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
    </svg>
  ),
  voice: (
    <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, verticalAlign: 'middle', marginRight: 4 }}>
      <path fill="currentColor" d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
      <path fill="currentColor" d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
    </svg>
  ),
  audio: (
    <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, verticalAlign: 'middle', marginRight: 4 }}>
      <path fill="currentColor" d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
    </svg>
  ),
  videonote: (
    <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, verticalAlign: 'middle', marginRight: 4 }}>
      <path fill="currentColor" d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
    </svg>
  ),
  sticker: (
    <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, verticalAlign: 'middle', marginRight: 4 }}>
      <path fill="currentColor" d="M12 2L2 22h20L12 2zm0 3.83L18.17 19H5.83L12 5.83z" />
    </svg>
  ),
  gif: (
    <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, verticalAlign: 'middle', marginRight: 4 }}>
      <path fill="currentColor" d="M19 19H5V5h14v14zM5 3c-1.1 0-2 .9-2 2v14c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2H5zm6.5 10h-2v-2h2v2zm0-4h-2V7h2v2zm4 4h-2v-2h2v2zm0-4h-2V7h2v2z" />
    </svg>
  ),
  file: (
    <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, verticalAlign: 'middle', marginRight: 4 }}>
      <path fill="currentColor" d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
    </svg>
  ),
};

export default function PinnedBar({ pinnedMessage, onScrollTo, onUnpin, styles }: Props) {
  const { t } = useI18n();
  const [pinIndex, setPinIndex] = useState(0);

  const list = Array.isArray(pinnedMessage) ? pinnedMessage : (pinnedMessage ? [pinnedMessage] : []);
  const current = list[pinIndex] || null;

  useEffect(() => {
    if (pinIndex >= list.length) {
      setPinIndex(Math.max(0, list.length - 1));
    }
  }, [list.length, pinIndex]);

  const handleClick = useCallback(() => {
    if (!current) return;
    onScrollTo(current.id);
  }, [current, onScrollTo]);

  const handlePrev = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setPinIndex(i => (i - 1 + list.length) % list.length);
  }, [list.length]);

  const handleNext = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setPinIndex(i => (i + 1) % list.length);
  }, [list.length]);

  const mediaIcon = current?.mediaType ? MEDIA_ICONS[current.mediaType] : null;
  const displayText = current?.text || (current?.mediaType ? t('Медиа') : '');
  const isMulti = list.length > 1;

  return (
    <div
      className={`${styles.pinnedBar} ${list.length === 0 ? styles.hidden : ''}`}
      onClick={handleClick}
      style={{ cursor: current ? 'pointer' : undefined }}
    >
      <div className={styles.pinnedAccent} />
      <div className={styles.pinnedContent}>
        <div className={styles.pinnedCounter}>
          {isMulti ? `${pinIndex + 1} / ${list.length} ${t('закреплённых')}` : t('Закреплённое сообщение')}
        </div>
        <div className={styles.pinnedText}>
          {isMulti && (
            <button className={styles.pinArrow} onClick={handlePrev}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
            </button>
          )}
          <span className={styles.pinTextInner}>
            {mediaIcon}
            {displayText}
          </span>
          {isMulti && (
            <button className={styles.pinArrow} onClick={handleNext}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
            </button>
          )}
        </div>
      </div>
      <button className={styles.pinnedClose} onClick={(e) => { e.stopPropagation(); onUnpin(current?.id || ''); }}>✕</button>
    </div>
  );
}