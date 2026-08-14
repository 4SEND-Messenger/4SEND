import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthContext } from '../../context/AuthContext';
import { useI18n } from '../../hooks/useI18n';
import { api } from '../../services/api';
import ModalShell from './ModalShell';
import styles from './MultiAccountModal.module.css';

interface AccountInfo {
  username: string;
  displayName: string;
  avatarUrl?: string;
  token: string;
  isActive: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const STORAGE_KEY = '4send_accounts';
const TOKEN_KEY = '4send_token';

function loadAccounts(): AccountInfo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAccounts(accounts: AccountInfo[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
}

export default function MultiAccountModal({ isOpen, onClose }: Props) {
  const { t } = useI18n();
  const { me, displayName: authDisplayName, avatar } = useAuthContext();
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const closeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const stored = loadAccounts();
    const token = localStorage.getItem(TOKEN_KEY) || '';
    if (me) {
      const current: AccountInfo = {
        username: me,
        displayName: authDisplayName || me,
        avatarUrl: avatar || undefined,
        token,
        isActive: true,
      };
      const others = stored.filter(a => a.username !== me);
      const merged = [current, ...others.map(a => ({ ...a, isActive: false }))];
      saveAccounts(merged);
      setAccounts(merged);

      Promise.all(merged.map(async account => {
        try {
          const profile = await api.get<{ displayName?: string; avatar?: string }>(`/api/status/${encodeURIComponent(account.username)}`);
          return {
            ...account,
            displayName: profile.displayName?.trim() || '',
            avatarUrl: profile.avatar || undefined,
          };
        } catch {
          return account;
        }
      })).then(updated => {
        if (cancelled) return;
        saveAccounts(updated);
        setAccounts(updated);
      });
    } else {
      setAccounts(stored);
    }
    return () => { cancelled = true; };
  }, [isOpen, me, authDisplayName, avatar]);

  const handleSwitch = useCallback((username: string) => {
    const stored = loadAccounts();
    const target = stored.find(a => a.username === username);
    if (!target) return;
    localStorage.setItem(TOKEN_KEY, target.token);
    localStorage.setItem('4send_user', target.username);
    localStorage.removeItem('4send_displayName');
    localStorage.removeItem('4send_isVerified');
    localStorage.removeItem('4send_role');
    if (target.avatarUrl) {
      localStorage.setItem('4send_avatar', target.avatarUrl);
    } else {
      localStorage.removeItem('4send_avatar');
    }

    saveAccounts(stored.map(a => ({
      ...a,
      isActive: a.username === username,
    })));
    window.location.reload();
  }, []);

  const handleRemove = useCallback((username: string) => {
    const updated = accounts.filter(a => a.username !== username);
    saveAccounts(updated);
    setAccounts(updated);
    setConfirmDelete(null);
  }, [accounts]);

  const handleAdd = useCallback(() => {
    [TOKEN_KEY, '4send_user', '4send_displayName', '4send_avatar', '4send_role', '4send_isVerified']
      .forEach(key => localStorage.removeItem(key));
    onClose();
    window.location.reload();
  }, [onClose]);

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title="" showClose={false} closeRef={closeRef}>
      <div className={styles.iconCircle}>
        <svg viewBox="0 0 24 24" width="40" height="40" fill="none" style={{ stroke: 'var(--accent-solid)' }} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </div>

      <h2 className={styles.title}>{t('Ваши аккаунты')}</h2>

      <div className={styles.accountList}>
        {accounts.map(account => (
          <div
            key={account.username}
            className={`${styles.accountItem} ${account.isActive ? styles.activeAccount : ''}`}
            onClick={() => !account.isActive && handleSwitch(account.username)}
          >
            {account.avatarUrl ? (
              <img src={account.avatarUrl} alt="" className={styles.avatar} />
            ) : (
              <div className={styles.avatarPlaceholder}>
                {(account.displayName || account.username).charAt(0).toUpperCase()}
              </div>
            )}
            <div className={styles.info}>
              <div className={styles.name}>{account.displayName || account.username}</div>
              <div className={styles.username}>@{account.username}</div>
            </div>
            {account.isActive ? (
              <div className={styles.onlineDot} />
            ) : (
              <button
                className={styles.deleteBtn}
                onClick={e => { e.stopPropagation(); setConfirmDelete(account.username); }}
              >
                <svg viewBox="0 0 24 24" fill="#ff4d4d">
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      <button className={styles.addBtn} onClick={handleAdd}>
        <span className={styles.addIcon}>+</span> {t('Добавить аккаунт')}
      </button>

      <button className={styles.closeBtn} onClick={() => closeRef.current?.()}>{t('ЗАКРЫТЬ')}</button>

      {confirmDelete && (
        <div className={styles.confirmOverlay} onClick={() => setConfirmDelete(null)}>
          <div className={styles.confirmDialog} onClick={e => e.stopPropagation()}>
            <div className={styles.confirmTitle}>{t('Удалить аккаунт?')}</div>
            <div className={styles.confirmText}>{t('Аккаунт')} @{confirmDelete} {t('будет удалён из списка')}</div>
            <div className={styles.confirmActions}>
              <button className={styles.confirmCancel} onClick={() => setConfirmDelete(null)}>{t('Отмена')}</button>
              <button className={styles.confirmDeleteBtn} onClick={() => handleRemove(confirmDelete)}>{t('Удалить')}</button>
            </div>
          </div>
        </div>
      )}
    </ModalShell>
  );
}
