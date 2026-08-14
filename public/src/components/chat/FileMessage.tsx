import styles from './FileMessage.module.css';
import { getFileExt, getFileTypeColor, hexToRgb } from '../../utils/media';
import { downloadFile } from '../../utils/download';
import { useI18n } from '../../hooks/useI18n';

interface Props {
  url: string;
  fileName?: string;
  disabled?: boolean;
}

export default function FileMessage({ url, fileName, disabled }: Props) {
  const { t } = useI18n();
  const handleOpen = () => {
    if (disabled) return;
    downloadFile(url, fileName);
  };

  const ext = getFileExt(fileName, url);
  const color = getFileTypeColor(ext);
  const rgb = hexToRgb(color);

  return (
    <div className={`${styles.fileMessage} ${disabled ? styles.fileDisabled : ''}`} onClick={handleOpen}
      style={{
        background: `rgba(${rgb}, 0.08)`,
        borderColor: `rgba(${rgb}, 0.2)`,
      }}>
      <div className={styles.fileIcon} style={{ background: color, boxShadow: `0 4px 10px rgba(${rgb}, 0.3)` }}>
        <svg viewBox="0 0 24 24" className={styles.iconSvg}>
          <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
        </svg>
      </div>
      <div className={styles.fileInfo}>
        <div className={styles.fileName}>{fileName || url.split('/').pop()?.split('?')[0] || t('Файл')}</div>
        <div className={styles.downloadLabel} style={{ color }}>{t('Скачать файл')}</div>
      </div>
    </div>
  );
}
