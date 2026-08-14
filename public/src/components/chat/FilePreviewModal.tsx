import { useState, useCallback, useRef, useEffect } from 'react';
import { useI18n } from '../../hooks/useI18n';
import VoicePlayer from './VoicePlayer';
import styles from './FilePreviewModal.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  file: File | null;
  onSend: (file: File, caption: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function getFileType(file: File): 'image' | 'video' | 'audio' | 'other' {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'other';
}

export default function FilePreviewModal({ isOpen, onClose, file, onSend }: Props) {
  const { t } = useI18n();
  const [caption, setCaption] = useState('');
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState<number | undefined>(undefined);
  const [closing, setClosing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
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
    if (file) {
      const url = URL.createObjectURL(file);
      setObjectUrl(url);
      setCaption('');

      if (getFileType(file) === 'audio') {
        const audio = new Audio();
        audio.src = url;
        audio.addEventListener('loadedmetadata', () => {
          setAudioDuration(audio.duration);
        });
      } else {
        setAudioDuration(undefined);
      }

      return () => {
        URL.revokeObjectURL(url);
        setObjectUrl(null);
      };
    }
    return undefined;
  }, [file]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
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

  const handleSend = useCallback(() => {
    if (file) {
      onSend(file, caption);
      onClose();
    }
  }, [file, caption, onSend, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      handleClose();
    }
  }, [handleSend, handleClose]);

  if (!isOpen || !file) return null;

  const fileType = getFileType(file);

  return (
    <div className={`${styles.overlay} ${closing ? styles.overlayClosing : ''}`} onClick={handleClose}>
      <div className={`${styles.card} ${closing ? styles.cardClosing : ''}`} onClick={e => e.stopPropagation()}>
        <div className={styles.previewArea}>
          {fileType === 'image' && objectUrl && (
            <img className={styles.image} src={objectUrl} alt={file.name} />
          )}

          {fileType === 'video' && objectUrl && (
            <video className={styles.video} src={objectUrl} controls autoPlay muted />
          )}

          {fileType === 'audio' && objectUrl && (
            <div className={styles.audioPreview}>
              <VoicePlayer src={objectUrl} duration={audioDuration} />
            </div>
          )}

          {fileType === 'other' && (
            <div className={styles.fileInfo}>
              <div className={styles.fileIcon}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--accent-solid)' }} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14,2 14,8 20,8" />
                </svg>
              </div>
              <div className={styles.fileName}>{file.name}</div>
              <div className={styles.fileSize}>{formatBytes(file.size)}</div>
            </div>
          )}
        </div>

        <div className={styles.buttonsArea}>
          <input
            ref={inputRef}
            className={styles.captionInput}
            type="text"
            placeholder={t('Подпись...')}
            value={caption}
            onChange={e => setCaption(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button className={styles.sendBtn} onClick={handleSend}>
            {t('Отправить')}
          </button>
          <button className={styles.cancelBtn} onClick={handleClose}>
            {t('Отмена')}
          </button>
        </div>
      </div>
    </div>
  );
}
