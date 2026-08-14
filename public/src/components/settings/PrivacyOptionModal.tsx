import { useCallback } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { useI18n } from '../../hooks/useI18n';
import { api } from '../../services/api';
import ModalShell from './ModalShell';
import styles from './SubModalOptions.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  optionKey: string;
  optionTitle: string;
  onSelectExceptions: (key: string) => void;
}

const OPTIONS = [
  { value: 'all' as const, label: 'Все' },
  { value: 'selected' as const, label: 'Избранные' },
  { value: 'none' as const, label: 'Никто' },
];

export default function PrivacyOptionModal({ isOpen, onClose, optionKey, optionTitle, onSelectExceptions }: Props) {
  const { t } = useI18n();
  const { privacyState, privacyExceptions, setPrivacyOption } = useSettings();
  const current = privacyState[optionKey] || 'all';

  const handleSelect = useCallback(async (value: 'all' | 'none' | 'selected') => {
    const newPrivacy = { ...privacyState, [optionKey]: value, exceptions: privacyExceptions };
    setPrivacyOption(optionKey, value);
    if (value === 'selected') onSelectExceptions(optionKey);
    try {
      await api.post('/api/privacy', newPrivacy);
    } catch {}
  }, [optionKey, privacyState, privacyExceptions, setPrivacyOption, onSelectExceptions]);

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title={optionTitle}>
      <div className={styles.options}>
        {OPTIONS.map(opt => {
          const active = current === opt.value;
          return (
            <div key={opt.value}
              className={`${styles.option} ${active ? styles.selected : ''}`}
              style={active ? { background: 'rgba(var(--accent-rgb), 0.15)', borderColor: 'var(--accent-solid)' } : undefined}
              onClick={() => handleSelect(opt.value)}>
              <span>{t(opt.label)}</span>
              {active && (
                <div className={styles.checkCircle} style={{ background: 'var(--accent-solid)' }}>
                  <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: '#fff' }}>
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {current === 'selected' && (
        <button className={styles.selectBtn}
          onClick={() => onSelectExceptions(optionKey)}>
          {t('Выбрать пользователей')}
        </button>
      )}
    </ModalShell>
  );
}
