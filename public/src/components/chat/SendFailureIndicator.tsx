import styles from './SendFailureIndicator.module.css';
import { useI18n } from '../../hooks/useI18n';

interface SendFailureIndicatorProps {
  messageId: string;
  onRetry: (messageId: string) => void;
  onRemove: (messageId: string) => void;
}

export default function SendFailureIndicator({ messageId, onRetry, onRemove }: SendFailureIndicatorProps) {
  const { t } = useI18n();
  return (
    <div className={styles.container}>
      <svg viewBox="0 0 24 24" className={styles.warningIcon}>
        <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
      </svg>
      <span className={styles.text}>{t('Не удалось отправить')}</span>
      <button className={styles.retryBtn} onClick={() => onRetry(messageId)}>
        {t('Повторить')}
      </button>
      <button className={styles.removeBtn} onClick={() => onRemove(messageId)}>
        {t('Удалить')}
      </button>
    </div>
  );
}
