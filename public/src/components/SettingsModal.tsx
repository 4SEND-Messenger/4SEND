import { useState, useCallback, useRef, useEffect, lazy, Suspense } from 'react';
import { useAuthContext } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { useI18n } from '../hooks/useI18n';
import { saveCurrentAccount } from '../services/storage';
import styles from './SettingsModal.module.css';

const AvatarCropper = lazy(() => import('./AvatarCropper'));

const USERNAME_RE = /^[a-z]+$/;
const MIN_USERNAME = 4;

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

interface Props {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: Props) {
  const { me, displayName, avatar, updateProfile, loadAuth } = useAuthContext();
  const { showToast } = useUI();
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const checkTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const [newName, setNewName] = useState(displayName || '');
  const [username, setUsername] = useState(me || '');
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const [bio, setBio] = useState('');
  const [previewAvatar, setPreviewAvatar] = useState<string | null>(avatar || null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [visible, setVisible] = useState(true);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    setVisible(true);
    setEntered(false);
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setEntered(true));
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => {
      setVisible(false);
      setClosing(false);
      setEntered(false);
      onClose();
    }, 400);
    return () => clearTimeout(timer);
  }, [closing, onClose]);

  const handleClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
  }, [closing]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [handleClose]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('4send_token');
        const res = await fetch(`/api/status/${me}?me=${me}`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          if (data.displayName) setNewName(data.displayName);
          if (data.bio) setBio(data.bio);
        }
      } catch {}
    };
    if (me) fetchProfile();
  }, [me]);

  const checkUsername = useCallback(async (val: string) => {
    const trimmed = val.trim().toLowerCase();
    if (!trimmed || trimmed === me?.toLowerCase()) {
      setUsernameStatus('idle');
      return;
    }
    if (trimmed.length < MIN_USERNAME || !USERNAME_RE.test(trimmed)) {
      setUsernameStatus('invalid');
      return;
    }
    setUsernameStatus('checking');
    try {
      const token = localStorage.getItem('4send_token');
      const res = await fetch(`/api/check-username?username=${encodeURIComponent(trimmed)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setUsernameStatus(data.available ? 'available' : 'taken');
    } catch {
      setUsernameStatus('idle');
    }
  }, [me]);

  const handleUsernameChange = useCallback((val: string) => {
    setUsername(val);
    if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
    checkTimerRef.current = setTimeout(() => checkUsername(val), 400);
  }, [checkUsername]);

  const handleUsernameBlur = useCallback(() => {
    if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
    checkUsername(username);
  }, [checkUsername, username]);

  const handleAvatarClick = useCallback(() => { fileInputRef.current?.click(); }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast(t('Выберите изображение'), true);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast(t('Файл слишком большой (макс. 5MB)'), true);
      return;
    }
    setCropFile(file);
    e.target.value = '';
  }, [showToast, t]);

  const handleCropDone = useCallback(async (cropped: File) => {
    setCropFile(null);
    setSelectedFile(cropped);
    const reader = new FileReader();
    reader.onload = (ev) => setPreviewAvatar(ev.target?.result as string);
    reader.readAsDataURL(cropped);

    setSaving(true);
    try {
      const token = localStorage.getItem('4send_token');
      const fd = new FormData();
      fd.append('file', cropped);
      const uploadRes = await fetch('/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        const avatarUrl: string | null = uploadData.url || null;
        const res = await fetch('/auth/profile-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ newUsername: me || username, avatarUrl, displayName: newName.trim(), bio: bio.trim() }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.displayName) localStorage.setItem('4send_displayName', data.displayName);
          if (data.avatarUrl) localStorage.setItem('4send_avatar', data.avatarUrl);
          if (data.newToken) localStorage.setItem('4send_token', data.newToken);
          if (data.newUsername) localStorage.setItem('4send_user', data.newUsername);
          updateProfile?.({});
          await loadAuth();
          await saveCurrentAccount();
          showToast(t('Аватар обновлён'), false);
          handleClose();
          return;
        }
      }
      showToast(t('Ошибка загрузки аватара'), true);
    } catch {
      showToast(t('Ошибка сети'), true);
    } finally {
      setSaving(false);
    }
  }, [me, username, newName, bio, showToast, t, handleClose, updateProfile, loadAuth]);

  const handleSave = useCallback(async () => {
    if (!newName.trim()) { showToast(t('Введите имя'), true); return; }
    setSaving(true);
    try {
      const token = localStorage.getItem('4send_token');

      let avatarUrl: string | null = null;
      if (selectedFile) {
        const fd = new FormData();
        fd.append('file', selectedFile);
        const uploadRes = await fetch('/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          avatarUrl = uploadData.url || null;
        } else {
          showToast(t('Ошибка загрузки аватара'), true);
          setSaving(false);
          return;
        }
      }

      const res = await fetch('/auth/profile-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          newUsername: me || username,
          avatarUrl,
          displayName: newName.trim(),
          bio: bio.trim(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.displayName) localStorage.setItem('4send_displayName', data.displayName);
        if (data.avatarUrl) localStorage.setItem('4send_avatar', data.avatarUrl);
        if (data.newToken) localStorage.setItem('4send_token', data.newToken);
        if (data.newUsername) localStorage.setItem('4send_user', data.newUsername);
        updateProfile?.({});
        await loadAuth();
        await saveCurrentAccount();
        showToast(t('Профиль обновлён'), false);
        handleClose();
      } else {
        const err = await res.json();
        showToast(err.error || t('Ошибка сохранения'), true);
      }
    } catch {
      showToast(t('Ошибка сети'), true);
    } finally {
      setSaving(false);
    }
  }, [newName, bio, selectedFile, me, username, showToast, t, handleClose, updateProfile, loadAuth]);

  const getInitial = (name: string) => name?.charAt(0)?.toUpperCase() || '?';

  if (!visible) return null;

  return (
    <div className={`${styles.overlay} ${entered && !closing ? styles.open : ''} ${closing ? styles.closing : ''}`}
      onClick={handleClose}>
      <div className={`${styles.modal} ${entered && !closing ? styles.modalOpen : ''} ${closing ? styles.modalClosing : ''}`}
        onClick={e => e.stopPropagation()}>
        <h3 className={styles.title}>{t('Профиль')}</h3>

        <div className={styles.avatarCircle} onClick={handleAvatarClick}>
          {previewAvatar ? (
            <img src={previewAvatar} alt="" className={styles.avatarImg} />
          ) : (
            <div className={styles.avatarPlaceholder}>
              {getInitial(newName || me || '?')}
            </div>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFileChange} />

        <div className={styles.hint}>{t('Нажмите на круг, чтобы сменить фото')}</div>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>{t('ИМЯ')}</label>
          <input className={styles.input} type="text" maxLength={30}
            value={newName} onChange={e => setNewName(e.target.value)}
            placeholder={t('Введите имя')} />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>{t('ИМЯ ПОЛЬЗОВАТЕЛЯ')}</label>
          <div className={styles.inputWrap}>
            <input className={`${styles.input} ${usernameStatus === 'taken' || usernameStatus === 'invalid' ? styles.inputError : usernameStatus === 'available' ? styles.inputSuccess : ''}`} type="text" maxLength={20}
              value={username} onChange={e => handleUsernameChange(e.target.value)}
              onBlur={handleUsernameBlur}
              placeholder={t('Введите имя пользователя')} />
            {usernameStatus === 'checking' && (
              <span className={styles.statusIcon}>
                <svg viewBox="0 0 24 24" width="18" height="18" className={styles.spinner}>
                  <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                </svg>
              </span>
            )}
            {usernameStatus === 'available' && (
              <span className={`${styles.statusIcon} ${styles.statusOk}`}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
              </span>
            )}
            {(usernameStatus === 'taken' || usernameStatus === 'invalid') && (
              <span className={`${styles.statusIcon} ${styles.statusBad}`}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </span>
            )}
          </div>
          {usernameStatus === 'invalid' && (
            <div className={styles.fieldHint}>{t('Только латиница, минимум 4 символа')}</div>
          )}
          {usernameStatus === 'taken' && (
            <div className={`${styles.fieldHint} ${styles.hintError}`}>{t('Имя занято')}</div>
          )}
        </div>

        <div className={styles.fieldGroup}>
          <div className={styles.labelRow}>
            <label className={styles.label}>{t('О СЕБЕ')}</label>
            <span className={styles.counter}>{bio.length}/100</span>
          </div>
          <textarea className={styles.textarea} maxLength={100}
            value={bio} onChange={e => setBio(e.target.value)}
            placeholder={t('Стриптизер, 43 года, из Чебоксар.')} />
        </div>

        <div className={styles.buttonRow}>
          <button className={styles.saveBtn} onClick={handleSave} disabled={saving || (usernameStatus !== 'idle' && usernameStatus !== 'available')}>
            {t('Сохранить')}
          </button>
          <button className={styles.cancelBtn} onClick={handleClose}>{t('Отмена')}</button>
        </div>
      </div>
      {cropFile && (
        <Suspense fallback={null}>
          <AvatarCropper
            file={cropFile}
            onCancel={() => setCropFile(null)}
            onCrop={handleCropDone}
          />
        </Suspense>
      )}
    </div>
  );
}
