import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import styles from './VoicePlayer.module.css';

interface Props {
  src: string;
  duration?: number;
  msgId?: string;
  isMe?: boolean;
}

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function playNextMedia(currentEl: HTMLElement | null) {
  if (!currentEl) return;
  const msgEl = currentEl.closest('[data-msg-id]');
  if (!msgEl) return;
  const nextMsg = msgEl.nextElementSibling;
  if (!nextMsg) return;
  const voiceBtn = nextMsg.querySelector<HTMLButtonElement>('[class*="playBtn"]');
  if (voiceBtn) { voiceBtn.click(); return; }
  const videoEl = nextMsg.querySelector<HTMLElement>('[class*="videoNoteContainer"]');
  if (videoEl) { videoEl.click(); }
}

const SPEEDS = [1, 1.5, 2, 0.5];

export default function VoicePlayer({ src, duration, msgId, isMe }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(duration || 0);
  const [speed, setSpeed] = useState(1);

  const bars = useMemo(
    () => Array.from({ length: 30 }, () => Math.floor(Math.random() * 20) + 5),
    [],
  );

  const playedKey = msgId ? `played_voice_${msgId}` : '';
  const [played, setPlayed] = useState(() => {
    if (!playedKey) return true;
    return isMe || !!localStorage.getItem(playedKey);
  });

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoaded = () => setTotal(audio.duration);
    const onTimeUpdate = () => setCurrent(audio.currentTime);
    const onEnded = () => {
      setPlaying(false);
      setCurrent(0);
      if (playedKey) {
        localStorage.setItem(playedKey, '1');
        setPlayed(true);
      }
      playNextMedia(audioRef.current);
    };

    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    if (duration) setTotal(duration);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [duration, playedKey]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play();
      setPlaying(true);
    }
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

  const progress = total ? current / total : 0;

  return (
    <div className={styles.outer}>
      <div className={styles.voicePlayer}>
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

        <div className={styles.waves} onClick={handleSeek}>
          {bars.map((h, i) => {
            const barProgress = (i + 1) / bars.length;
            const active = playing && progress >= barProgress;
            return (
              <div
                key={i}
                className={`${styles.bar} ${active ? styles.barActive : ''}`}
                style={{ height: `${h}px` }}
              />
            );
          })}
        </div>

        <span className={styles.time}>{formatTime(playing || current ? current : total)}</span>

        <button className={styles.speedBtn} onClick={cycleSpeed}>{speed}x</button>

        <audio ref={audioRef} src={src} preload="metadata" />
      </div>

      {!played && <div className={styles.unreadDot} />}
    </div>
  );
}
