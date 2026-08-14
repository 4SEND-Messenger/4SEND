import { useState, useRef, useEffect, useCallback } from 'react';
import { useI18n } from '../../hooks/useI18n';
import styles from './MediaEditor.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  file: File | null;
  onSend: (editedBlob: Blob, caption: string) => void;
}

export default function MediaEditor({ isOpen, onClose, file, onSend }: Props) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [caption, setCaption] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);

  const handleClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    setTimeout(() => onClose(), 300);
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      closingRef.current = false;
      setClosing(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [isOpen, handleClose]);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setImageUrl(url);
      setRotation(0);
      setFlipH(false);
      setCaption('');
      return () => URL.revokeObjectURL(url);
    }
    setImageUrl(null);
    return undefined;
  }, [file]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !img.complete || !img.naturalWidth) return;

    const rad = (rotation * Math.PI) / 180;
    const isRightAngle = rotation % 180 === 0;
    const w = isRightAngle ? img.naturalWidth : img.naturalHeight;
    const h = isRightAngle ? img.naturalHeight : img.naturalWidth;

    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(rad);
    ctx.scale(flipH ? -1 : 1, 1);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    ctx.restore();
  }, [rotation, flipH]);

  useEffect(() => {
    if (!imageUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      drawCanvas();
    };
    img.src = imageUrl;
  }, [imageUrl, drawCanvas]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const handleRotate = useCallback(() => {
    setRotation(r => (r + 90) % 360);
  }, []);

  const handleFlip = useCallback(() => {
    setFlipH(f => !f);
  }, []);

  const handleSend = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (blob) {
        onSend(blob, caption);
        onClose();
      }
    }, file?.type || 'image/png');
  }, [onSend, caption, onClose, file]);

  if (!isOpen || !file) return null;

  return (
    <div className={`${styles.overlay} ${closing ? styles.overlayClosing : ''}`} onClick={handleClose}>
      <div className={`${styles.editor} ${closing ? styles.editorClosing : ''}`} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <button className={styles.closeBtn} onClick={handleClose}>×</button>
        </div>
        <div className={styles.canvasWrap}>
          <canvas ref={canvasRef} className={styles.canvas} />
        </div>
        <div className={styles.toolbar}>
          <button className={styles.toolBtn} onClick={handleRotate}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 12a10 10 0 0 1 16.5-7.6L21.5 8M22 12a10 10 0 0 1-16.5 7.6L2.5 16" />
            </svg>
          </button>
          <button className={styles.toolBtn} onClick={handleFlip}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3v18M17 7l-5-4-5 4M17 17l-5 4-5-4" />
            </svg>
          </button>
        </div>
        <input
          className={styles.captionInput}
          type="text"
          placeholder={t('Добавить подпись...')}
          value={caption}
          onChange={e => setCaption(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
        />
        <button className={styles.sendBtn} onClick={handleSend}>{t('Отправить')}</button>
      </div>
    </div>
  );
}
