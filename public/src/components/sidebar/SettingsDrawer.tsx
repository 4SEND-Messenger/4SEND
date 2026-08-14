import { useCallback, useEffect, useState } from 'react';
import { useAuthContext } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { useI18n } from '../../hooks/useI18n';
import { APP_VERSION } from '../../constants/version';
import MultiAccountModal from '../settings/MultiAccountModal';
import styles from './SettingsDrawer.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings?: () => void;
  onOpenSecurity?: () => void;
  onOpenChatSettings?: () => void;
  onOpenQR?: () => void;
  onToggleArchive?: () => void;
  viewingArchive?: boolean;
  onOpenLogout?: () => void;
  onOpenHelpChat?: () => void;
}

export default function SettingsDrawer({ isOpen, onClose, onOpenSettings, onOpenSecurity, onOpenChatSettings, onOpenQR, onToggleArchive, viewingArchive, onOpenLogout, onOpenHelpChat }: Props) {
  const { me, displayName, avatar, logout } = useAuthContext();
  const { setTarget } = useChat();
  const { t } = useI18n();
  const [showMultiAccount, setShowMultiAccount] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => {
      setClosing(false);
      onClose();
    }, 250);
    return () => clearTimeout(timer);
  }, [closing, onClose]);

  const handleClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
  }, [closing]);

  const handleSavedMessages = useCallback(() => {
    if (me) {
      setTarget(me.toLowerCase());
      handleClose();
    }
  }, [me, setTarget, handleClose]);

  const getInitial = (name: string) => name?.charAt(0)?.toUpperCase() || '?';

  const menuItems: Array<{ label: string; icon: string; onClick?: () => void; stroke?: boolean }> = [
    { label: t('Избранное'), icon: 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z', onClick: handleSavedMessages },
    { label: viewingArchive ? t('Выйти из архива') : t('Архив чатов'), icon: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z', onClick: () => { handleClose(); onToggleArchive?.(); } },
    { label: t('Конфиденциальность'), icon: 'M17 10H16V7C16 4.79 14.21 3 12 3C9.79 3 8 4.79 8 7V10H7C5.9 10 5 10.9 5 12V20C5 21.1 5.9 22 7 22H17C18.1 22 19 21.1 19 20V12C19 10.9 18.1 10 17 10ZM10 7C10 5.9 10.9 5 12 5C13.1 5 14 5.9 14 7V10H10V7ZM12 17C10.9 17 10 16.1 10 15C10 13.9 10.9 13 12 13C13.1 13 14 13.9 14 15C14 16.1 13.1 17 12 17Z', onClick: () => { handleClose(); onOpenSecurity?.(); } },
    { label: t('Настройки чатов'), icon: 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z', onClick: () => { handleClose(); onOpenChatSettings?.(); } },
  ];

  if (!isOpen && !closing) return null;

  const openClass = isOpen && !closing ? styles.open : '';

  return (
    <>
      <div
        className={`${styles.overlay} ${closing ? styles.closing : ''} ${openClass}`}
        onClick={handleClose}
      />
      <div className={`${styles.drawer} ${closing ? styles.closingDrawer : ''} ${openClass}`}>
        <div
          className={styles.iconBtn}
          style={{ position: 'absolute', top: 'max(20px, calc(env(safe-area-inset-top) + 20px))', left: '20px', zIndex: 100 }}
          onClick={(e) => { e.stopPropagation(); handleClose(); onOpenQR?.(); }}
        >
          <svg viewBox="0 0 24 24" style={{ width: 24, height: 24, fill: 'var(--accent-solid)' }}>
            <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm13-2h3v2h-3v-2zm-3 0h2v2h-2v-2zm3 3h3v2h-3v-2zm-3 0h2v2h-2v-2zm3 3h3v2h-3v-2zm-3 0h2v2h-2v-2z" />
          </svg>
        </div>

        <div
          className={styles.iconBtn}
          style={{ position: 'absolute', top: 'max(20px, calc(env(safe-area-inset-top) + 20px))', right: '20px', zIndex: 100 }}
          onClick={(e) => { e.stopPropagation(); handleClose(); onOpenSettings?.(); }}
        >
          <svg viewBox="0 0 24 24" style={{ width: 24, height: 24, fill: 'var(--accent-solid)' }}>
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
          </svg>
        </div>

        <div className={styles.avatarSection}>
          <div className={styles.avatarBox}>
            {avatar ? (
              <img src={avatar} alt="" className={styles.avatarImg} />
            ) : (
              <div className={styles.avatarPlaceholder}>
                {getInitial(displayName || me || '?')}
              </div>
            )}
          </div>
          <div className={styles.userName}>
            {displayName || me}
            <svg
              viewBox="0 0 24 24"
              style={{ width: 18, height: 18, fill: 'var(--accent-solid)', cursor: 'pointer', marginLeft: 4, transition: '0.2s', flexShrink: 0 }}
              onMouseOver={(e) => { (e.currentTarget as SVGSVGElement).style.transform = 'scale(1.2)'; }}
              onMouseOut={(e) => { (e.currentTarget as SVGSVGElement).style.transform = 'scale(1)'; }}
              onClick={(e) => { e.stopPropagation(); setShowMultiAccount(true); }}
            >
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
            </svg>
          </div>
          {me && <div className={styles.drawerUsername}>@{me}</div>}
          <div className={styles.userStatus}>{t('в сети')}</div>
        </div>

        <div className={styles.menuList}>
          {menuItems.map((item, i) => (
            <div key={i} className={styles.menuItem} onClick={() => { handleClose(); item.onClick?.(); }}>
              {item.stroke ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-solid)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={item.icon} />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24">
                  <path d={item.icon} />
                </svg>
              )}
              <span className={styles.menuLabel}>{item.label}</span>
            </div>
          ))}
          <div className={`${styles.menuItem} ${styles.logoutItem}`} onClick={() => { handleClose(); onOpenLogout?.(); }}>
            <svg viewBox="0 0 24 24">
              <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
            </svg>
            <span className={styles.menuLabel}>{t('Выйти из аккаунта')}</span>
          </div>
        </div>

        <div className={styles.bottomSection}>
          <div className={styles.bottomLinks}>
            <a href="/terms.html" target="_blank" rel="noreferrer">{t('Наши условия')}</a>
            <span>•</span>
            <a href="/privacy.html" target="_blank" rel="noreferrer">{t('Наша политика')}</a>
          </div>
          <div className={styles.bottomBrand}>
            <div className={styles.bottomBrandTitle} onClick={() => { handleClose(); onOpenHelpChat?.(); }} style={{ cursor: 'pointer' }}>4SEND</div>
            <a href="/changelog.html" target="_blank" rel="noreferrer" className={styles.bottomBrandVersion} onClick={(e) => e.stopPropagation()}>{t('Версия')} {APP_VERSION}</a>
          </div>
        </div>
      </div>
      <MultiAccountModal isOpen={showMultiAccount} onClose={() => setShowMultiAccount(false)} />
    </>
  );
}
