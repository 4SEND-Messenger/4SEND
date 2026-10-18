import { useCallback } from 'react';
import { useUI } from '../../context/UIContext';
import { useSettings } from '../../context/SettingsContext';
import { useI18n } from '../../hooks/useI18n';
import { api, apiErrorMessage } from '../../services/api';
import ModalShell from './ModalShell';
import styles from './SubModalOptions.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const options = [
  { value: 0, label: 'Выкл', color: '#e91e63' },
  { value: 5, label: 'Каждые 5 минут', color: '#e91e63' },
  { value: 10, label: 'Каждые 10 минут', color: '#e91e63' },
  { value: 30, label: 'Каждые 30 минут', color: '#e91e63' },
  { value: 60, label: 'Каждый час', color: '#e91e63' },
];

export default function NotificationRepeatModal({ isOpen, onClose }: Props) {
  const { notificationRepeat, setNotificationRepeat } = useSettings();
  const { showToast } = useUI();
  const { t } = useI18n();

  const handleSelect = useCallback(async (value: number) => {
    setNotificationRepeat(value);
    try {
      const res = await api.post<{ success?: boolean; error?: string }>('/api/notification-repeat', { minutes: value });
      if (res?.error) {
        showToast(res.error, true);
        return;
      }
      showToast(t('Сохранено'), false);
    } catch (e) {
      showToast(apiErrorMessage(e, t('Ошибка сети')), true);
    }
  }, [setNotificationRepeat, showToast, t]);

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title={t('Повтор уведомлений')}>
      <div className={styles.options}>
        {options.map(opt => {
          const active = notificationRepeat === opt.value;
          return (
            <div
              key={opt.value}
              className={`${styles.option} ${active ? styles.selected : ''}`}
              style={active ? { background: `${opt.color}26`, borderColor: opt.color } : undefined}
              onClick={() => handleSelect(opt.value)}
            >
              <span>{t(opt.label)}</span>
              {active && (
                <div className={styles.checkCircle} style={{ background: opt.color }}>
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
