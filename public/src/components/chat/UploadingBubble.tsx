import styles from './UploadingBubble.module.css';
import { getFileExt, getFileTypeColor, hexToRgb } from '../../utils/media';
import { useI18n } from '../../hooks/useI18n';

interface Props {
  fileName: string;
  completed?: boolean;
}

export default function UploadingBubble({ fileName, completed }: Props) {
  const { t } = useI18n();
  const ext = getFileExt(fileName);
  const color = getFileTypeColor(ext);
  const rgb = hexToRgb(color);

  return (
    <div className={`${styles.bubble} ${completed ? styles.fadeOut : ''}`}
      style={{
        background: `rgba(${rgb}, 0.08)`,
        borderColor: `rgba(${rgb}, 0.2)`,
      }}>
      <div className={styles.iconArea} style={{ background: color, boxShadow: `0 4px 10px rgba(${rgb}, 0.3)` }}>
        <div className={styles.spinner} />
      </div>
      <div className={styles.info}>
        <div className={styles.fileName}>{fileName}</div>
        <div className={styles.status} style={{ color }}>{t('Загрузка...')}</div>
      </div>
    </div>
  );
}
