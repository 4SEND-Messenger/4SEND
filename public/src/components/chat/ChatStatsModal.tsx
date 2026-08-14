import { useState, useEffect } from 'react';
import ModalShell from '../settings/ModalShell';
import { useI18n } from '../../hooks/useI18n';

interface ChatStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: string;
  preloadedData?: { createdAt: string; messageCount: number } | null;
}

interface ChatStats {
  createdAt: string;
  messageCount: number;
}

export default function ChatStatsModal({ isOpen, onClose, target, preloadedData }: ChatStatsModalProps) {
  const { t } = useI18n();
  const [stats, setStats] = useState<ChatStats | null>(preloadedData || null);

  useEffect(() => {
    if (preloadedData) {
      setStats(preloadedData);
    }
  }, [preloadedData]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title={t('Статистика чата')}>
      {stats ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 12 }}>
            <span style={{ color: '#888', fontSize: 14 }}>{t('Создан:')}</span>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{formatDate(stats!.createdAt)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 12 }}>
            <span style={{ color: '#888', fontSize: 14 }}>{t('Сообщений:')}</span>
            <span style={{ color: 'var(--accent-solid)', fontSize: 14, fontWeight: 700 }}>{stats!.messageCount}</span>
          </div>
        </div>
      ) : (
        <p style={{ color: '#ff4d4d', textAlign: 'center', fontSize: 14 }}>{t('Ошибка загрузки')}</p>
      )}
    </ModalShell>
  );
}
