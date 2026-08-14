import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../../hooks/useI18n';
import styles from './Lightbox.module.css';

interface LightboxProps {
  isOpen: boolean;
  onClose: () => void;
  src: string;
  alt?: string;
  noDownload?: boolean;
}

export default function Lightbox({ isOpen, onClose, src, alt, noDownload }: LightboxProps) {
  const { t } = useI18n();
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [closing, setClosing] = useState(false);
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const resetView = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    resetView();
    setClosing(false);
  }, [src, resetView]);

  const animateClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, 300);
  }, [closing, onClose]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') animateClose();
  }, [animateClose]);

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  const handleDownload = useCallback(() => {
    const link = document.createElement('a');
    link.href = src;
    link.download = alt || 'image';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [src, alt]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY;
    const factor = delta > 0 ? 0.15 : -0.15;
    setScale(prev => {
      const next = Math.max(0.5, Math.min(prev + factor, 5));
      if (next === 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale <= 1) return;
    e.preventDefault();
    dragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  }, [scale, offset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    setOffset({
      x: dragStart.current.ox + e.clientX - dragStart.current.x,
      y: dragStart.current.oy + e.clientY - dragStart.current.y,
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (scale > 1) {
      resetView();
    } else {
      setScale(2);
    }
  }, [scale, resetView]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      e.stopPropagation();
      animateClose();
    }
  }, [animateClose]);

  if (!isOpen) return null;

  return (
    <div
      className={`${styles.overlay}${closing ? ` ${styles.closing}` : ''}`}
      onClick={handleOverlayClick}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <button className={styles.closeButton} onClick={e => { e.stopPropagation(); animateClose(); }}>
        ✕
      </button>
      <img
        className={styles.image}
        src={src}
        alt={alt || ''}
        onClick={e => e.stopPropagation()}
        onDoubleClick={handleDoubleClick}
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          cursor: scale > 1 ? 'grab' : 'default',
          transition: dragging.current ? 'none' : 'transform 0.2s ease',
        }}
      />
      {!noDownload && (
        <button className={styles.downloadButton} onClick={handleDownload}>
          {t('download')}
        </button>
      )}
    </div>
  );
}
