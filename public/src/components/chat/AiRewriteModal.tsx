import { useState, useCallback, useRef, useEffect } from 'react';
import { useI18n } from '../../hooks/useI18n';
import { useUI } from '../../context/UIContext';
import { api } from '../../services/api';
import type { AiRewriteResponse } from '../../types/api';
import styles from './AiRewriteModal.module.css';

const STYLES = ['формальный', 'дружеский', 'креативный', 'лаконичный', 'уверенный', 'юмористический', 'вдохновляющий', 'деловой', 'поэтический', 'дерзкий', 'научный', 'детский', 'загадочный', 'романтический', 'спокойный'];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  messageText: string;
  onApply: (text: string) => void;
}

export default function AiRewriteModal({ isOpen, onClose, messageText, onApply }: Props) {
  const { t } = useI18n();
  const { showToast } = useUI();
  const [inputText, setInputText] = useState(messageText);
  const [selectedStyle, setSelectedStyle] = useState(STYLES[0]);
  const [customStyle, setCustomStyle] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(isOpen);
  const [entered, setEntered] = useState(false);
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      setClosing(false);
      setEntered(false);
      closingRef.current = false;
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setEntered(true));
      });
      return () => cancelAnimationFrame(raf);
    }
    return undefined;
  }, [isOpen]);

  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => {
      setVisible(false);
      setClosing(false);
      setEntered(false);
      setResult(null);
      setCustomStyle('');
      onCloseRef.current();
    }, 400);
    return () => clearTimeout(timer);
  }, [closing]);

  const handleClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
  }, []);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [handleClose]);

  const handleRewrite = useCallback(async () => {
    const style = customStyle.trim() || selectedStyle;
    if (!inputText.trim() || inputText.trim().length < 10) {
      showToast(t('Минимум 10 символов'), true);
      return;
    }
    if (!style || style.length < 2) {
      showToast(t('Укажите стиль'), true);
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await api.post<AiRewriteResponse>('/api/ai-rewrite', { text: inputText.trim(), style });
      if (res.error) {
        showToast(res.error, true);
      } else if (res.result) {
        setResult(res.result);
      }
    } catch {
      showToast(t('Ошибка сети'), true);
    } finally {
      setLoading(false);
    }
  }, [inputText, selectedStyle, customStyle, showToast, t]);

  const handleApply = useCallback(() => {
    if (result) onApply(result);
    handleClose();
  }, [result, onApply, handleClose]);

  const canRewrite = inputText.trim().length >= 10 && !loading;
  const styleCharCount = inputText.length;

  if (!visible) return null;

  let overlayClass = styles.overlay;
  if (closing) overlayClass += ` ${styles.overlayClosing}`;
  else if (entered) overlayClass += ` ${styles.overlayOpen}`;

  let modalClass = styles.modal;
  if (closing) modalClass += ` ${styles.modalClosing}`;
  else if (entered) modalClass += ` ${styles.modalOpen}`;

  return (
    <div className={overlayClass} onClick={handleClose}>
      <div className={modalClass} onClick={e => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={handleClose}>&#10005;</button>
        <h3 className={styles.title}>{t('AI Стилизатор')}</h3>

        <label className={styles.label}>{t('Ваш текст')}</label>
        <textarea
          className={styles.textarea}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={t('Введите текст для стилизации...')}
          rows={4}
          maxLength={2000}
          autoFocus
        />
        <div className={`${styles.charHint} ${styleCharCount > 1900 ? styles.danger : ''}`}>
          {styleCharCount}/2000
        </div>

        <label className={styles.label}>{t('Выберите стиль')}</label>
        <div className={styles.styleRow}>
          {STYLES.map((s) => (
            <button
              key={s}
              className={`${styles.styleChip} ${selectedStyle === s && !customStyle.trim() ? styles.active : ''}`}
              onClick={() => { setSelectedStyle(s); setCustomStyle(''); }}
            >
              {t(s)}
            </button>
          ))}
        </div>

        <div className={styles.customStyleRow}>
          <label className={styles.label}>{t('Или свой вариант')}</label>
          <input
            className={styles.customInput}
            value={customStyle}
            onChange={(e) => setCustomStyle(e.target.value)}
            placeholder={t('например, ироничный, как у Чехова...')}
          />
        </div>

        <button
          className={styles.rewriteBtn}
          onClick={handleRewrite}
          disabled={!canRewrite}
        >
          {loading ? (
            <span className={styles.spinner} />
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M19 8l-4 4h3c0 3.31-2.69 6-6 6-1.01 0-1.97-.25-2.8-.7l-1.46 1.46C8.97 19.54 10.43 20 12 20c4.42 0 8-3.58 8-8h3l-4-4zM6 12c0-3.31 2.69-6 6-6 1.01 0 1.97.25 2.8.7l1.46-1.46C15.03 4.46 13.57 4 12 4c-4.42 0-8 3.58-8 8H1l4 4 4-4H6z"/>
            </svg>
          )}
          {t('Стилизовать')}
        </button>

        {result && (
          <div className={styles.resultBox}>
            <label className={styles.label}>{t('Результат')}</label>
            <div className={styles.resultText}>{result}</div>
            <div className={styles.resultActions}>
              <button className={styles.applyBtn} onClick={handleApply}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
                {t('Применить')}
              </button>
              <button className={styles.retryBtn} onClick={() => { setResult(null); handleRewrite(); }}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                </svg>
                {t('Ещё раз')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
