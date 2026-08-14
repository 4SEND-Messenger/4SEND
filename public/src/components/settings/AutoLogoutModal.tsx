import { useState, useCallback } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { useI18n } from '../../hooks/useI18n';
import { api } from '../../services/api';
import ModalShell from './ModalShell';
import styles from './SubModalOptions.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const options = [
  { value: 1, label: '1 день' },
  { value: 7, label: '1 неделя' },
  { value: 30, label: '1 месяц' },
  { value: 180, label: '6 месяцев' },
];

export default function AutoLogoutModal({ isOpen, onClose }: Props) {
  const { t } = useI18n();
  const { autoLogoutDays, setAutoLogoutDays } = useSettings();
  const [selected, setSelected] = useState(autoLogoutDays);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      await api.post('/api/auto-logout', { days: selected });
      setAutoLogoutDays(selected);
      onClose();
    } catch {} finally {
      setSaving(false);
    }
  }, [selected, setAutoLogoutDays, onClose]);

  return (
    <ModalShell isOpen={isOpen} onClose={handleSave} title={t('Автовыход')}>
      <div className={styles.descText}>
        {t('Если вы не будете заходить в сеть в течение этого времени, сеанс будет завершен.')}
      </div>
      <div className={styles.options}>
        {options.map(opt => {
          const active = selected === opt.value;
          return (
            <div key={opt.value}
              className={`${styles.option} ${active ? styles.selected : ''}`}
              style={active ? { background: 'rgba(var(--accent-rgb), 0.15)', borderColor: 'var(--accent-solid)' } : undefined}
              onClick={() => setSelected(opt.value)}>
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
    </ModalShell>
  );
}
