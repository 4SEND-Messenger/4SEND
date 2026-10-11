import { useCallback, useState } from 'react';
import { useI18n } from '../../hooks/useI18n';
import ModalShell from './ModalShell';
import {
  getVideoMessageSettings,
  setVideoMessageSetting,
  VIDEO_BITRATES,
  VIDEO_QUALITIES,
  VIDEO_MAX_DURATIONS,
  type VideoMessageSettings,
} from '../../utils/videoMessage';
import styles from './VideoMessageSettingsModal.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function VideoMessageSettingsModal({ isOpen, onClose }: Props) {
  const { t } = useI18n();
  const [opts, setOpts] = useState<VideoMessageSettings>(() => getVideoMessageSettings());

  const update = useCallback(<K extends keyof VideoMessageSettings>(key: K, value: VideoMessageSettings[K]) => {
    setVideoMessageSetting(key, value);
    setOpts(prev => ({ ...prev, [key]: value }));
  }, []);

  const toggle = useCallback((key: 'shutterSound' | 'gridOverlay') => {
    update(key, !opts[key]);
  }, [opts, update]);

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title={t('Настройки видеосообщений')} maxWidth="440px">
      <div className={styles.subtitle}>{t('Параметры записи круглых видеосообщений')}</div>

      <div className={styles.group}>
        <div className={styles.row}>
          <span className={styles.label}>{t('Камера по умолчанию')}</span>
          <div className={styles.btns}>
            {([['user', 'Передняя'], ['environment', 'Основная']] as const).map(([v, label]) => (
              <button
                key={v}
                className={`${styles.btn} ${opts.camera === v ? styles.btnActive : ''}`}
                onClick={() => update('camera', v)}
              >{t(label)}</button>
            ))}
          </div>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>{t('Качество видео')}</span>
          <div className={styles.btns}>
            {VIDEO_QUALITIES.map(q => (
              <button
                key={q}
                className={`${styles.btn} ${opts.quality === q ? styles.btnActive : ''}`}
                onClick={() => update('quality', q)}
              >{q}p</button>
            ))}
          </div>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>{t('Формат')}</span>
          <div className={styles.btns}>
            {([['mp4', 'MP4 (H.264)'], ['webm', 'WebM']] as const).map(([v, label]) => (
              <button
                key={v}
                className={`${styles.btn} ${opts.codec === v ? styles.btnActive : ''}`}
                onClick={() => update('codec', v)}
              >{label}</button>
            ))}
          </div>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>{t('Битрейт')}</span>
          <div className={styles.btns}>
            {VIDEO_BITRATES.map(b => (
              <button
                key={b}
                className={`${styles.btn} ${opts.bitrate === b ? styles.btnActive : ''}`}
                onClick={() => update('bitrate', b)}
              >{b / 1000000} Мбит</button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.group}>
        <div className={styles.row} onClick={() => toggle('shutterSound')}>
          <div className={styles.textBlock}>
            <span className={styles.label}>{t('Звук затвора')}</span>
            <span className={styles.hint}>{t('Щелчок при старте и отправке записи')}</span>
          </div>
          <div className={`${styles.toggle} ${opts.shutterSound ? styles.toggleOn : ''}`}>
            <div className={styles.toggleKnob} />
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.textBlock}>
            <span className={styles.label}>{t('Максимальная длительность')}</span>
            <span className={styles.hint}>{t('По достижении запись автоматически отправляется')}</span>
          </div>
          <div className={styles.btns}>
            {VIDEO_MAX_DURATIONS.map(d => (
              <button
                key={d}
                className={`${styles.btn} ${opts.maxDuration === d ? styles.btnActive : ''}`}
                onClick={() => update('maxDuration', d)}
              >{d === 0 ? t('Выкл') : `${d}с`}</button>
            ))}
          </div>
        </div>
        <div className={styles.row} onClick={() => toggle('gridOverlay')}>
          <div className={styles.textBlock}>
            <span className={styles.label}>{t('Сетка третей')}</span>
            <span className={styles.hint}>{t('Направляющие при съёмке, в видео не попадает')}</span>
          </div>
          <div className={`${styles.toggle} ${opts.gridOverlay ? styles.toggleOn : ''}`}>
            <div className={styles.toggleKnob} />
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
