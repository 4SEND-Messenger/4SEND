import { useState, useRef, useCallback } from 'react';
import styles from './VideoMessage.module.css';

const MAX_WIDTH = 400;
const MAX_HEIGHT = 400;

interface Props {
  src: string;
  copyRestricted?: boolean;
}

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function VideoMessage({ src, copyRestricted }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [displaySize, setDisplaySize] = useState<{ w: number; h: number } | null>(null);

  const fitSize = useCallback((vw: number, vh: number) => {
    const parentW = Math.min(wrapperRef.current?.parentElement?.clientWidth || 300, MAX_WIDTH);
    let w = vw;
    let h = vh;
    if (w > parentW) { h = h * parentW / w; w = parentW; }
    if (h > MAX_HEIGHT) { w = w * MAX_HEIGHT / h; h = MAX_HEIGHT; }
    return { w: Math.round(w), h: Math.round(h) };
  }, []);

  const handleMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration);
    if (video.videoWidth && video.videoHeight) {
      setDisplaySize(fitSize(video.videoWidth, video.videoHeight));
    }
  }, [fitSize]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  }, []);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    video.currentTime = pct * duration;
  }, [duration]);

  const handleFullscreen = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.requestFullscreen) video.requestFullscreen();
  }, []);

  const progress = duration ? (current / duration) * 100 : 0;

  return (
    <div
      ref={wrapperRef}
      className={styles.wrapper}
      style={displaySize ? { width: displaySize.w } : undefined}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => playing && setShowControls(false)}
    >
      <div className={styles.videoWrap} style={displaySize ? { height: displaySize.h } : undefined}>
        <video
          ref={videoRef}
          src={src}
          className={styles.video}
          onClick={togglePlay}
          playsInline
          controlsList={copyRestricted ? 'nodownload' : undefined}
          onContextMenu={copyRestricted ? (e) => e.preventDefault() : undefined}
          onLoadedMetadata={handleMetadata}
          onTimeUpdate={() => { const v = videoRef.current; if (v) setCurrent(v.currentTime); }}
          onPlay={() => setPlaying(true)}
          onPause={() => { setPlaying(false); setShowControls(true); }}
          onEnded={() => { setPlaying(false); setShowControls(true); }}
        />

        {!playing && (
          <button className={styles.bigPlay} onClick={togglePlay}>
            <svg viewBox="0 0 24 24" className={styles.bigPlayIcon}>
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        )}
      </div>

      <div className={`${styles.controls} ${showControls || !playing ? styles.controlsVisible : ''}`}>
        <div className={styles.progressBar} onClick={handleSeek}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
        <div className={styles.controlsRow}>
          <button className={styles.ctrlBtn} onClick={togglePlay}>
            {playing ? (
              <svg viewBox="0 0 24 24" className={styles.ctrlIcon}><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" className={styles.ctrlIcon}><path d="M8 5v14l11-7z" /></svg>
            )}
          </button>
          <span className={styles.time}>{formatTime(current)} / {formatTime(duration)}</span>
          <button className={styles.ctrlBtn} onClick={handleFullscreen}>
            <svg viewBox="0 0 24 24" className={styles.ctrlIcon}>
              <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
