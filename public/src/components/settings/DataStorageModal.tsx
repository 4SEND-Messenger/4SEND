import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../../hooks/useI18n';
import { clearCachedMessages } from '../../utils/db';
import ModalShell from './ModalShell';
import styles from './DataStorageModal.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const autoCleanOptions = [
  { value: 'off', labelKey: 'Выкл' },
  { value: '1day', labelKey: '1 день' },
  { value: '1week', labelKey: '1 неделю' },
  { value: '1month', labelKey: '1 месяц' },
] as const;

const maxCacheOptions = [
  { value: '1gb', labelKey: '1 ГБ' },
  { value: '5gb', labelKey: '5 ГБ' },
  { value: '10gb', labelKey: '10 ГБ' },
  { value: 'unlimited', labelKey: 'Неограниченно' },
] as const;

function formatBytes(bytes: number, t: (key: string) => string): string {
  if (bytes === 0) return t('0 Б');
  const k = 1024;
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const idx = Math.min(i, sizes.length - 1);
  return parseFloat((bytes / Math.pow(k, idx)).toFixed(1)) + ' ' + t(sizes[idx]);
}

export default function DataStorageModal({ isOpen, onClose }: Props) {
  const { t } = useI18n();
  const [usage, setUsage] = useState<{ used: number; quota: number }>({ used: 0, quota: 0 });
  const [autoClean, setAutoClean] = useState(() => {
    try { return localStorage.getItem('4send_auto_clean') || 'off'; } catch { return 'off'; }
  });
  const [maxCache, setMaxCache] = useState(() => {
    try { return localStorage.getItem('4send_max_cache') || 'unlimited'; } catch { return 'unlimited'; }
  });

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const fetch = async () => {
      try {
        const est = await navigator.storage.estimate();
        if (!cancelled) {
          setUsage({
            used: est.usage || 0,
            quota: est.quota || 0,
          });
        }
      } catch {}
    };
    fetch();
    return () => { cancelled = true; };
  }, [isOpen]);

  const handleAutoClean = useCallback((val: string) => {
    setAutoClean(val);
    try { localStorage.setItem('4send_auto_clean', val); } catch {}
  }, []);

  const handleMaxCache = useCallback((val: string) => {
    setMaxCache(val);
    try { localStorage.setItem('4send_max_cache', val); } catch {}
  }, []);

  const handleClearCache = useCallback(async () => {
    try {
      const dbs = await indexedDB.databases?.();
      if (dbs) {
        await Promise.all(dbs
          .filter(d => d.name && d.name.startsWith('4send'))
          .map(d => indexedDB.deleteDatabase(d.name!)));
      }
      clearCachedMessages('');
      setUsage({ used: 0, quota: usage.quota });
    } catch {
      localStorage.clear();
      setUsage({ used: 0, quota: usage.quota });
    }
  }, [usage.quota]);

  const displayQuota = maxCache === '1gb' ? 1073741824
    : maxCache === '5gb' ? 5368709120
    : maxCache === '10gb' ? 10737418240
    : usage.quota;
  const percent = displayQuota > 0 ? Math.min(usage.used / displayQuota, 1) : 0;
  const barColor = percent > 0.9 ? '#ff453a' : percent > 0.7 ? '#ff9f0a' : '#34aadc';

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title={t('Данные и память')} maxWidth="420px">
      <div className={styles.storageCard}>
        <div className={styles.storageHeader}>
          <span className={styles.storageLabel}>{t('Использовано')}</span>
          <span className={styles.storageValue}>{formatBytes(usage.used, t)}</span>
        </div>
        <div className={styles.barOuter}>
          <div className={styles.barInner} style={{ width: `${percent * 100}%`, background: barColor }} />
        </div>
        <div className={styles.storageDetail}>
          <span>{formatBytes(usage.used, t)} {t('из')} {maxCache === 'unlimited' ? formatBytes(usage.quota, t) : formatBytes(displayQuota, t)}</span>
        </div>
      </div>

      <div className={styles.sectionLabel}>{t('Автоочистка кэша')}</div>
      <div className={styles.options}>
        {autoCleanOptions.map(opt => {
          const active = autoClean === opt.value;
          return (
            <div
              key={opt.value}
              className={`${styles.option} ${active ? styles.optionActive : ''}`}
              onClick={() => handleAutoClean(opt.value)}
            >
              <span>{t(opt.labelKey)}</span>
              {active && (
                <div className={styles.checkCircle}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="#fff">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.sectionLabel}>{t('Максимальный размер кэша')}</div>
      <div className={styles.options}>
        {maxCacheOptions.map(opt => {
          const active = maxCache === opt.value;
          return (
            <div
              key={opt.value}
              className={`${styles.option} ${active ? styles.optionActive : ''}`}
              onClick={() => handleMaxCache(opt.value)}
            >
              <span>{t(opt.labelKey)}</span>
              {active && (
                <div className={styles.checkCircle}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="#fff">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.divider} />

      <button className={styles.clearBtn} onClick={handleClearCache}>
        {t('Очистить кэш')}
      </button>
    </ModalShell>
  );
}
