import { useState, useEffect } from 'react';
import type { ReactElement } from 'react';
import { api } from '../../services/api';
import styles from './ProfileMediaGrid.module.css';
import { useI18n } from '../../hooks/useI18n';

interface MediaCounts {
  photos: number;
  videos: number;
  voices: number;
  music: number;
  files: number;
}

interface Props {
  target: string;
  onMediaClick?: (type: 'photos' | 'videos' | 'voices' | 'music' | 'files') => void;
}

const cache: Record<string, MediaCounts> = {};

const ROWS: Array<{
  type: keyof MediaCounts;
  icon: ReactElement;
  key: string;
}> = [
  {
    type: 'photos',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
        <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
      </svg>
    ),
    key: 'фотографии',
  },
  {
    type: 'videos',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
        <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
      </svg>
    ),
    key: 'видео',
  },
  {
    type: 'voices',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
      </svg>
    ),
    key: 'голосовые сообщения',
  },
  {
    type: 'music',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
      </svg>
    ),
    key: 'аудиозаписи',
  },
  {
    type: 'files',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
        <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
      </svg>
    ),
    key: 'файлы',
  },
];

export default function ProfileMediaGrid({ target, onMediaClick }: Props) {
  const { t } = useI18n();
  const [counts, setCounts] = useState<MediaCounts | null>(() => cache[target] || null);

  useEffect(() => {
    if (cache[target]) setCounts(cache[target]);
    let cancelled = false;
    api.get<MediaCounts>(`/api/shared-media/${encodeURIComponent(target)}`)
      .then(res => {
        if (!cancelled) {
          cache[target] = res;
          setCounts(res);
        }
      })
      .catch(() => {
        if (!cancelled) {
          const empty = { photos: 0, videos: 0, voices: 0, music: 0, files: 0 };
          cache[target] = empty;
          setCounts(empty);
        }
      });
    return () => { cancelled = true; };
  }, [target]);

  if (!counts) return null;

  const hasAny = Object.values(counts).some(v => v > 0);
  if (!hasAny) {
    return (
      <div className={styles.emptyState}>
        <svg viewBox="0 0 24 24" className={styles.emptyIcon}>
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
        <div className={styles.emptyText}>{t('В чате еще нет медиа')}</div>
      </div>
    );
  }

  return (
    <>
      <div className={styles.separator} />
      <div className={styles.wrapper}>
        {ROWS.map(row => {
          const count = counts[row.type];
          if (count === 0) return null;
          return (
            <div
              key={row.type}
              className={styles.row}
              onClick={() => onMediaClick?.(row.type)}
            >
              <div className={styles.iconWrap}>{row.icon}</div>
              <div className={styles.rowText}>{count} {t(row.key)}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}
