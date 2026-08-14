import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuthContext } from '../../context/AuthContext';
import { useI18n } from '../../hooks/useI18n';
import { api } from '../../services/api';
import ModalShell from './ModalShell';
import styles from './DeleteAccountModal.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function DeleteAccountModal({ isOpen, onClose }: Props) {
  const { t } = useI18n();
  const { me } = useAuthContext();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const userRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (isOpen) {
      setUsername('');
      setPassword('');
      setError('');
      setTimeout(() => userRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleDelete = useCallback(async () => {
    if (!username || !password) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post<{ success?: boolean; error?: string }>('/api/delete-account', { username, password });
      if (res.success) {
        localStorage.clear();
        window.location.href = '/';
      } else {
        setError(res.error || t('Ошибка'));
      }
    } catch {
      setError(t('Ошибка сети'));
    } finally {
      setLoading(false);
    }
  }, [username, password, t]);

  const canSubmit = username.length > 0 && password.length > 0 && !loading;

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title="" showClose={false} danger closeRef={closeRef}>
      <div className={styles.iconCircle}>
        <svg viewBox="0 0 24 24" width="40" height="40" fill="#ff3b30">
          <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
        </svg>
      </div>

      <h2 className={styles.title}>{t('Удаление аккаунта')}</h2>
      <p className={styles.description}>
        {t('Это действие удалит все ваши сообщения и профиль навсегда. Восстановление будет невозможно.')}
      </p>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>{t('Подтвердите действие')}</label>
        <input
          ref={userRef}
          className={styles.input}
          type="text"
          placeholder={t('Введите ваш логин')}
          value={username}
          maxLength={20}
          onChange={e => setUsername(e.target.value)}
        />
        <input
          className={styles.input}
          type="password"
          placeholder={t('Введите ваш пароль')}
          value={password}
          maxLength={30}
          onChange={e => setPassword(e.target.value)}
        />
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.actions}>
        <button className={styles.deleteBtn} onClick={handleDelete} disabled={!canSubmit}>
          {loading ? t('Удаление...') : t('Удалить')}
        </button>
        <button className={styles.closeBtn} onClick={() => closeRef.current?.()}>
          {t('ЗАКРЫТЬ')}
        </button>
      </div>
    </ModalShell>
  );
}
