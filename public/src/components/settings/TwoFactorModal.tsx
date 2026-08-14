import { useState, useEffect, useCallback } from 'react';
import { useUI } from '../../context/UIContext';
import { useI18n } from '../../hooks/useI18n';
import { api } from '../../services/api';
import ModalShell from './ModalShell';
import styles from './SubModalInputs.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function TwoFactorModal({ isOpen, onClose }: Props) {
  const { showToast } = useUI();
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(false);
  const [password, setPassword] = useState('');
  const [twoFactorPassword, setTwoFactorPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setFetching(true);
    api.get<{ enabled: boolean }>('/api/2fa/status').then((res) => {
      setEnabled(res.enabled);
    }).catch(() => {}).finally(() => setFetching(false));
  }, [isOpen]);

  const handleEnable = useCallback(async () => {
    if (!password || !twoFactorPassword) {
      showToast(t('Заполните все поля'), true);
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<{ success?: boolean; error?: string }>('/api/2fa/setup', {
        password, twoFactorPassword,
      });
      if (res.success) {
        showToast(t('2FA включена'), false);
        setEnabled(true);
        setPassword('');
        setTwoFactorPassword('');
      } else {
        showToast(res.error || t('Ошибка'), true);
      }
    } catch {
      showToast(t('Ошибка сети'), true);
    } finally {
      setLoading(false);
    }
  }, [password, twoFactorPassword, showToast, t]);

  const handleDisable = useCallback(async () => {
    if (!password || !twoFactorPassword) {
      showToast(t('Заполните все поля'), true);
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<{ success?: boolean; error?: string }>('/api/2fa/disable', {
        password, twoFactorPassword,
      });
      if (res.success) {
        showToast(t('2FA отключена'), false);
        setEnabled(false);
        setPassword('');
        setTwoFactorPassword('');
      } else {
        showToast(res.error || t('Ошибка'), true);
      }
    } catch {
      showToast(t('Ошибка сети'), true);
    } finally {
      setLoading(false);
    }
  }, [password, twoFactorPassword, showToast, t]);

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title={t('Двухфакторная аутентификация')}>
      {fetching ? (
        <div style={{ color: '#888', textAlign: 'center', marginBottom: 20 }}>{t('Загрузка...')}</div>
      ) : (
        <>
          <div className={`${styles.statusBadge} ${enabled ? styles.statusEnabled : styles.statusDisabled}`}>
            {enabled ? t('2FA включена') : t('Статус: Отключена')}
          </div>
          {!enabled && (
            <div className={styles.infoText}>
              {t('Установите дополнительный пароль для защиты аккаунта.')}
            </div>
          )}
          <div className={styles.fieldGroup}>
            <input className={styles.input} type="password" maxLength={30}
              placeholder={t('Основной пароль')}
              value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <div className={styles.fieldGroup}>
            <input className={styles.input} type="password" maxLength={30}
              placeholder={enabled ? t('Текущий 2FA пароль') : t('Новый 2FA пароль')}
              value={twoFactorPassword} onChange={e => setTwoFactorPassword(e.target.value)} />
          </div>
          {enabled ? (
            <button className={`${styles.actionBtn} ${styles.dangerBtn}`} onClick={handleDisable} disabled={loading}>
              {loading ? t('Отключение...') : t('Отключить 2FA')}
            </button>
          ) : (
            <button className={`${styles.actionBtn} ${styles.saveBtn}`} onClick={handleEnable} disabled={loading}>
              {loading ? t('Включение...') : t('Включить 2FA')}
            </button>
          )}
        </>
      )}
    </ModalShell>
  );
}
