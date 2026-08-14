import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { useI18n } from '../hooks/useI18n';
import { saveCurrentAccount } from '../services/storage';
import AuthPattern from '../components/AuthPattern';
import styles from './AuthPage.module.css';

export default function AuthPage() {
  const { login, register, loadAuth } = useAuthContext();
  const { showToast } = useUI();
  const navigate = useNavigate();
  const { t, lang, switchLanguage } = useI18n();

  const [isLogin, setIsLogin] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorPassword, setTwoFactorPassword] = useState('');
  const [show2FA, setShow2FA] = useState(false);
  const [error, setError] = useState('');
  const [terms1, setTerms1] = useState(false);
  const [terms2, setTerms2] = useState(false);
  const [loading, setLoading] = useState(false);

  const toggleLang = useCallback(() => {
    switchLanguage(lang === 'en' ? 'ru' : 'en');
  }, [lang, switchLanguage]);

  const handleModeSwitch = useCallback((loginMode: boolean) => {
    setIsLogin(loginMode);
    setError('');
    setShow2FA(false);
    setTwoFactorPassword('');
  }, []);

  const handleSubmit = useCallback(async () => {
    const u = username.trim();
    const p = password.trim();

    if (!u || !p) return;

    if (!isLogin && (!terms1 || !terms2)) {
      setError(t('Примите условия и политику конфиденциальности'));
      return;
    }

    if (!/^[a-z]+$/.test(u) || u.length < 4 || u.length > 20) {
      setError(t('Логин: только строчные буквы, от 4 до 20 символов'));
      return;
    }

    if (p.length < 8 || p.length > 30) {
      setError(t('Пароль должен быть от 8 до 30 символов'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const body: Record<string, unknown> = {
        username: u,
        password: p,
        termsAccepted: !isLogin,
      };

      const fap = twoFactorPassword.trim();
      if (fap) body.twoFactorPassword = fap;

      const endpoint = isLogin
        ? fap ? '/auth/login/2fa' : '/auth/login'
        : '/auth/register';

      const API_BASE = import.meta.env.VITE_API_URL ?? 'https://4send-messenger.hf.space';
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Language': localStorage.getItem('4send_language') || 'ru' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const d = await res.json();

        if (d.requires2FA) {
          setShow2FA(true);
          setError(t('У вас установлен пароль двухфакторной аутентификации'));
          setLoading(false);
          return;
        }

        localStorage.setItem('4send_user', d.username);
        localStorage.setItem('4send_avatar', d.avatar || '');
        localStorage.setItem('4send_role', d.role || 'user');
        localStorage.setItem('4send_isVerified', d.isVerified ? '1' : '0');
        if (d.token) localStorage.setItem('4send_token', d.token);
        if (d.displayName) {
          localStorage.setItem('4send_displayName', d.displayName);
        } else {
          localStorage.removeItem('4send_displayName');
        }

        await saveCurrentAccount();
        await loadAuth();

        setError('');
        setShow2FA(false);
        setTimeout(() => {
          navigate('/' + window.location.search);
        }, 600);
      } else {
        const errData = await res.json();
        const msg = errData.error || t('Ошибка авторизации');
        setError(msg);
        showToast(msg, true);
      }
    } catch {
      setError(t('Ошибка авторизации'));
    } finally {
      setLoading(false);
    }
  }, [username, password, twoFactorPassword, isLogin, terms1, terms2, t, showToast, loadAuth, navigate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleSubmit();
    }
  }, [handleSubmit, loading]);

  return (
    <div className={styles.authScreen}>
      <AuthPattern />
      <div className={styles.authCard}>
        <div className={styles.langToggle} onClick={toggleLang}>
          <svg viewBox="0 0 24 24">
            <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm6.93 6h-2.95c-.32-1.25-.78-2.45-1.38-3.56 1.84.63 3.37 1.91 4.33 3.56zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2s.06 1.34.14 2H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56-1.84-.63-3.37-1.9-4.33-3.56zm2.95-8H5.08c.96-1.66 2.49-2.93 4.33-3.56C8.81 5.55 8.35 6.75 8.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66c-.09-.66-.16-1.32-.16-2s.07-1.35.16-2h4.68c.09.65.16 1.32.16 2s-.07 1.34-.16 2zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95c-.96 1.65-2.49 2.93-4.33 3.56zM16.36 14c.08-.66.14-1.32.14-2s-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z" />
          </svg>
          <span>{lang === 'en' ? 'EN' : 'RU'}</span>
        </div>

        <div className={styles.authLogo}>
          <img src="/ico.png" alt="4SEND" width="40" height="40" style={{ borderRadius: 10 }} />
        </div>

        <h1 className={styles.authTitle}>4SEND</h1>

        <div className={styles.authTabs}>
          <div
            className={`${styles.authTab} ${isLogin ? styles.active : ''}`}
            onClick={() => handleModeSwitch(true)}
          >
            {t('Вход')}
          </div>
          <div
            className={`${styles.authTab} ${!isLogin ? styles.active : ''}`}
            onClick={() => handleModeSwitch(false)}
          >
            {t('Регистрация')}
          </div>
        </div>

        {!show2FA ? (
          <>
            <div className={styles.inputGroup}>
              <input
                type="text"
                placeholder={t('Имя пользователя')}
                maxLength={20}
                autoComplete="off"
                value={username}
                onChange={e => setUsername(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <svg className={styles.inputIcon} viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>

            <div className={styles.inputGroup}>
              <input
                type="password"
                placeholder={t('Пароль')}
                maxLength={30}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <svg className={styles.inputIcon} viewBox="0 0 24 24">
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
              </svg>
            </div>

            {!isLogin && (
              <div className={styles.termsBox}>
                <label className={styles.termsLabel}>
                  <input
                    type="checkbox"
                    checked={terms1}
                    onChange={e => setTerms1(e.target.checked)}
                  />
                  <span className={styles.checkmark} />
                  <div className={styles.termsText}>
                    {t('Я согласен с')}{' '}
                    <a href="/terms.html" target="_blank" rel="noreferrer">
                      {t('условиями пользования мессенджера')}
                    </a>
                  </div>
                </label>
                <label className={styles.termsLabel}>
                  <input
                    type="checkbox"
                    checked={terms2}
                    onChange={e => setTerms2(e.target.checked)}
                  />
                  <span className={styles.checkmark} />
                  <div className={styles.termsText}>
                    {t('Я согласен с')}{' '}
                    <a href="/privacy.html" target="_blank" rel="noreferrer">
                      {t('политикой конфиденциальности мессенджера')}
                    </a>
                  </div>
                </label>
              </div>
            )}
          </>
        ) : (
          <div className={styles.twoFAContainer}>
            <div className={styles.inputGroup}>
              <input
                type="password"
                placeholder={t('Пароль 2FA')}
                maxLength={30}
                autoComplete="off"
                value={twoFactorPassword}
                onChange={e => setTwoFactorPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
              />
              <svg className={styles.inputIcon} viewBox="0 0 24 24">
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
              </svg>
            </div>
            <div className={styles.backLink} onClick={() => { setShow2FA(false); setTwoFactorPassword(''); setError(''); }}>
              {t('Назад')}
            </div>
          </div>
        )}

        <button
          className={styles.submitBtn}
          onClick={handleSubmit}
          disabled={loading}
        >
          {isLogin ? t('ВОЙТИ') : t('ЗАРЕГИСТРИРОВАТЬСЯ')}
        </button>

        <div className={`${styles.error} ${show2FA && error ? styles.info : ''}`}>{error}</div>
      </div>
    </div>
  );
}
