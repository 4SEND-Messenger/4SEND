import { useState, useCallback, useRef } from 'react';
import { useAuthContext } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { useI18n } from '../../hooks/useI18n';
import { api, apiErrorMessage } from '../../services/api';
import ModalShell from './ModalShell';
import styles from './SubModalInputs.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function PasswordModal({ isOpen, onClose }: Props) {
  const { me } = useAuthContext();
  const { showToast } = useUI();
  const { t } = useI18n();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const closeRef = useRef<(() => void) | null>(null);

  const handleSave = useCallback(async () => {
    if (!oldPassword || !newPassword) {
      showToast(t('Заполните все поля'), true);
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<{ success?: boolean; error?: string }>('/auth/profile-update', {
        newUsername: me, oldPassword, newPassword,
      });
      if (res.success) {
        showToast(t('Пароль изменён'), false);
        closeRef.current?.();
      } else {
        showToast(res.error || t('Ошибка'), true);
      }
    } catch (e) {
      showToast(apiErrorMessage(e, t('Ошибка сети')), true);
    } finally {
      setLoading(false);
    }
  }, [oldPassword, newPassword, me, showToast, t]);

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title={t('Изменить пароль')} showClose={false} closeRef={closeRef}>
      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>{t('Старый пароль')}</label>
        <input className={styles.input} type="password" maxLength={30}
          placeholder={t('Введите старый пароль')}
          value={oldPassword} onChange={e => setOldPassword(e.target.value)} />
      </div>
      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>{t('Новый пароль')}</label>
        <input className={styles.input} type="password" maxLength={30}
          placeholder={t('Введите новый пароль')}
          value={newPassword} onChange={e => setNewPassword(e.target.value)} />
      </div>
      <button className={`${styles.actionBtn} ${styles.saveBtn}`} onClick={handleSave} disabled={loading}>
        {loading ? t('Сохранение...') : t('Сохранить')}
      </button>
      <button className={styles.closeBtn} onClick={() => closeRef.current?.()} style={{
        width: '100%', padding: 16, background: 'rgba(var(--accent-rgb), 0.15)', color: '#fff',
        border: '2px solid rgba(var(--accent-rgb), 0.3)', borderRadius: 14, cursor: 'pointer',
        fontSize: 16, fontWeight: 600, transition: 'all 0.2s ease',
        fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif'
      }}>{t('Закрыть')}</button>
    </ModalShell>
  );
}
