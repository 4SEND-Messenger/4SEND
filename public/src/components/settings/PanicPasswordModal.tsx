import { useState, useCallback, useEffect } from 'react';
import { useUI } from '../../context/UIContext';
import { useI18n } from '../../hooks/useI18n';
import { api, apiErrorMessage } from '../../services/api';
import ModalShell from './ModalShell';
import styles from './SubModalInputs.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'info' | 'setup' | 'change' | 'remove';

export default function PanicPasswordModal({ isOpen, onClose }: Props) {
  const { showToast } = useUI();
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(false);
  const [checked, setChecked] = useState(false);
  const [step, setStep] = useState<Step>('info');
  const [password, setPassword] = useState('');
  const [panicPassword, setPanicPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setStep('info');
    setPassword('');
    setPanicPassword('');
    setError('');
    setChecked(false);
    api
      .get<{ enabled?: boolean }>('/api/panic-password/status')
      .then(r => {
        setEnabled(!!r.enabled);
        setChecked(true);
      })
      .catch(() => setChecked(true));
  }, [isOpen]);

  const handleSetup = useCallback(async () => {
    if (!password || !panicPassword) {
      setError(t('Заполните все поля'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.post<{ success?: boolean; error?: string }>('/api/panic-password/setup', {
        password, panicPassword,
      });
      if (res.success) {
        setEnabled(true);
        setPassword('');
        setPanicPassword('');
        setStep('info');
        showToast(t('Паник-пароль установлен'), false);
      } else {
        setError(res.error || t('Ошибка'));
      }
    } catch (e) {
      setError(apiErrorMessage(e, t('Ошибка сети')));
    } finally {
      setLoading(false);
    }
  }, [password, panicPassword, showToast, t]);

  const handleRemove = useCallback(async () => {
    if (!password) {
      setError(t('Введите основной пароль'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.post<{ success?: boolean; error?: string }>('/api/panic-password/remove', { password });
      if (res.success) {
        setEnabled(false);
        setPassword('');
        setPanicPassword('');
        setStep('info');
        showToast(t('Тревожный пароль удалён'), false);
      } else {
        setError(res.error || t('Ошибка'));
      }
    } catch (e) {
      setError(apiErrorMessage(e, t('Ошибка сети')));
    } finally {
      setLoading(false);
    }
  }, [password, showToast, t]);

  const warning = (
    <div className={styles.warningText}>
      {t('Ввод этого пароля при входе')} <b>{t('навсегда удалит')}</b> {t('ваш аккаунт, сообщения и файлы.')}
    </div>
  );

  if (step === 'info') {
    return (
      <ModalShell isOpen={isOpen} onClose={onClose} title={t('Тревожный пароль')} danger dangerColor="#ff3b30">
        {warning}
        {!checked ? (
          <div className={styles.statusBadge}>...</div>
        ) : enabled ? (
          <>
            <div className={`${styles.statusBadge} ${styles.statusEnabled}`}>{t('Тревожный пароль установлен')}</div>
            <div className={styles.buttonGroup}>
              <button className={`${styles.actionBtn} ${styles.saveBtn}`} onClick={() => { setStep('change'); setPassword(''); setPanicPassword(''); setError(''); }}>
                {t('Заменить пароль')}
              </button>
              <button className={`${styles.actionBtn} ${styles.dangerBtn}`} onClick={() => { setStep('remove'); setPassword(''); setError(''); }}>
                {t('Удалить тревожный пароль')}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={`${styles.statusBadge} ${styles.statusDisabled}`}>{t('Тревожный пароль не установлен')}</div>
            <button className={`${styles.actionBtn} ${styles.saveBtn}`} onClick={() => { setStep('setup'); setError(''); }}
              style={{ background: 'linear-gradient(135deg,#ff3b30,#d32f2f)', boxShadow: '0 4px 12px rgba(255,59,48,0.3)' }}>
              {t('Установить')}
            </button>
          </>
        )}
      </ModalShell>
    );
  }

  if (step === 'remove') {
    return (
      <ModalShell isOpen={isOpen} onClose={onClose} title={t('Удаление тревожного пароля')} danger dangerColor="#ff3b30">
        <div className={styles.warningText}>{t('Подтвердите основным паролем, что тревожный пароль больше не нужен.')}</div>
        <div className={styles.fieldGroup}>
          <input className={styles.input} type="password" maxLength={30} autoFocus
            placeholder={t('Основной пароль')}
            value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        {error && <div className={styles.error}>{error}</div>}
        <div className={styles.buttonGroup}>
          <button className={`${styles.actionBtn} ${styles.dangerBtn}`} onClick={handleRemove} disabled={loading}>
            {loading ? t('Удаление...') : t('Удалить')}
          </button>
          <button className={styles.actionBtn} onClick={() => { setStep('info'); setError(''); }} disabled={loading}>
            {t('Отмена')}
          </button>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title={step === 'change' ? t('Заменить тревожный пароль') : t('Тревожный пароль')} danger dangerColor="#ff3b30">
      {warning}
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
      {error && <div className={styles.error}>{error}</div>}
      <div className={styles.buttonGroup}>
        <button className={styles.actionBtn} onClick={handleSetup} disabled={loading}
          style={{ background: 'linear-gradient(135deg,#ff3b30,#d32f2f)', boxShadow: '0 4px 12px rgba(255,59,48,0.3)' }}>
          {loading ? t('Настройка...') : step === 'change' ? t('Заменить') : t('Установить')}
        </button>
        <button className={styles.actionBtn} onClick={() => { setStep('info'); setError(''); }} disabled={loading}>
          {t('Отмена')}
        </button>
      </div>
    </ModalShell>
  );
}