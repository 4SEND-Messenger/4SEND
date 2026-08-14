import { useState, useCallback } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { useI18n } from '../../hooks/useI18n';
import { api } from '../../services/api';
import ModalShell from './ModalShell';
import styles from './AutoDeleteModal.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const options = [
  { value: 3, label: '3 месяца' },
  { value: 6, label: '6 месяцев' },
  { value: 12, label: '1 год' },
];

export default function AutoDeleteModal({ isOpen, onClose }: Props) {
  const { t } = useI18n();
  const { autoDeleteMonths, setAutoDeleteMonths } = useSettings();
  const [selected, setSelected] = useState(autoDeleteMonths);

  const handleSelect = useCallback(async (value: number) => {
    setSelected(value);
    try {
      await api.post('/api/auto-delete', { months: value });
      setAutoDeleteMonths(value);
      onClose();
    } catch {}
  }, [setAutoDeleteMonths, onClose]);

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title={t('Автоудаление сообщений')}>
      <div className={styles.description}>
        {t('Сообщения в этом чате будут автоматически удаляться спустя выбранное время.')}
      </div>

      <div className={styles.options}>
        {options.map(opt => {
          const active = selected === opt.value;
          return (
            <div
              key={opt.value}
              className={`${styles.option} ${active ? styles.active : ''}`}
              onClick={() => handleSelect(opt.value)}
            >
              <span>{t(opt.label)}</span>
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
    </ModalShell>
  );
}
