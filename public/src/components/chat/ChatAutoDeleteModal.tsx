import { useState, useCallback, useEffect } from 'react';
import { useI18n } from '../../hooks/useI18n';
import { api } from '../../services/api';
import styles from './ChatAutoDeleteModal.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  target: string;
  currentTimer: number;
  onSave?: (seconds: number) => void;
}

const OPTIONS: Array<{ label: string; seconds: number }> = [
  { label: 'Выключено', seconds: 0 },
  { label: '1 неделя', seconds: 604800 },
  { label: '1 месяц', seconds: 2592000 },
  { label: '3 месяца', seconds: 7776000 },
  { label: '1 год', seconds: 31536000 },
];

export default function ChatAutoDeleteModal({ isOpen, onClose, target, currentTimer, onSave }: Props) {
  const { t } = useI18n();
  const [selected, setSelected] = useState(currentTimer);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [visible, setVisible] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      setClosing(false);
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      setVisible(false);
      onClose();
    }, 400);
  }, [onClose]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [handleClose]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await api.post('/api/toggle-chat-auto-delete', { target, timer: selected });
      onSave?.(selected);
      handleClose();
    } catch {
    } finally {
      setSaving(false);
    }
  }, [target, selected, handleClose]);

  if (!visible) return null;

  return (
    <div className={`${styles.overlay} ${closing ? styles.closing : ''}`} onClick={handleClose}>
      <div className={`${styles.modal} ${closing ? styles.modalClosing : ''}`} onClick={e => e.stopPropagation()}>
        <div className={styles.title}>{t('Автоудаление сообщений')}</div>

        <div className={styles.options}>
          {OPTIONS.map(opt => (
            <button
              key={opt.seconds}
              className={`${styles.option} ${selected === opt.seconds ? styles.selected : ''}`}
              onClick={() => setSelected(opt.seconds)}
            >
              {t(opt.label)}
              {selected === opt.seconds && (
                <svg className={styles.check} viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                </svg>
              )}
            </button>
          ))}
        </div>

        <div className={styles.warning}>
          {t('Сообщения будут автоматически удаляться через указанный период.')}
        </div>

        <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
          {t('Сохранить')}
        </button>
        <button className={styles.closeBtn} onClick={handleClose}>{t('Закрыть')}</button>
      </div>
    </div>
  );
}
