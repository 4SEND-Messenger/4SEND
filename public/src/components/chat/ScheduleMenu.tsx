import { useState, useCallback } from 'react';
import { useI18n } from '../../hooks/useI18n';
import styles from './ScheduleMenu.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (minutes: number) => void;
}

export default function ScheduleMenu({ isOpen, onClose, onSelect }: Props) {
  const { t } = useI18n();
  const [customMode, setCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState('');

  const handlePreset = useCallback((minutes: number) => {
    onSelect(minutes);
    onClose();
  }, [onSelect, onClose]);

  const handleCustomConfirm = useCallback(() => {
    if (!customValue) return;
    const target = new Date(customValue);
    const diff = Math.floor((target.getTime() - Date.now()) / 60000);
    if (diff > 0) {
      onSelect(diff);
      onClose();
    }
  }, [customValue, onSelect, onClose]);

  const handleClose = useCallback(() => {
    setCustomMode(false);
    setCustomValue('');
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  if (customMode) {
    return (
      <div className={styles.backdrop} onClick={handleClose}>
        <div className={styles.menu} onClick={e => e.stopPropagation()}>
          <div className={styles.customHeader}>{t('Кастомное время')}</div>
          <input
            type="datetime-local"
            className={styles.datetimeInput}
            value={customValue}
            onChange={e => setCustomValue(e.target.value)}
            min={new Date().toISOString().slice(0, 16)}
          />
          <div className={styles.customActions}>
            <button className={styles.customCancel} onClick={() => setCustomMode(false)}>{t('Назад')}</button>
            <button
              className={styles.customConfirm}
              onClick={handleCustomConfirm}
              disabled={!customValue}
            >
              {t('Готово')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.backdrop} onClick={handleClose}>
      <div className={styles.menu} onClick={e => e.stopPropagation()}>
        <button className={styles.option} onClick={() => handlePreset(5)}>
          {t('Через 5 минут')}
        </button>
        <button className={styles.option} onClick={() => handlePreset(30)}>
          {t('Через 30 минут')}
        </button>
        <button className={styles.option} onClick={() => handlePreset(60)}>
          {t('Через 1 час')}
        </button>
        <button className={styles.option} onClick={() => setCustomMode(true)}>
          {t('Кастомное время')}
        </button>
      </div>
    </div>
  );
}
