import styles from './TypingIndicator.module.css';
import { useI18n } from '../../hooks/useI18n';

interface Props {
  username: string;
}

export default function TypingIndicator({ username }: Props) {
  const { t } = useI18n();
  return (
    <div className={styles.container}>
      <div className={styles.dots}>
        <span className={styles.dot} />
        <span className={`${styles.dot} ${styles.dot2}`} />
        <span className={`${styles.dot} ${styles.dot3}`} />
      </div>
      <span>{username} {t('печатает...')}</span>
    </div>
  );
}
