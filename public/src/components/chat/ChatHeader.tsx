import { useCallback, useState } from 'react';
import { useI18n } from '../../hooks/useI18n';
import { Lock, ArrowBack, FilledSearch, Phone, VideoCall, MoreVert } from '../../utils/svg';

import type { ContactItem } from '../../types/user';

interface Props {
  target: string | null;
  me: string;
  chatName: string;
  chatAvatar: string;
  chatVerified: boolean;
  chatStatus: string;
  chatStatusColor: string;
  contacts: ContactItem[];
  onlineUsers: Set<string>;
  multiSelectMode: boolean;
  onBack: () => void;
  onProfileOpen: () => void;
  onSearchToggle: () => void;
  onCall: (target: string, displayName: string, avatar?: string) => void;
  onVideoCall?: (target: string, displayName: string, avatar?: string) => void;
  onMenuOpen: () => void;
  getInitial: (name: string) => string;
  styles: Record<string, string>;
  hasE2EESession?: boolean;
}

export default function ChatHeader({
  target, me, chatName, chatAvatar, chatVerified, chatStatus, chatStatusColor,
  contacts, onlineUsers, multiSelectMode,
  onBack, onProfileOpen, onSearchToggle, onCall, onVideoCall, onMenuOpen, getInitial, styles,
  hasE2EESession
}: Props) {
  const { t } = useI18n();
  const [showCallConfirm, setShowCallConfirm] = useState(false);
  const [callConfirmClosing, setCallConfirmClosing] = useState(false);

  const closeCallConfirm = useCallback(() => {
    if (callConfirmClosing) return;
    setCallConfirmClosing(true);
    window.setTimeout(() => {
      setShowCallConfirm(false);
      setCallConfirmClosing(false);
    }, 180);
  }, [callConfirmClosing]);

  const handleProfileOpen = useCallback(() => {
    if (target) {
      onProfileOpen();
    }
  }, [target, onProfileOpen]);

  const handleAvatarClick = useCallback(() => {
    if (target) {
      onProfileOpen();
    }
  }, [target, onProfileOpen]);

  const handleNameClick = useCallback(() => {
    if (target) {
      onProfileOpen();
    }
  }, [target, onProfileOpen]);

  const handleCall = useCallback(async () => {
    if (!target) return;
    const targetContact = contacts.find(c => c.username.toLowerCase() === target.toLowerCase());
    onCall(target, chatName || targetContact?.displayName || target, targetContact?.avatar);
  }, [target, contacts, chatName, onCall]);

  const handleVideoCall = useCallback(async () => {
    if (!target || !onVideoCall) return;
    const targetContact = contacts.find(c => c.username.toLowerCase() === target.toLowerCase());
    onVideoCall(target, chatName || targetContact?.displayName || target, targetContact?.avatar);
  }, [target, contacts, chatName, onVideoCall]);

  const currentContact = contacts.find(c => c.username.toLowerCase() === target?.toLowerCase() || '');

  return (
    <>
    <div className={`${styles.chatHeader} ${multiSelectMode ? styles.chatHeaderExit : ''}`}>
      <div className={styles.chatHeaderLeft}>
        <button className={styles.mobileBackBtn} onClick={onBack}>
          <ArrowBack />
        </button>
        <div className={`${styles.headerAvatar} ${target ? styles.visible : ''}`} style={{ cursor: 'pointer' }} onClick={handleAvatarClick}>
          {target && me && target.toLowerCase() === me.toLowerCase() ? (
            <div style={{ width: 42, height: 42, borderRadius: 'var(--avatar-radius, 50%)', clipPath: 'var(--avatar-clip, none)', background: 'var(--accent, #a74fff)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--on-accent, #fff)' }}>
              <svg viewBox="0 0 24 24" style={{ width: '60%', height: '60%', fill: 'currentColor' }}>
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
              </svg>
            </div>
          ) : chatAvatar ? (
            <img src={chatAvatar} alt="" style={{ width: 42, height: 42, borderRadius: 'var(--avatar-radius, 50%)', clipPath: 'var(--avatar-clip, none)', objectFit: 'cover', cursor: 'pointer' }} />
          ) : (
            <div style={{ width: 42, height: 42, borderRadius: 'var(--avatar-radius, 50%)', clipPath: 'var(--avatar-clip, none)', background: 'linear-gradient(135deg, var(--accent-solid), #6a11cb)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 18, cursor: 'pointer' }}>
              {getInitial(chatName || target || '?')}
            </div>
          )}
        </div>
        <div style={{ cursor: 'pointer' }} onClick={handleNameClick}>
          <div className={styles.chatName}>
            {chatName || target}
            {hasE2EESession && <span style={{ width: 15, height: 15, marginLeft: 2, flexShrink: 0, display: 'inline-flex', color: '#4caf50' }}><Lock /></span>}
            {chatVerified && (
              <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, marginLeft: 2, flexShrink: 0, fill: 'var(--accent-solid)' }}>
                <path d="M23 11.99l-2.44-2.79.34-3.69-3.61-.82-1.89-3.2L12 2.96 8.6 1.5 6.71 4.69 3.1 5.5l.34 3.7L1 11.99l2.44 2.79-.34 3.7 3.61.82L8.6 22.5l3.4-1.47 3.4 1.46 1.89-3.19 3.61-.82-.34-3.69L23 11.99zm-12.93 4.46l-3.53-3.54 1.41-1.41 2.12 2.12 4.24-4.24 1.41 1.41-5.65 5.66z"/>
              </svg>
            )}
          </div>
          <small className={styles.chatStatus} style={{ color: chatStatusColor }}>{chatStatus}</small>
        </div>
      </div>
      <button className={styles.controlBtn} style={{ marginRight: 8 }} onClick={onSearchToggle}>
        <FilledSearch />
      </button>

      {target !== me && target !== '4send_system' && target !== '4send_help' && !currentContact?.isRoom && !target?.startsWith('secret::') && (
        <button className={styles.controlBtn} style={{ marginRight: 8 }} onClick={() => setShowCallConfirm(true)}>
          <Phone />
        </button>
      )}
      <button className={styles.controlBtn} onClick={onMenuOpen}>
        <MoreVert />
      </button>
    </div>

    {showCallConfirm && (
      <div
        className={`${styles.callConfirmOverlay} ${callConfirmClosing ? styles.callConfirmClosing : ''}`}
        onClick={closeCallConfirm}
      >
        <div
          className={`${styles.callConfirmBox} ${callConfirmClosing ? styles.callConfirmBoxClosing : ''}`}
          onClick={e => e.stopPropagation()}
        >
          <div className={styles.callConfirmIcon}>
            <svg viewBox="0 0 24 24">
              <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
            </svg>
          </div>
          <div className={styles.callConfirmTitle}>{t('Вы действительно хотите позвонить?')}</div>
          <div className={styles.callConfirmSubtitle}>{chatName || target}</div>
          <div className={styles.callConfirmActions}>
            <button
              className={`${styles.callConfirmBtn} ${styles.callConfirmBtnPrimary}`}
              onClick={() => { closeCallConfirm(); handleCall(); }}
            >
              <Phone width={18} height={18} />
              {t('Обычный звонок')}
            </button>
            <button
              className={`${styles.callConfirmBtn} ${styles.callConfirmBtnSecondary}`}
              onClick={() => { closeCallConfirm(); handleVideoCall(); }}
            >
              <VideoCall width={18} height={18} />
              {t('Видеозвонок')}
            </button>
            <button
              className={`${styles.callConfirmBtn} ${styles.callConfirmBtnGhost}`}
              onClick={closeCallConfirm}
            >
              {t('Отмена')}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}