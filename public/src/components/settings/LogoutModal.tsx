import { useCallback, useRef } from 'react';
import { useAuthContext } from '../../context/AuthContext';
import { useI18n } from '../../hooks/useI18n';
import ModalShell from './ModalShell';
import styles from './LogoutModal.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function LogoutModal({ isOpen, onClose }: Props) {
  const { t } = useI18n();
  const { logout } = useAuthContext();
  const closeRef = useRef<(() => void) | null>(null);

  const handleLogout = useCallback(async () => {
    await logout();
    onClose();
  }, [logout, onClose]);

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title="" showClose={false} closeRef={closeRef}>
      <div className={styles.iconCircle}>
        <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#ff3b30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </div>

      <h2 className={styles.title}>{t('Выход из аккаунта')}</h2>
      <p className={styles.description}>
        {t('Вы действительно хотите выйти из своего аккаунта?')}
      </p>

      <div className={styles.actions}>
        <button className={styles.logoutBtn} onClick={handleLogout}>
          {t('Выйти')}
        </button>
        <button className={styles.cancelBtn} onClick={() => closeRef.current?.()}>
          {t('Отмена')}
        </button>
      </div>
    </ModalShell>
  );
}
