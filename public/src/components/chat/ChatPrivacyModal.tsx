import { useState, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '../../hooks/useI18n';
import { api } from '../../services/api';
import styles from './ChatPrivacyModal.module.css';

interface ChatPrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: string;
  copyRestricted: boolean;
  forwardRestricted: boolean;
  screenshotNotified: boolean;
  onToggle?: (type: 'copy' | 'forward' | 'screenshot', state: boolean) => void;
}

export default function ChatPrivacyModal({
  isOpen,
  onClose,
  target,
  copyRestricted,
  forwardRestricted,
  screenshotNotified,
  onToggle,
}: ChatPrivacyModalProps) {
  const { t } = useI18n();
  const [copy, setCopy] = useState(copyRestricted);
  const [forward, setForward] = useState(forwardRestricted);
  const [screenshot, setScreenshot] = useState(screenshotNotified);
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    setCopy(copyRestricted);
    setForward(forwardRestricted);
    setScreenshot(screenshotNotified);
  }, [copyRestricted, forwardRestricted, screenshotNotified]);

  useEffect(() => {
    if (isOpen) {
      const raf = requestAnimationFrame(() => {
        setVisible(true);
      });
      return () => cancelAnimationFrame(raf);
    }
    return undefined;
  }, [isOpen]);

  const handleClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    timerRef.current = setTimeout(() => {
      onCloseRef.current();
    }, 300);
  }, [closing]);

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  const toggle = useCallback(async (type: string, state: boolean) => {
    try {
      await api.post('/api/toggle-chat-privacy', { target, type, state });
    } catch (err) {
      console.error('Failed to toggle privacy', err);
    }
  }, [target]);

  const handleCopy = useCallback(() => {
    const next = !copy;
    setCopy(next);
    toggle('copy', next);
    onToggle?.('copy', next);
  }, [copy, toggle, onToggle]);

  const handleForward = useCallback(() => {
    const next = !forward;
    setForward(next);
    toggle('forward', next);
    onToggle?.('forward', next);
  }, [forward, toggle, onToggle]);

  const handleScreenshot = useCallback(() => {
    const next = !screenshot;
    setScreenshot(next);
    toggle('screenshot', next);
    onToggle?.('screenshot', next);
  }, [screenshot, toggle, onToggle]);

  if (!isOpen) return null;

  let overlayClass = styles.overlay;
  if (closing) overlayClass += ` ${styles.closing}`;
  else if (visible) overlayClass += ` ${styles.active}`;

  return (
    <div className={overlayClass} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeX} onClick={handleClose}>&#10005;</button>

        <div className={styles.iconWrap}>
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#a74fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>

        <h3 className={styles.title}>{t('Приватность чата')}</h3>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <div className={styles.rowLabel}>{t('Запрет копирования')}</div>
            <div className={styles.rowDesc}>{t('Нельзя копировать текст и сохранять медиа.')}</div>
          </div>
          <div
            className={`${styles.toggle} ${copy ? styles.toggleOn : ''}`}
            onClick={handleCopy}
          >
            <span className={`${styles.knob} ${copy ? styles.knobOn : ''}`} />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <div className={styles.rowLabel}>{t('Скрытие пересылки')}</div>
            <div className={styles.rowDesc}>{t('Уведомление о пересылке не появится.')}</div>
          </div>
          <div
            className={`${styles.toggle} ${forward ? styles.toggleOn : ''}`}
            onClick={handleForward}
          >
            <span className={`${styles.knob} ${forward ? styles.knobOn : ''}`} />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <div className={styles.rowLabel}>{t('Уведомления о скриншотах')}</div>
            <div className={styles.rowDesc}>{t('В чат придет сообщение, если кто-то сделает скриншот.')}</div>
          </div>
          <div
            className={`${styles.toggle} ${screenshot ? styles.toggleOn : ''}`}
            onClick={handleScreenshot}
          >
            <span className={`${styles.knob} ${screenshot ? styles.knobOn : ''}`} />
          </div>
        </div>

        <button className={styles.doneBtn} onClick={handleClose}>{t('ГОТОВО')}</button>
      </div>
    </div>
  );
}
