import { useState, useRef, useEffect, useCallback } from 'react';
import styles from './MusicPlayer.module.css';
import { useI18n } from '../../hooks/useI18n';

interface Props {
  src: string;
  fileName?: string;
  duration?: number;
}

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const SPEEDS = [1, 1.5, 2, 0.5];

export default function MusicPlayer({ src, fileName, duration }: Props) {
  const { t } = useI18n();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(duration || 0);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoaded = () => setTotal(audio.duration);
    const onTimeUpdate = () => setCurrent(audio.currentTime);
    const onEnded = () => { setPlaying(false); setCurrent(0); };

    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    if (duration) setTotal(duration);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [duration]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else { audio.play(); setPlaying(true); }
  }, [playing]);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !total) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audio.currentTime = pct * total;
    setCurrent(audio.currentTime);
  }, [total]);

  const cycleSpeed = useCallback(() => {
    const idx = SPEEDS.indexOf(speed);
    const next = SPEEDS[(idx + 1) % SPEEDS.length] ?? 1;
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  }, [speed]);

  const progress = total ? (current / total) * 100 : 0;

  return (
    <div className={styles.musicPlayer}>
      <div className={styles.header}>
        <button className={styles.playBtn} onClick={togglePlay}>
          {playing ? (
            <svg viewBox="0 0 24 24" className={styles.playIcon}>
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className={styles.playIcon}>
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
        <div className={styles.fileInfo}>
          <div className={styles.fileName}>{fileName || t('Аудиозапись')}</div>
          <div className={styles.duration}>
            {formatTime(current)} / {formatTime(total)}
          </div>
        </div>
        <button className={styles.speedBtn} onClick={cycleSpeed}>{speed}x</button>
      </div>

      <div className={styles.progress} onClick={handleSeek}>
        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
      </div>

      <audio ref={audioRef} src={src} preload="metadata" />
    </div>
  );
}
