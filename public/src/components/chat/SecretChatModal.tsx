import ModalShell from '../settings/ModalShell';
import { Lock } from '../../utils/svg';
import { useI18n } from '../../hooks/useI18n';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  contactDisplayName?: string;
  hasE2EESession: boolean;
  onStartSecret: () => void;
}

export default function SecretChatModal({ isOpen, onClose, contactDisplayName, hasE2EESession, onStartSecret }: Props) {
  const { t } = useI18n();
  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title={t('Секретный чат')} showClose={false}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: 'rgba(var(--accent-rgb, 157, 78, 221), 0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--accent-solid)',
        }}>
          <Lock width={22} height={22} />
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, textAlign: 'center', margin: 0 }}>
          {t('Сообщения в секретном чате защищены сквозным шифрованием (E2EE). Только вы и ')}{contactDisplayName || t('собеседник')}{t(' можете их прочитать. Никто, включая 4SEND, не имеет доступа к этим сообщениям.')}
        </p>
      </div>

      {!hasE2EESession && (
        <button
          onClick={() => { onStartSecret(); onClose(); }}
          style={{
            width: '100%', padding: '14px 0',
            background: 'var(--accent-solid)',
            color: 'var(--on-accent, #fff)', border: 'none', borderRadius: 14,
            fontSize: 16, fontWeight: 700, cursor: 'pointer',
            transition: 'opacity 0.2s',
            marginBottom: 12,
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          {t('Начать секретный чат')}
        </button>
      )}

      <button
        onClick={onClose}
        style={{
          width: '100%', padding: '14px 0',
          background: 'rgba(var(--accent-rgb, 157, 78, 221), 0.1)',
          color: 'var(--text-primary)', border: '1px solid rgba(var(--accent-rgb, 157, 78, 221), 0.25)',
          borderRadius: 14, fontSize: 15, fontWeight: 600, cursor: 'pointer',
          transition: 'opacity 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
      >
        {hasE2EESession ? t('Закрыть') : t('Отмена')}
      </button>
    </ModalShell>
  );
}
