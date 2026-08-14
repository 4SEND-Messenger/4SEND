import { memo, useEffect, useState, useCallback, useRef } from 'react';
import { useI18n } from '../../hooks/useI18n';
import type { P2PTransferState } from '../../hooks/useP2PTransfer';
import styles from './P2PTransferOverlay.module.css';

interface Props {
  state: P2PTransferState;
  onCancel: () => void;
  onDownload: () => void;
  onClose: () => void;
  onAccept?: () => void;
  onDecline?: () => void;
}

function formatSize(bytes: number): string {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return bytes + ' B';
}

function P2PTransferOverlay({ state, onCancel, onDownload, onClose, onAccept, onDecline }: Props) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);

  useEffect(() => {
    closingRef.current = false;
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const isFinished = state.status === 'done' || state.status === 'error' || state.status === 'cancelled';
  const isIncoming = state.status === 'incoming';
  const isTransferring = state.status === 'transferring';

  const closeWithAnim = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    setTimeout(() => onClose(), 300);
  }, [onClose]);

  const handleClose = useCallback(() => {
    if (isIncoming) onDecline?.();
    closeWithAnim();
  }, [isIncoming, onDecline, closeWithAnim]);

  const statusText = {
    idle: '',
    offer: t('Установка соединения...'),
    incoming: '',
    connecting: t('Соединение...'),
    transferring: t('Передача...'),
    done: t('Передача завершена'),
    error: state.error || t('Ошибка передачи'),
    cancelled: state.error || t('Передача отменена'),
  }[state.status];

  return (
    <div className={`${styles.overlay} ${visible && !closing ? styles.overlayVisible : ''}`}>
      <div className={styles.card}>
        <button className={styles.closeBtn} onClick={handleClose}>
          <svg viewBox="0 0 24 24" className={styles.closeIcon}>
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/>
          </svg>
        </button>

        <div className={`${styles.iconWrap} ${isIncoming ? styles.iconIncoming : ''}`}>
          <svg viewBox="0 0 24 24" className={styles.icon}>
            {isIncoming ? (
              <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
            ) : (
              <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
            )}
          </svg>
        </div>

        {isIncoming && state.peer && (
          <div className={styles.incomingFrom}>
            {state.peer} {t('хочет отправить вам файл:')}
          </div>
        )}

        <div className={styles.fileName}>{state.fileName}</div>
        <div className={styles.fileSize}>{formatSize(state.fileSize)}</div>

        {isIncoming ? (
          <div className={styles.incomingActions}>
            <button className={styles.btnDecline} onClick={() => { onDecline?.(); closeWithAnim(); }}>
              {t('Отклонить')}
            </button>
            <button className={styles.btnAccept} onClick={onAccept}>
              {t('Скачать')}
            </button>
          </div>
        ) : (
          <>
            {isTransferring && (
              <div className={styles.progressWrap}>
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: `${state.progress}%` }} />
                </div>
                <div className={styles.progressText}>
                  {`${state.progress}%`}
                  <span className={styles.statusLabel}>{statusText}</span>
                </div>
              </div>
            )}

            {state.status === 'connecting' && (
              <div className={styles.statusLabel}>{statusText}</div>
            )}

            <div className={styles.actions}>
              {state.status === 'done' && (
                <button className={styles.btnDownload} onClick={onDownload}>
                  <svg viewBox="0 0 24 24" className={styles.btnIcon}>
                    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                  </svg>
                  {t('Скачать')}
                </button>
              )}
              {!isFinished && !isTransferring && state.status !== 'connecting' && (
                <button className={styles.btnCancel} onClick={closeWithAnim}>
                  {t('Отмена')}
                </button>
              )}
              {isTransferring && (
                <button className={styles.btnCancel} onClick={() => { onCancel(); closeWithAnim(); }}>
                  {t('Отмена')}
                </button>
              )}
              {isFinished && (
                <button className={styles.btnCancel} onClick={closeWithAnim}>
                  {t('Закрыть')}
                </button>
              )}
            </div>

            {isFinished && (
              <div className={styles.statusLabel}>{statusText}</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default memo(P2PTransferOverlay);
