import { useState, useCallback, useEffect, useRef } from 'react';
import { useI18n } from '../../hooks/useI18n';
import { getSocket } from '../../services/socket';
import { api } from '../../services/api';
import styles from './RoomSettingsModal.module.css';

interface MemberDetail {
  username: string;
  displayName?: string;
  avatar?: string;
  isVerified?: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  roomName: string;
  roomAvatar?: string;
  roomDescription?: string;
  roomType: 'group' | 'channel';
  isPublic: boolean;
  publicLink?: string;
  members: string[];
  memberDetails?: MemberDetail[];
  isAdmin: boolean;
  currentUser: string;
}

export default function RoomSettingsModal({ isOpen, onClose, roomId, roomName, roomAvatar, roomDescription, roomType, isPublic: initialPublic, publicLink: initialLink, members, memberDetails, isAdmin, currentUser }: Props) {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [visible, setVisible] = useState(false);
  const [entered, setEntered] = useState(false);
  const [roomPublic, setRoomPublic] = useState(initialPublic);
  const [publicLink, setPublicLink] = useState(initialLink || '');
  const [pendingRequests, setPendingRequests] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [showTypeConfirm, setShowTypeConfirm] = useState<'private' | 'public' | null>(null);
  const [confirmEntered, setConfirmEntered] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descText, setDescText] = useState(roomDescription || '');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatar, setAvatar] = useState(roomAvatar || '');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const closingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const membersRef = useRef(members);
  membersRef.current = members;

  const memberMap = useRef<Record<string, MemberDetail>>({});
  if (memberDetails) {
    memberMap.current = {};
    memberDetails.forEach(m => { memberMap.current[m.username.toLowerCase()] = m; });
  }

  const filteredMembers = members.filter(m => m.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      setClosing(false);
      setEntered(false);
      closingRef.current = false;
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setEntered(true));
      });
      return () => cancelAnimationFrame(raf);
    }
    return;
  }, [isOpen]);

  const handleClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    setTimeout(() => onCloseRef.current(), 400);
  }, []);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingDesc) { setEditingDesc(false); return; }
        if (showTypeConfirm) { setShowTypeConfirm(null); setConfirmEntered(false); return; }
        handleClose();
      }
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [handleClose, editingDesc, showTypeConfirm]);

  useEffect(() => {
    if (!isOpen) return;
    setRoomPublic(initialPublic);
    setPublicLink(initialLink || '');
    setLinkError('');
    setCopied(false);
    setDescText(roomDescription || '');
    setEditingDesc(false);
    setAvatar(roomAvatar || '');
  }, [isOpen, initialPublic, initialLink, roomDescription]);

  useEffect(() => {
    if (!isOpen || !isAdmin) return;
    const socket = getSocket();
    const onRequestHandled = (data: { roomId: string; user: string }) => {
      if (data.roomId === roomId) {
        setPendingRequests(prev => prev.filter(u => u !== data.user));
      }
    };
    socket.on('request_handled', onRequestHandled);
    return () => { socket.off('request_handled', onRequestHandled); };
  }, [isOpen, isAdmin, roomId]);

  const handleTogglePublic = useCallback(() => {
    if (!isAdmin) return;
    if (roomPublic) {
      setShowTypeConfirm('private');
      setConfirmEntered(false);
      requestAnimationFrame(() => requestAnimationFrame(() => setConfirmEntered(true)));
    } else {
      let link = publicLink.trim();
      if (!link) {
        link = roomName.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
        if (link.length < 3) link = `room-${roomId.slice(-8)}`;
      }
      setPublicLink(link);
      setShowTypeConfirm('public');
      setConfirmEntered(false);
      requestAnimationFrame(() => requestAnimationFrame(() => setConfirmEntered(true)));
    }
  }, [isAdmin, roomPublic, publicLink, roomName, roomId]);

  const confirmTypeChange = useCallback(() => {
    if (!showTypeConfirm || !isAdmin) return;
    const newVal = showTypeConfirm === 'public';
    setRoomPublic(newVal);
    setConfirmEntered(false);
    setTimeout(() => setShowTypeConfirm(null), 200);
    const socket = getSocket();
    socket.emit('update_room', {
      roomId,
      isPublic: newVal,
      publicLink: newVal ? publicLink : null
    });
  }, [showTypeConfirm, isAdmin, roomId, publicLink]);

  const cancelTypeChange = useCallback(() => {
    setConfirmEntered(false);
    setTimeout(() => setShowTypeConfirm(null), 200);
  }, []);

  const handleSaveLink = useCallback(() => {
    if (!isAdmin || !roomPublic) return;
    const cleaned = publicLink.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (cleaned.length < 3 || cleaned.length > 30) {
      setLinkError(t('От 3 до 30 символов: латиница, цифры, дефис'));
      return;
    }
    setLinkError('');
    setPublicLink(cleaned);
    const socket = getSocket();
    socket.emit('update_room', { roomId, publicLink: cleaned, isPublic: true });
  }, [isAdmin, roomPublic, publicLink, roomId, t]);

  const handleCopy = useCallback(() => {
    const link = `${window.location.origin}/?join=${publicLink || roomId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, [publicLink, roomId]);

  const handleApprove = useCallback((user: string) => {
    if (!isAdmin) return;
    const socket = getSocket();
    socket.emit('handle_join_request', { roomId, user, approve: true });
    setPendingRequests(prev => prev.filter(u => u !== user));
  }, [isAdmin, roomId]);

  const handleDeny = useCallback((user: string) => {
    if (!isAdmin) return;
    const socket = getSocket();
    socket.emit('handle_join_request', { roomId, user, approve: false });
    setPendingRequests(prev => prev.filter(u => u !== user));
  }, [isAdmin, roomId]);

  const handleAvatarChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const up = await api.upload('/upload', fd) as { url?: string };
      if (up.url) {
        const res = await api.post<{ success?: boolean; avatar?: string }>(`/api/rooms/${encodeURIComponent(roomId)}/avatar`, { avatar: up.url });
        if (res.avatar) setAvatar(res.avatar);
      }
    } catch {}
    setAvatarUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [roomId]);

  const handleRemove = useCallback((member: string) => {
    setConfirmRemove(member);
  }, []);

  const confirmRemoveMember = useCallback(() => {
    if (!confirmRemove) return;
    const socket = getSocket();
    socket.emit('remove_member', { roomId, user: confirmRemove });
    setConfirmRemove(null);
  }, [confirmRemove, roomId]);

  const handleSaveAll = useCallback(() => {
    if (!isAdmin) return;
    let socket = getSocket();
    const trimmed = descText.trim();
    setEditingDesc(false);
    socket.emit('update_room', { roomId, description: trimmed });
    if (roomPublic) {
      const cleaned = publicLink.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
      if (cleaned.length >= 3 && cleaned.length <= 30) {
        socket.emit('update_room', { roomId, publicLink: cleaned, isPublic: true });
      }
    }
  }, [isAdmin, descText, roomId, roomPublic, publicLink]);

  useEffect(() => {
    if (!isOpen) return;
    const socket = getSocket();
    const onRoomUpdated = async () => {
      try {
        const data = await api.get<{ isPublic?: boolean; publicLink?: string; description?: string; avatar?: string }>(`/api/room/${encodeURIComponent(roomId)}`);
        if (typeof data.isPublic === 'boolean') setRoomPublic(data.isPublic);
        if (typeof data.publicLink === 'string') setPublicLink(data.publicLink);
        if (typeof data.description === 'string') setDescText(data.description);
        if (typeof data.avatar === 'string') setAvatar(data.avatar);
      } catch {}
    };
    socket.on('room_updated', onRoomUpdated);
    return () => { socket.off('room_updated', onRoomUpdated); };
  }, [isOpen, roomId]);

  if (!visible) return null;

  const typeLabel = roomType === 'channel' ? t('Канал') : t('Группа');
  const memberLabel = roomType === 'channel' ? t('подписчиков') : t('участников');
  const showOpen = entered && !closing;

  const getMemberAvatar = (username: string): string | undefined => {
    return memberMap.current[username.toLowerCase()]?.avatar;
  };

  const getMemberDisplay = (username: string): string => {
    return memberMap.current[username.toLowerCase()]?.displayName || username;
  };

  return (
    <>
      <div className={`${styles.overlay} ${showOpen ? styles.active : ''} ${closing ? styles.closing : ''}`} onClick={handleClose}>
      <div className={`${styles.modal} ${showOpen ? styles.modalOpen : ''} ${closing ? styles.modalClosing : ''}`} onClick={e => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={handleClose}>&#10005;</button>

        <div className={styles.layout}>
          <div className={styles.leftPanel}>
            <div className={styles.roomHeader}>
              <div className={styles.avatarWrap}>
                {avatarUploading ? (
                  <div className={styles.avatarPlaceholder}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className={styles.spinner}>
                      <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
                    </svg>
                  </div>
                ) : avatar ? (
                  <img src={avatar} alt="" className={styles.avatarImg} />
                ) : (
                  <div className={styles.avatarPlaceholder}>
                    {(roomName || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                {isAdmin && (
                  <>
                    <button className={styles.avatarEditBtn} onClick={() => fileInputRef.current?.click()}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" className={styles.avatarInput} onChange={handleAvatarChange} />
                  </>
                )}
              </div>
              <h2 className={styles.roomName}>{roomName}</h2>
              <div className={styles.roomTypeBadge}>
                <span className={styles.roomBadgeDot} />
                {typeLabel}
                <span className={styles.memberCount}>&middot; {members.length} {memberLabel}</span>
              </div>

              {editingDesc ? (
                <div className={styles.descEditWrap}>
                  <textarea
                    className={styles.descTextarea}
                    value={descText}
                    onChange={e => setDescText(e.target.value)}
                    onBlur={handleSaveAll}
                    onKeyDown={e => { if (e.key === 'Escape') { setEditingDesc(false); setDescText(roomDescription || ''); } if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveAll(); } }}
                    autoFocus
                    maxLength={500}
                    rows={3}
                    placeholder={t('Описание комнаты')}
                  />
                  <div className={styles.descHint}>{t('Enter — сохранить, Esc — отмена')}</div>
                </div>
              ) : (
                <p className={styles.roomDescription} onClick={() => isAdmin && setEditingDesc(true)} role={isAdmin ? 'button' : undefined}>
                  {descText || (isAdmin ? t('Нажмите, чтобы добавить описание') : '')}
                </p>
              )}
            </div>

            {isAdmin && (
              <>
              <div className={styles.settingsSection}>
                <h4 className={styles.sectionTitle}>{t('Настройки')}</h4>

                <div className={styles.settingCard}>
                  <div className={styles.settingRow}>
                    <div className={styles.settingInfo}>
                      <span className={styles.settingName}>{t('Тип комнаты')}</span>
                    </div>
                    <button className={styles.typeBadge} onClick={handleTogglePublic}>
                      {roomPublic ? (
                        <><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
                          {t('Публичный')}
                        </>
                      ) : (
                        <><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z"/></svg>
                          {t('Приватный')}
                        </>
                      )}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.5 }}><path d="M7 10l5 5 5-5z"/></svg>
                    </button>
                  </div>
                  <div className={styles.settingExample}>
                    <span>{roomPublic
                      ? t('Любой может найти комнату и присоединиться по ссылке')
                      : t('Доступ только по приглашению администратора')
                    }</span>
                  </div>
                </div>

                {roomPublic && (
                  <div className={styles.settingCard}>
                    <div className={styles.settingRow}>
                      <div className={styles.settingInfo}>
                        <span className={styles.settingName}>{t('Публичная ссылка')}</span>
                        <span className={styles.settingHint}>{window.location.host}/?join={publicLink || '...'}</span>
                      </div>
                    </div>
                    <div className={styles.linkRow}>
                      <div className={styles.linkPrefix}>{window.location.host}/?join=</div>
                      <input
                        className={styles.linkInput}
                        value={publicLink}
                        onChange={e => {
                          const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                          setPublicLink(val);
                          setLinkError('');
                        }}
                        onBlur={handleSaveLink}
                        onKeyDown={e => e.key === 'Enter' && handleSaveLink()}
                        placeholder={t('ваша-ссылка')}
                        maxLength={30}
                      />
                      <button className={styles.iconBtn} onClick={handleCopy} title={t('Копировать')}>
                        {copied ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                        )}
                      </button>
                    </div>
                    {linkError && <div className={styles.linkError}>{linkError}</div>}
                    <div className={styles.settingExample}>
                      <svg viewBox="0 0 24 24" className={styles.exampleIcon}><path d="M4 11v2h12v2h-2v2l4-4-4-4v2H4z"/></svg>
                      <span>{t('Поделитесь этой ссылкой, чтобы приглашать новых участников')}</span>
                    </div>
                  </div>
                )}

                {!roomPublic && (
                <div className={styles.settingCard}>
                  <div className={styles.settingRow}>
                    <div className={styles.settingInfo}>
                      <span className={styles.settingName}>{t('Ссылка-приглашение')}</span>
                      <span className={styles.settingHint}>{t('Действует для всех, у кого есть ссылка')}</span>
                    </div>
                    <button className={styles.iconBtn} onClick={handleCopy} title={t('Копировать')}>
                      {copied ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                      )}
                    </button>
                  </div>
                  <div className={styles.inviteLink}>
                    <span>{window.location.origin}/?join={roomId}</span>
                  </div>
                </div>
                )}

                <div className={styles.settingCard}>
                  <div className={styles.settingRow}>
                    <div className={styles.settingInfo}>
                      <span className={styles.settingName}>{t('Заявки на вступление')}</span>
                      <span className={styles.settingHint}>{pendingRequests.length > 0 ? `${pendingRequests.length} ${t('ожидают')}` : t('Нет ожидающих заявок')}</span>
                    </div>
                  </div>
                  {pendingRequests.length > 0 && (
                    <div className={styles.requestsList}>
                      {pendingRequests.map(user => (
                        <div key={user} className={styles.requestItem}>
                          <div className={styles.memberAvatar}>
                            {getMemberAvatar(user) ? (
                              <img src={getMemberAvatar(user)} alt="" className={styles.memberAvatarImg} />
                            ) : (
                              user.charAt(0).toUpperCase()
                            )}
                          </div>
                          <span className={styles.memberName}>{getMemberDisplay(user)}</span>
                          <div className={styles.requestActions}>
                            <button className={styles.approveBtn} onClick={() => handleApprove(user)} title={t('Одобрить')}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                            </button>
                            <button className={styles.denyBtn} onClick={() => handleDeny(user)} title={t('Отклонить')}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              <div className={styles.saveSection}>
                <button className={styles.saveBtn} onClick={handleSaveAll}>
                  {t('Сохранить')}
                </button>
              </div>
              </>
            )}

          </div>

          <div className={styles.rightPanel}>
            <h4 className={styles.sectionTitle}>{memberLabel}</h4>

            <input
              className={styles.searchInput}
              placeholder={t('Поиск...')}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />

            <div className={styles.memberList}>
              {filteredMembers.map(member => {
                const mAvatar = getMemberAvatar(member);
                const mDisplay = getMemberDisplay(member);
                const isMe = member.toLowerCase() === currentUser.toLowerCase();
                return (
                  <div key={member} className={`${styles.memberItem} ${isMe ? styles.memberMe : ''}`}>
                    <div className={styles.memberAvatar}>
                      {mAvatar ? (
                        <img src={mAvatar} alt="" className={styles.memberAvatarImg} />
                      ) : (
                        member.charAt(0).toUpperCase()
                      )}
                    </div>
                    <span className={styles.memberName}>
                      {mDisplay}
                      {isMe && <span className={styles.youLabel}>{t('(это вы)')}</span>}
                    </span>
                    {isAdmin && !isMe && (
                      <div className={styles.memberActions}>
                        {confirmRemove === member ? (
                          <div className={styles.confirmGroup}>
                            <span>{t('Удалить?')}</span>
                            <button className={styles.confirmYes} onClick={confirmRemoveMember}>{t('Да')}</button>
                            <button className={styles.confirmNo} onClick={() => setConfirmRemove(null)}>{t('Нет')}</button>
                          </div>
                        ) : (
                          <button className={styles.removeBtn} onClick={() => handleRemove(member)} title={t('Удалить')}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {showTypeConfirm && (
        <div className={`${styles.confirmOverlay} ${confirmEntered ? styles.confirmActive : ''}`} onClick={cancelTypeChange}>
          <div className={`${styles.confirmDialog} ${confirmEntered ? styles.confirmDialogOpen : ''}`} onClick={e => e.stopPropagation()}>
            <h3>{showTypeConfirm === 'public' ? t('Сделать комнату публичной?') : t('Сделать комнату приватной?')}</h3>
            <p>{showTypeConfirm === 'public'
              ? t('Любой сможет найти комнату в поиске и присоединиться. Будет создана публичная ссылка.')
              : t('Публичная ссылка станет неактивной. Присоединиться смогут только приглашённые участники.')
            }</p>
            <div className={styles.confirmActions}>
              <button className={styles.confirmCancelBtn} onClick={cancelTypeChange}>{t('Отмена')}</button>
              <button className={styles.confirmApplyBtn} onClick={confirmTypeChange}>{t('Изменить')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
