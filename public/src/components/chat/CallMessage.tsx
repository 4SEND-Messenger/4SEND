import styles from './CallMessage.module.css';
import type { Message } from '../../types/message';
import { useAuthContext } from '../../context/AuthContext';
import { useI18n } from '../../hooks/useI18n';

interface Props {
  message: Message;
  onContextMenu?: (e: React.MouseEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
}

function formatDuration(sec: number): string {
  if (!sec) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return ` ${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function CallMessage({ message, onContextMenu, onClick }: Props) {
  const { me } = useAuthContext();
  const { t } = useI18n();

  const isSent = (message.sender || '').toLowerCase() === (me || '').toLowerCase();
  const callType = message.callType || '';
  const isMissed = callType === 'missed';
  const isRejected = callType === 'rejected';
  const callColor = isMissed || isRejected ? '#ff4d4d' : 'var(--accent-solid)';

  const label = isMissed
    ? t('Пропущенный звонок')
    : isRejected
      ? t('Отклонённый звонок')
      : isSent
        ? t('Исходящий звонок')
        : t('Входящий звонок');

  const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const durStr = formatDuration(message.callDuration || 0);

  return (
    <div className={`${styles.wrapper} ${isSent ? styles.sent : styles.received}`} onContextMenu={onContextMenu} onClick={onClick}>
      <div
        className={`${styles.bubble} ${isSent ? styles.sent : styles.received}`}
        data-id={message.id || message.tempId}
      >
        <div className={styles.topRow}>
          <span className={styles.label}>
            {label}{durStr}
            {message.callWithVideo && (
              <svg viewBox="0 0 24 24" className={styles.videoIcon} style={{ fill: callColor }}>
                <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
              </svg>
            )}
          </span>
          <svg viewBox="0 0 24 24" className={styles.phoneIcon} style={{ fill: callColor }}>
            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
          </svg>
        </div>
        <div className={styles.bottomRow}>
          {(isMissed || isRejected) ? (
            <svg viewBox="0 0 24 24" className={styles.arrowIcon} style={{ fill: callColor, transform: 'rotate(135deg)' }}>
              <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className={styles.arrowIcon} style={{ fill: 'rgba(255,255,255,0.45)', transform: isSent ? 'none' : 'scaleX(-1)' }}>
              <path d="M9 5v2h6.59L4 18.59 5.41 20 17 8.41V15h2V5z" />
            </svg>
          )}
          <span className={styles.time}>{time}</span>
        </div>
      </div>
    </div>
  );
}
