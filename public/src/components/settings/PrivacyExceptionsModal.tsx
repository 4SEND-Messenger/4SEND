import { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { useAuthContext } from '../../context/AuthContext';
import { useI18n } from '../../hooks/useI18n';
import { api } from '../../services/api';
import type { ContactItem } from '../../types/user';
import ModalShell from './ModalShell';
import styles from './PrivacyExceptionsModal.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  optionKey: string;
}

export default function PrivacyExceptionsModal({ isOpen, onClose, optionKey }: Props) {
  const { t } = useI18n();
  const { me } = useAuthContext();
  const { privacyState, privacyExceptions, addPrivacyException, removePrivacyException } = useSettings();
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [loading, setLoading] = useState(false);
  const exceptions = privacyExceptions[optionKey] || [];

  useEffect(() => {
    if (!isOpen || !me) return;
    setLoading(true);
    api.get<ContactItem[]>(`/chats-extended/${me}`)
      .then((res) => { if (Array.isArray(res)) setContacts(res); else setContacts([]); })
      .catch(() => setContacts([]))
      .finally(() => setLoading(false));
  }, [isOpen, me]);

  const handleToggle = useCallback(async (username: string) => {
    const updatedException = exceptions.includes(username)
      ? exceptions.filter(u => u !== username)
      : [...exceptions, username];
    if (exceptions.includes(username)) {
      removePrivacyException(optionKey, username);
    } else {
      addPrivacyException(optionKey, username);
    }
    try {
      await api.post('/api/privacy', {
        ...privacyState,
        exceptions: { ...privacyExceptions, [optionKey]: updatedException },
      });
    } catch {}
  }, [optionKey, exceptions, privacyState, privacyExceptions, addPrivacyException, removePrivacyException]);

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title={t('Выберите пользователей')}>
      {loading ? (
        <div style={{ color: '#8e8e93', textAlign: 'center', padding: 20 }}>{t('Загрузка...')}</div>
      ) : (
        <div className={styles.list}>
          {contacts.length === 0 && (
            <div style={{ color: '#8e8e93', textAlign: 'center', padding: 20 }}>{t('Нет контактов')}</div>
          )}
          {contacts.map(contact => {
            const isSelected = exceptions.includes(contact.username);
            return (
              <button key={contact.username}
                className={`${styles.contactRow} ${isSelected ? styles.contactSelected : ''}`}
                onClick={() => handleToggle(contact.username)}>
                <div className={styles.contactInfo}>
                  <div className={styles.contactAvatar}>
                    {contact.avatar ? (
                      <img src={contact.avatar} alt="" className={styles.avatarImg} />
                    ) : (
                      <span className={styles.avatarFallback}>
                        {(contact.displayName || contact.username).charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className={styles.contactDetails}>
                    <span className={styles.contactName}>{contact.displayName || contact.username}</span>
                    <span className={styles.contactUsername}>@{contact.username}</span>
                  </div>
                </div>
                <div className={`${styles.checkbox} ${isSelected ? styles.checkboxChecked : ''}`}>
                  {isSelected && (
                    <svg viewBox="0 0 24 24" fill="#fff" width="16" height="16">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                    </svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </ModalShell>
  );
}
