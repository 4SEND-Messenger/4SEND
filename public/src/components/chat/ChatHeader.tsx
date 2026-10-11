import { useCallback } from 'react';
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
        <>
          <button className={styles.controlBtn} style={{ marginRight: 8 }} onClick={handleCall}>
            <Phone />
          </button>
          <button className={styles.controlBtn} style={{ marginRight: 8 }} onClick={handleVideoCall}>
            <VideoCall />
          </button>
        </>
      )}
      <button className={styles.controlBtn} onClick={onMenuOpen}>
        <MoreVert />
      </button>
    </div>
  );
}