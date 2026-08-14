import styles from './ForwardedMessage.module.css';
import { useI18n } from '../../hooks/useI18n';

interface Props {
  from: string;
}

export default function ForwardedMessage({ from }: Props) {
  const { t } = useI18n();
  return (
    <div className={styles.container}>
      <svg viewBox="0 0 24 24" className={styles.icon}>
        <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" />
      </svg>
      <div className={styles.label}>{t('Переслано от')} {from}</div>
    </div>
  );
}
