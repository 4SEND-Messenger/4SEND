import { useCallback } from 'react';
import { useI18n } from '../../hooks/useI18n';
import styles from './ScheduleMessagesList.module.css';

interface ScheduledMessage {
  id: string;
  text: string;
  sendAt: Date;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  messages: ScheduledMessage[];
  onCancel: (id: string) => void;
}

export default function ScheduleMessagesList({ isOpen, onClose, messages, onCancel }: Props) {
  const { t } = useI18n();

  const handleCancel = useCallback((id: string) => {
    onCancel(id);
  }, [onCancel]);

  if (!isOpen) return null;

  const formatTime = (date: Date) => {
    const d = new Date(date);
    const isToday = d.toDateString() === new Date().toDateString();
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return t('Сегодня') + ' ' + time;
    return d.toLocaleDateString([], { day: 'numeric', month: 'long' }) + ' ' + t('в') + ' ' + time;
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.title}>{t('Отложенные сообщения')}</div>

        {messages.length === 0 ? (
          <div className={styles.empty}>{t('Нет отложенных сообщений')}</div>
        ) : (
          <div className={styles.list}>
            {messages.map(msg => (
              <div key={msg.id} className={styles.item}>
                <div className={styles.itemContent}>
                  <div className={styles.text}>
                    {msg.text.length > 50 ? msg.text.slice(0, 50) + '...' : msg.text}
                  </div>
                  <div className={styles.time}>{formatTime(msg.sendAt)}</div>
                </div>
                <button className={styles.cancelBtn} onClick={() => handleCancel(msg.id)}>
                  <svg viewBox="0 0 24 24" className={styles.cancelIcon}>
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <button className={styles.closeBtn} onClick={onClose}>{t('Закрыть')}</button>
      </div>
    </div>
  );
}
