import { useState, useRef, useEffect, useCallback } from 'react';
import styles from './VideoNotePlayer.module.css';

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

interface Props {
  src: string;
}

const RING_RADIUS = 121;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS; // ~760

export default function VideoNotePlayer({ src }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      if (video.duration) {
        setProgress(video.currentTime / video.duration);
      }
    };
    const onEnded = () => {
      setPlaying(false);
      setProgress(0);
      playNextMedia(videoRef.current);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('ended', onEnded);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, []);

  const togglePlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  }, []);

  const toggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }, []);

  const handleSeek = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !video.duration || !container) return;
    const rect = container.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    let angle = Math.atan2(dy, dx) + Math.PI / 2;
    if (angle < 0) angle += 2 * Math.PI;
    const pct = angle / (2 * Math.PI);
    video.currentTime = pct * video.duration;
  }, []);

  const dashOffset = RING_CIRCUMFERENCE * (1 - progress);

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        <div className={styles.videoNoteContainer} ref={containerRef} onClick={togglePlayback}>
          <video
            ref={videoRef}
            src={src}
            muted
            playsInline
            className={styles.video}
          />
        </div>

        {playing && (
        <svg
          className={styles.progressRing}
          width="250"
          height="250"
          viewBox="0 0 250 250"
          onClick={handleSeek}
        >
          <circle cx="125" cy="125" r={RING_RADIUS} fill="none" stroke="rgba(167,79,255,0.2)" strokeWidth="4" />
          <circle
            cx="125" cy="125" r={RING_RADIUS} fill="none" stroke="var(--accent-solid)" strokeWidth="4"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 0.1s linear' }}
          />
        </svg>
        )}

        {!playing && (
          <div className={styles.playOverlay} onClick={togglePlayback}>
            <svg viewBox="0 0 24 24" className={styles.playIcon}>
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        )}

        <button className={styles.soundIcon} onClick={toggleMute}>
          {muted ? (
            <svg viewBox="0 0 24 24" className={styles.soundSvg}>
              <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className={styles.soundSvg}>
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
