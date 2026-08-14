import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../hooks/useI18n';
import { useAuthContext } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { getSocket } from '../../services/socket';
import { api } from '../../services/api';
import styles from './RoomPreviewModal.module.css';

interface RoomPreviewData {
  roomId: string;
  name: string;
  description?: string;
  avatar?: string;
  isPublic?: boolean;
  type?: string;
  isVerified?: boolean;
  members?: string[];
  memberCount?: number;
  publicLink?: string;
  joinRequests?: string[];
  error?: string;
}

interface Props {
  roomId: string;
  onClose: () => void;
  onJoined: (roomId: string) => void;
}

export default function RoomPreviewModal({ roomId, onClose, onJoined }: Props) {
  const { t } = useI18n();
  const { me } = useAuthContext();
  const { showToast } = useUI();
  const [data, setData] = useState<RoomPreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get<RoomPreviewData>(`/api/room/${encodeURIComponent(roomId)}`)
      .then((res: RoomPreviewData) => {
        if (!active) return;
        if ((res as unknown as { status?: number }).status === 403 || res.error) {
          setIsPrivate(true);
          setData(null);
        } else if (me && res.members?.includes(me.toLowerCase())) {
          onJoined(roomId);
        } else {
          setData(res);
        }
      })
      .catch(() => { if (active) setData(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [roomId, me, onJoined]);

  const handleJoin = () => {
    setBusy(true);
    const socket = getSocket();
    const isPublic = data?.isPublic !== false;
    socket.emit(isPublic ? 'join_public_room' : 'request_join_room', roomId);
    showToast(isPublic ? t('Вы присоединились к комнате') : t('Заявка отправлена'));
    setBusy(false);
    if (isPublic) {
      onJoined(roomId);
    } else {
      onClose();
    }
  };

  const name = data?.name || roomId.replace(/^room_/, '');
  const desc = data?.description || '';
  const isPublic = data?.isPublic !== false;
  const members = data?.memberCount ?? data?.members?.length ?? 0;
  const alreadyRequested = me && data?.joinRequests?.includes(me.toLowerCase());

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.box} onClick={e => e.stopPropagation()}>
        {loading ? (
          <div className={styles.loading}>{t('Загрузка...')}</div>
        ) : isPrivate ? (
          <>
            <div className={styles.avatar}>
              <div className={styles.verified}>
                <svg viewBox="0 0 24 24" style={{ width: 40, height: 40 }}>
                  <path fill="currentColor" d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z" />
                </svg>
              </div>
            </div>
            <h3 className={styles.name}>{t('Частная группа')}</h3>
            <p className={styles.desc}>{t('Для вступления необходимо подать заявку.')}</p>
            <div className={styles.actions}>
              <button className={styles.cancel} onClick={onClose}>{t('Отмена')}</button>
              <button className={styles.join} onClick={handleJoin} disabled={busy}>
                {t('Подать заявку')}
              </button>
            </div>
          </>
        ) : data ? (
          <>
            <div className={styles.avatar}>
              {data.avatar ? <img src={data.avatar} alt="" /> : <span>{name.charAt(0).toUpperCase()}</span>}
              {data.isVerified && <div className={styles.verified}>✓</div>}
            </div>
            <h3 className={styles.name}>{name}</h3>
            {desc && <p className={styles.desc}>{desc}</p>}
            <div className={styles.meta}>
              {isPublic
                ? t('Любой может найти комнату и присоединиться по ссылке')
                : t('Доступ только по приглашению администратора')}
            </div>
            {members > 0 && (
              <div className={styles.count}>
                {data.type === 'channel'
                  ? `${members} ${t('подписчиков')}`
                  : `${members} ${t('участников')}`}
              </div>
            )}
            <div className={styles.actions}>
              <button className={styles.cancel} onClick={onClose}>{t('Отмена')}</button>
              {alreadyRequested ? (
                <button className={styles.join} disabled>{t('Заявка отправлена')}</button>
              ) : (
                <button className={styles.join} onClick={handleJoin} disabled={busy}>
                  {isPublic ? t('Присоединиться') : t('Подать заявку')}
                </button>
              )}
            </div>
          </>
        ) : (
          <div className={styles.loading}>{t('Комната не найдена')}</div>
        )}
      </div>
    </div>,
    document.body
  );
}
