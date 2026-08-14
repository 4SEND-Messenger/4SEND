import { useState, useCallback, useEffect } from 'react';
import { useI18n } from '../../hooks/useI18n';
import { api } from '../../services/api';
import styles from './ArchiveUnlockModal.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ArchiveUnlockModal({ isOpen, onClose, onSuccess }: Props) {
  const { t } = useI18n();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [visible, setVisible] = useState(isOpen);
  const [closing, setClosing] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      setClosing(false);
      setEntered(false);
      setPassword('');
      setError('');
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setEntered(true));
      });
      return () => cancelAnimationFrame(raf);
    }
    return undefined;
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setVisible(false);
      setClosing(false);
      onClose();
    }, 350);
  }, [onClose]);

  useEffect(() => {
    if (!visible) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [visible, handleClose]);

  const handleUnlock = useCallback(async () => {
    if (!password) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post<{ success?: boolean; error?: string }>('/api/archive/password/verify', { password });
      if (res.error) {
        setError(res.error);
        setPassword('');
        setLoading(false);
      } else {
        localStorage.setItem('4send_archive_has_password', '1');
        setPassword('');
        setClosing(true);
        setTimeout(() => {
          setVisible(false);
          setClosing(false);
          onClose();
          onSuccess();
        }, 350);
      }
    } catch {
      setError(t('Ошибка сети'));
      setLoading(false);
    }
  }, [password, onSuccess, onClose, t]);

  if (!visible) return null;

  return (
    <div className={`${styles.overlay} ${entered ? styles.open : ''} ${closing ? styles.closing : ''}`} onClick={handleClose}>
      <div className={`${styles.modal} ${entered ? styles.modalOpen : ''} ${closing ? styles.modalClosing : ''}`} onClick={e => e.stopPropagation()}>
        <div className={styles.lockIcon}>
          <svg viewBox="0 0 24 24" width="52" height="52" fill="none" style={{ stroke: 'var(--accent-solid)' }} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="3" ry="3" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            <circle cx="12" cy="16" r="1.5" fill="var(--accent-solid)" stroke="none" />
          </svg>
        </div>

        <h3 className={styles.title}>{t('Доступ к архиву')}</h3>

        <input
          className={styles.input}
          type="password"
          placeholder={t('Введите пароль')}
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleUnlock()}
          autoFocus
        />

        {error && <div className={styles.error}>{error}</div>}

        <button className={styles.enterBtn} onClick={handleUnlock} disabled={loading || !password}>
          {loading ? t('Загрузка...') : t('Войти')}
        </button>
        <button className={styles.cancelBtn} onClick={handleClose}>
          {t('Отмена')}
        </button>
      </div>
    </div>
  );
}
