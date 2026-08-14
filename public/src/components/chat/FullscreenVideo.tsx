import { useState, useCallback, useEffect, useRef } from 'react';
import styles from './FullscreenVideo.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  src: string;
}

export default function FullscreenVideo({ isOpen, onClose, src }: Props) {
  const [closing, setClosing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const animateClose = useCallback(() => {
    setClosing(true);
    timerRef.current = setTimeout(() => {
      onCloseRef.current();
    }, 300);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') animateClose();
  }, [animateClose]);

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className={`${styles.overlay}${closing ? ` ${styles.closing}` : ''}`}
      onClick={e => { if (e.target === e.currentTarget) animateClose(); }}
    >
      <button className={styles.closeBtn} onClick={animateClose}>✕</button>
      <video
        className={styles.video}
        src={src}
        autoPlay
        controls
      />
    </div>
  );
}
