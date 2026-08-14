import { useCallback } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { useI18n } from '../../hooks/useI18n';
import ModalShell from './ModalShell';
import styles from './TextSizeModal.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const sizes = [
  { key: 'small' as const, label: 'Мелкий', px: 14, color: '#007aff', bg: 'rgba(0,122,255,0.15)' },
  { key: 'medium' as const, label: 'Средний', px: 16, color: '#34c759', bg: 'rgba(52,199,89,0.15)' },
  { key: 'large' as const, label: 'Большой', px: 18, color: '#ff9500', bg: 'rgba(255,149,0,0.15)' },
];

export default function TextSizeModal({ isOpen, onClose }: Props) {
  const { textSize, setTextSize } = useSettings();
  const { t } = useI18n();

  const handleSelect = useCallback((size: 'small' | 'medium' | 'large') => {
    setTextSize(size);
  }, [setTextSize]);

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title={t('Размер текста')}>
      <div className={styles.options}>
        {sizes.map(s => {
          const active = textSize === s.key;
          return (
            <div
              key={s.key}
              className={`${styles.option} ${active ? styles.active : ''}`}
              style={active ? { background: s.bg, borderColor: s.color } : undefined}
              onClick={() => handleSelect(s.key)}
            >
              <span style={{ fontSize: s.px }}>{t(s.label)}</span>
              {active && (
                <div className={styles.checkCircle} style={{ background: s.color }}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="#fff">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ModalShell>
  );
}
