import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../../hooks/useI18n';
import { api } from '../../services/api';
import ModalShell from './ModalShell';
import styles from './ArchivePasswordModal.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  mode: 'setup' | 'remove' | 'change';
}

export default function ArchivePasswordModal({ isOpen, onClose, mode }: Props) {
  const { t } = useI18n();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [step, setStep] = useState<'info' | 'input' | 'new'>('info');
  const [error, setError] = useState('');
  const [action, setAction] = useState<'setup' | 'remove' | 'change' | null>(null);

  const effectiveMode = action || mode;
  const isSetup = effectiveMode === 'setup';
  const isChange = effectiveMode === 'change';
  const isRemove = effectiveMode === 'remove';

  useEffect(() => {
    if (!isOpen) return;
    setOldPassword('');
    setNewPassword('');
    setError('');
    setStep('info');
    setAction(null);
    api.get<{ hasPassword: boolean }>('/api/archive/password/status')
      .then((res) => {
        setHasPassword(res.hasPassword);
        if (mode !== 'setup') setStep('input');
      })
      .catch(() => setHasPassword(false));
  }, [isOpen, mode]);

  const handleSetup = useCallback(async () => {
    if (!newPassword) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post<{ success?: boolean; error?: string }>('/api/archive/password/setup', { password: newPassword });
      if (res.success) {
        localStorage.setItem('4send_archive_has_password', '1');
        onClose();
      } else setError(res.error || t('Ошибка'));
    } catch {
      setError(t('Ошибка сети'));
    } finally {
      setLoading(false);
    }
  }, [newPassword, onClose, t]);

  const handleRemove = useCallback(async () => {
    if (!oldPassword) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post<{ success?: boolean; error?: string }>('/api/archive/password/remove', { password: oldPassword });
      if (res.success) {
        localStorage.removeItem('4send_archive_has_password');
        onClose();
      } else setError(res.error || t('Ошибка'));
    } catch {
      setError(t('Ошибка сети'));
    } finally {
      setLoading(false);
    }
  }, [oldPassword, onClose, t]);

  const handleChange = useCallback(async () => {
    if (!oldPassword || !newPassword) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post<{ success?: boolean; error?: string }>('/api/archive/password/change', { oldPassword, newPassword });
      if (res.success) {
        onClose();
      } else setError(res.error || t('Ошибка'));
    } catch {
      setError(t('Ошибка сети'));
    } finally {
      setLoading(false);
    }
  }, [oldPassword, newPassword, onClose, t]);

  const title = isSetup
    ? (hasPassword ? t('Пароль на архив') : t('Настройки архива'))
    : isChange
      ? t('Смена пароля')
      : t('Удаление пароля');

  if (step === 'info' && mode === 'setup' && !hasPassword) {
    return (
      <ModalShell isOpen={isOpen} onClose={onClose} title={t('Настройки архива')}>
        <div className={styles.status}>{t('Пароль не установлен')}</div>
        <button className={styles.setupBtn} onClick={() => setStep('input')}>
          {t('Установить пароль')}
        </button>
      </ModalShell>
    );
  }

  if (mode === 'setup' && hasPassword && step === 'info') {
    return (
      <ModalShell isOpen={isOpen} onClose={onClose} title={t('Пароль на архив')}>
        <div className={styles.status}>{t('Пароль установлен')}</div>
        <div className={styles.buttonGroup}>
          <button className={styles.actionBtn} onClick={() => { setAction('change'); setStep('input'); setOldPassword(''); setError(''); }}>
            {t('Сменить пароль')}
          </button>
          <button className={styles.dangerBtn} onClick={() => { setAction('remove'); setStep('input'); setOldPassword(''); setError(''); }}>
            {t('Удалить пароль')}
          </button>
        </div>
      </ModalShell>
    );
  }

  if ((mode === 'change' || action === 'change') && step === 'input') {
    return (
      <ModalShell isOpen={isOpen} onClose={onClose} title={t('Смена пароля')}>
        <div className={styles.fieldGroup}>
          <label className={styles.label}>{t('Текущий пароль')}</label>
          <input
            className={styles.input}
            type="password"
            placeholder={t('Введите текущий пароль')}
            value={oldPassword}
            onChange={e => { setOldPassword(e.target.value); setError(''); }}
            autoFocus
          />
        </div>
        {error && <div className={styles.error}>{error}</div>}
        <button className={styles.actionBtn} onClick={() => { if (oldPassword) { setStep('new'); setError(''); } }}
          disabled={!oldPassword}>
          {t('Далее')}
        </button>
      </ModalShell>
    );
  }

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title={title}>
      {isChange && (
        <div className={styles.fieldGroup}>
          <label className={styles.label}>{t('Новый пароль')}</label>
          <input
            className={styles.input}
            type="password"
            placeholder={t('Введите новый пароль')}
            value={newPassword}
            onChange={e => { setNewPassword(e.target.value); setError(''); }}
            autoFocus
          />
        </div>
      )}
      {!isChange && (
        <div className={styles.fieldGroup}>
          <label className={styles.label}>
            {isSetup ? t('Новый пароль') : t('Текущий пароль')}
          </label>
          <input
            className={styles.input}
            type="password"
            placeholder={isSetup ? t('Введите пароль') : t('Введите текущий пароль')}
            value={oldPassword}
            onChange={e => { setOldPassword(e.target.value); setError(''); }}
            autoFocus
          />
        </div>
      )}
      {error && <div className={styles.error}>{error}</div>}
      {isSetup ? (
        <button className={styles.actionBtn} onClick={handleSetup}
          disabled={loading || !newPassword}>
          {loading ? t('Загрузка...') : t('Установить')}
        </button>
      ) : isChange ? (
        <button className={styles.actionBtn} onClick={handleChange}
          disabled={loading || !newPassword}>
          {loading ? t('Загрузка...') : t('Изменить')}
        </button>
      ) : (
        <button className={styles.dangerBtn} onClick={handleRemove}
          disabled={loading || !oldPassword}>
          {loading ? t('Загрузка...') : t('Удалить')}
        </button>
      )}
    </ModalShell>
  );
}