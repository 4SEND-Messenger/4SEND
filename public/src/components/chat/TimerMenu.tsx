import { useCallback, useEffect } from 'react';
import { useI18n } from '../../hooks/useI18n';
import styles from './TimerMenu.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (seconds: number) => void;
  selected?: number;
}

const OPTIONS = [
  { label: 'Выкл', value: 0 },
  { label: '5 секунд', value: 5 },
  { label: '10 секунд', value: 10 },
  { label: '1 минута', value: 60 },
  { label: '1 час', value: 3600 },
  { label: '1 день', value: 86400 },
];

export default function TimerMenu({ isOpen, onClose, onSelect, selected }: Props) {
  const { t } = useI18n();

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(`.${styles.menu}`)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, onClose]);

  const handleSelect = useCallback((value: number) => {
    onSelect(value);
    onClose();
  }, [onSelect, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div className={styles.backdrop} />
      <div className={styles.menu}>
        <div className={styles.header}>
          <span className={styles.headerIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12,6 12,12 16,14" />
            </svg>
          </span>
          <span className={styles.headerText}>{t('Таймер')}</span>
        </div>
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={`${styles.item} ${selected === opt.value ? styles.itemActive : ''}`}
            onClick={() => handleSelect(opt.value)}
          >
            {t(opt.label)}
          </button>
        ))}
      </div>
    </>
  );
}
