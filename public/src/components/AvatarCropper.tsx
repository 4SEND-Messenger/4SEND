import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../hooks/useI18n';
import styles from './AvatarCropper.module.css';

interface AvatarCropperProps {
  file: File;
  onCancel: () => void;
  onCrop: (file: File) => void;
}

const SIZE = 260;
const OUTPUT = 512;

export default function AvatarCropper({ file, onCancel, onCrop }: AvatarCropperProps) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const [visible, setVisible] = useState(true);
  const [entered, setEntered] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setEntered(true));
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => {
      setVisible(false);
      setClosing(false);
      setEntered(false);
      onCancel();
    }, 400);
    return () => clearTimeout(timer);
  }, [closing, onCancel]);

  const handleClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
  }, [closing]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [handleClose]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setScale(0.5);
      setPos({ x: 0, y: 0 });
      draw();
    };
    img.src = URL.createObjectURL(file);
    return () => URL.revokeObjectURL(img.src);
  }, [file]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, SIZE, SIZE);
    const s = scale;
    const w = img.width * s;
    const h = img.height * s;
    ctx.save();
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, (SIZE - w) / 2 + pos.x, (SIZE - h) / 2 + pos.y, w, h);
    ctx.restore();
  }, [scale, pos]);

  useEffect(() => { draw(); }, [draw]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setPos({ x: dragRef.current.px + dx, y: dragRef.current.py + dy });
  };
  const onPointerUp = () => { dragRef.current = null; };

  const handleDone = () => {
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext('2d');
    if (!ctx || !imgRef.current) return;
    ctx.beginPath();
    ctx.arc(OUTPUT / 2, OUTPUT / 2, OUTPUT / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    const ratio = OUTPUT / SIZE;
    const s = scale * ratio;
    const w = imgRef.current.width * s;
    const h = imgRef.current.height * s;
    ctx.drawImage(imgRef.current, (OUTPUT - w) / 2 + pos.x * ratio, (OUTPUT - h) / 2 + pos.y * ratio, w, h);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const cropped = new File([blob], 'avatar.png', { type: 'image/png' });
      onCrop(cropped);
    }, 'image/png');
  };

  if (!visible) return null;

  return createPortal(
    <div
      className={`${styles.overlay} ${entered && !closing ? styles.open : ''} ${closing ? styles.closing : ''}`}
      onClick={handleClose}
    >
      <div
        className={`${styles.box} ${entered && !closing ? styles.boxOpen : ''} ${closing ? styles.boxClosing : ''}`}
        onClick={e => e.stopPropagation()}
      >
        <h3 className={styles.title}>{t('Обрезка аватара')}</h3>
        <div
          ref={containerRef}
          className={styles.stage}
          style={{ width: SIZE, height: SIZE }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          <canvas ref={canvasRef} width={SIZE} height={SIZE} className={styles.canvas} />
          <div className={styles.ring} />
        </div>
        <div className={styles.zoomLabel}>{t('Масштаб')}</div>
        <input
          className={styles.zoom}
          type="range"
          min={0.5}
          max={4}
          step={0.01}
          value={scale}
          onChange={(e) => setScale(parseFloat(e.target.value))}
        />
        <div className={styles.actions}>
          <button className={styles.cancel} onClick={handleClose}>{t('Отмена')}</button>
          <button className={styles.done} onClick={handleDone}>{t('Готово')}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
