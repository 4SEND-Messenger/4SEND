import { useCallback, useRef, useEffect, useState } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { useI18n } from '../../hooks/useI18n';
import ModalShell from './ModalShell';
import { playNotificationSound } from '../../utils/notificationSound';
import styles from './SoundSettingsModal.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function SoundSettingsModal({ isOpen, onClose }: Props) {
  const { volume, setVolume } = useSettings();
  const { t } = useI18n();
  const sliderRef = useRef<HTMLInputElement>(null);
  const [localVolume, setLocalVolume] = useState(volume);

  useEffect(() => {
    if (isOpen) setLocalVolume(volume);
  }, [isOpen, volume]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setLocalVolume(val);
    setVolume(val);
  }, [setVolume]);

  const handleTestSound = useCallback(() => {
    playNotificationSound(localVolume);
  }, [localVolume]);

  const isMuted = localVolume === 0;

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title={t('Настройки звука')}>
      <div className={styles.sliderSection}>
        <div className={styles.label}>{t('Громкость уведомлений')}</div>
        <div className={styles.sliderRow}>
          <svg viewBox="0 0 24 24" className={`${styles.sliderIcon} ${isMuted ? styles.muted : ''}`}>
            <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
          </svg>
          <input
            ref={sliderRef}
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={localVolume}
            onChange={handleVolumeChange}
            className={styles.slider}
          />
          <svg viewBox="0 0 24 24" className={`${styles.sliderIcon} ${!isMuted ? styles.active : ''}`}>
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
          </svg>
        </div>
        <div className={`${styles.status} ${isMuted ? styles.mutedStatus : styles.activeStatus}`}>
          {isMuted ? t('Только вибрация') : t('Звук включен')}
        </div>
      </div>

      <button className={styles.testBtn} onClick={handleTestSound}>
        {t('Тестовый звук')}
      </button>
    </ModalShell>
  );
}
