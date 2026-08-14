import { useCallback } from 'react';
import { useI18n } from '../../hooks/useI18n';
import styles from './MultiSelectBar.module.css';

interface MultiSelectBarProps {
  count: number;
  onDelete: () => void;
  onForward: () => void;
  onCancel: () => void;
  visible: boolean;
}

export default function MultiSelectBar({ count, onDelete, onForward, onCancel, visible }: MultiSelectBarProps) {
  const { t } = useI18n();

  const handleCancel = useCallback(() => {
    onCancel();
  }, [onCancel]);

  const handleForward = useCallback(() => {
    onForward();
  }, [onForward]);

  const handleDelete = useCallback(() => {
    onDelete();
  }, [onDelete]);

  return (
    <div className={`${styles.bar} ${visible ? '' : styles.barExit}`}>
      <button className={styles.forward} onClick={handleForward}>
        {t('ПЕРЕСЛАТЬ')} {count}
      </button>
      <button className={styles.delete} onClick={handleDelete}>
        {t('УДАЛИТЬ')} {count}
      </button>
      <div className={styles.spacer} />
      <button className={styles.cancel} onClick={handleCancel}>
        {t('ОТМЕНА')}
      </button>
    </div>
  );
}
