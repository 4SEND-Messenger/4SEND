import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../../hooks/useI18n';
import { api } from '../../services/api';
import ModalShell from './ModalShell';
import styles from './ActiveSessionsModal.module.css';

interface Session {
  token: string;
  device: string;
  ip: string;
  lastActive: string;
  isCurrent?: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
}

function parseDevice(ua: string): string {
  if (!ua) return 'Unknown';
  const lower = ua.toLowerCase();
  if (lower.includes('windows')) return 'Windows';
  if (lower.includes('mac os') || lower.includes('iphone') || lower.includes('ipad')) return 'Apple';
  if (lower.includes('android')) return 'Android';
  if (lower.includes('linux')) return 'Linux';
  return ua.slice(0, 30);
}

function getDeviceIconPath(ua: string): { path: string; color: string } {
  const lower = ua.toLowerCase();
  if (lower.includes('windows')) return { path: 'M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-13.051-1.85z', color: '#00a4ef' };
  if (lower.includes('mac') || lower.includes('iphone') || lower.includes('ipad')) return { path: 'M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.04 2.26-.79 3.59-.76 1.56.04 2.87.74 3.62 1.9-3.22 1.96-2.64 6.58.51 7.86-.68 1.64-1.53 3.22-2.8 4.17zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.3 2.4-2.02 4.36-3.74 4.25z', color: '#fff' };
  if (lower.includes('android')) return { path: 'M17.523 15.341c-.725 0-1.311-.586-1.311-1.311s.586-1.311 1.311-1.311 1.311.586 1.311 1.311-.586 1.311-1.311 1.311zm-11.046 0c-.725 0-1.311-.586-1.311-1.311s.586-1.311 1.311-1.311 1.311.586 1.311 1.311-.586 1.311-1.311 1.311zm11.436-7.25l1.938-3.357a.43.43 0 00-.156-.586.432.432 0 00-.586.156l-1.973 3.418c-1.484-.684-3.164-1.055-4.951-1.055s-3.467.371-4.951 1.055l-1.973-3.418a.432.432 0 00-.586-.156.43.43 0 00-.156.586l1.938 3.357C2.891 9.668.508 13.535.117 18.164h23.766c-.391-4.629-2.773-8.496-5.969-10.073z', color: '#3DDC84' };
  if (lower.includes('linux')) return { path: 'M11.97 0C5.36 0 0 5.36 0 11.97s5.36 11.97 11.97 11.97 11.97-5.36 11.97-11.97S18.58 0 11.97 0zm0 21.82c-5.44 0-9.85-4.41-9.85-9.85s4.41-9.85 9.85-9.85 9.85 4.41 9.85 9.85-4.41 9.85-9.85 9.85z', color: '#FCC624' };
  return { path: 'M4 6h18V4H4c-1.1 0-2 .9-2 2v11H0v3h14v-3H4V6zm19 2h-6c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V9c0-.55-.45-1-1-1zm-1 9h-4v-7h4v7z', color: '#888' };
}

function formatDate(d: string): string {
  try {
    const date = new Date(d);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    const secs = String(date.getSeconds()).padStart(2, '0');
    return `${day}.${month}.${year}, ${hours}:${mins}:${secs}`;
  } catch { return d; }
}

export default function ActiveSessionsModal({ isOpen, onClose, onBack }: Props) {
  const { t } = useI18n();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.get<Session[]>('/api/sessions');
      const arr = Array.isArray(data) ? data : [];
      setSessions(arr.slice().sort((a, b) => (a.isCurrent ? -1 : b.isCurrent ? 1 : 0)));
    } catch {
      setError(t('Ошибка загрузки'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (isOpen) fetchSessions();
  }, [isOpen, fetchSessions]);

  const handleRevokeAll = useCallback(async () => {
    try {
      await api.post('/api/sessions/revoke-all', {});
      setSessions(prev => prev.filter(s => s.isCurrent));
    } catch {}
  }, []);

  const hasOtherSessions = !loading && sessions.some(s => !s.isCurrent);

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title={t('Активные сессии')} onBack={onBack}>
      {error && <div className={styles.error}>{error}</div>}

      {hasOtherSessions && (
        <button className={styles.revokeAllBtn} onClick={handleRevokeAll}>
          {t('Завершить все другие сеансы')}
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      )}

      <div className={styles.sessionsList}>
        {loading ? (
          <div className={styles.loading}>
            <div className={styles.loadingSpinner} />
          </div>
        ) : sessions.length === 0 ? (
          <div className={styles.empty}>{t('Нет активных сессий')}</div>
        ) : (
          sessions.map((session) => {
            const deviceName = parseDevice(session.device);
            const { path: iconPath, color: iconColor } = getDeviceIconPath(session.device);
            return (
              <div
                key={`${session.device}_${session.lastActive}`}
                className={`${styles.sessionCard} ${session.isCurrent ? styles.currentCard : ''}`}
              >
                <div className={styles.sessionIcon}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill={iconColor}>
                    <path d={iconPath} />
                  </svg>
                </div>
                <div className={styles.sessionInfo}>
                  <div className={styles.sessionDevice}>{deviceName}</div>
                  <div className={styles.sessionMeta}>IP: {session.ip}</div>
                  <div className={styles.sessionMeta}>{t('Активность')}: {formatDate(session.lastActive)}</div>
                  {session.isCurrent && <div className={styles.currentBadge}>{t('Текущий сеанс')}</div>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </ModalShell>
  );
}
