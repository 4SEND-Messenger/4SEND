import { useState, useCallback } from 'react';
import { useUI } from '../../context/UIContext';
import { useI18n } from '../../hooks/useI18n';
import { api, apiErrorMessage } from '../../services/api';
import ModalShell from './ModalShell';
import styles from './SubModalInputs.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function PanicPasswordModal({ isOpen, onClose }: Props) {
  const { showToast } = useUI();
  const { t } = useI18n();
  const [password, setPassword] = useState('');
  const [panicPassword, setPanicPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSetup = useCallback(async () => {
    if (!password || !panicPassword) {
      showToast(t('Заполните все поля'), true);
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<{ success?: boolean; error?: string }>('/api/panic-password/setup', {
        password, panicPassword,
      });
      if (res.success) {
        showToast(t('Паник-пароль установлен'), false);
        onClose();
      } else {
        showToast(res.error || t('Ошибка'), true);
      }
    } catch (e) {
      showToast(apiErrorMessage(e, t('Ошибка сети')), true);
    } finally {
      setLoading(false);
    }
  }, [password, panicPassword, showToast, t, onClose]);

  return (
      <ModalShell isOpen={isOpen} onClose={onClose} title={t('Тревожный пароль')} danger dangerColor="#ff3b30">
      <div className={styles.warningText}>
        {t('Ввод этого пароля при входе')} <b>{t('навсегда удалит')}</b> {t('ваш аккаунт, сообщения и файлы.')}
      </div>
      <div className={styles.fieldGroup}>
        <input className={styles.input} type="password" maxLength={30}
          placeholder={t('Основной пароль')}
          value={password} onChange={e => setPassword(e.target.value)} />
      </div>
      <div className={styles.fieldGroup}>
        <input className={`${styles.input} ${styles.dangerFocus}`} type="password" maxLength={30}
          placeholder={t('Тревожный пароль')}
          value={panicPassword} onChange={e => setPanicPassword(e.target.value)} />
      </div>
      <button className={`${styles.actionBtn} ${styles.saveBtn}`} onClick={handleSetup} disabled={loading}
        style={{ background: 'linear-gradient(135deg,#ff3b30,#d32f2f)', boxShadow: '0 4px 12px rgba(255,59,48,0.3)' }}>
        {loading ? t('Настройка...') : t('Установить')}
      </button>
    </ModalShell>
  );
}
