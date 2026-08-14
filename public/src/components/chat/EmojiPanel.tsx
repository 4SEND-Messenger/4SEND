import { useMemo, useCallback, useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useI18n } from '../../hooks/useI18n';
import styles from './EmojiPanel.module.css';

type Tab = 'emoji' | 'stickers' | 'gifs';

interface Props {
  onSelect: (url: string) => void;
  onClose: () => void;
  sourceRect?: DOMRect | null;
  closing?: boolean;
}

const EMOJI_CATEGORIES: Record<string, string[]> = {
  'Частые': ['😀', '😂', '😍', '🥰', '😎', '🤔', '😅', '🙌', '👍', '👋', '❤️', '🔥', '✨', '🎉', '💯', '🙏', '😢', '😤', '🫡', '😈'],
  'Смайлики': ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🫢', '🤫', '🤔', '🫡', '🤐', '🤨', '😐', '😑', '😶', '🫥', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐'],
  'Жесты': ['👋', '🤚', '🖐️', '✋', '🖖', '🫱', '🫲', '🫳', '🫴', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '🫵', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '🫶', '👐', '🤲', '🤝', '🙏', '💪'],
  'Сердце': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝'],
  'Животные': ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞'],
  'Еда': ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🥑', '🍆', '🥔', '🥕', '🌽', '🌶️', '🫑', '🥒', '🥬', '🥦', '🧄', '🧅', '🍄'],
  'Объекты': ['⌚', '📱', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭', '⏱️', '⏰', '📦'],
};

function loadArray(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveArray(key: string, arr: string[]) {
  localStorage.setItem(key, JSON.stringify(arr));
}

export default function EmojiPanel({ onSelect, onClose, sourceRect, closing: closingProp }: Props) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<Tab>('emoji');
  const [stickers, setStickers] = useState<string[]>(() => loadArray('4send_saved_stickers'));
  const [gifs, setGifs] = useState<string[]>(() => loadArray('4send_saved_gifs'));
  const stickerInputRef = useRef<HTMLInputElement>(null);
  const gifInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);
  const [entered, setEntered] = useState(false);
  const [measured, setMeasured] = useState(false);
  const [origin, setOrigin] = useState<string>('50% 100%');
  const categories = useMemo(() => Object.keys(EMOJI_CATEGORIES), []);

  useLayoutEffect(() => {
    if (!measured && sourceRect && panelRef.current) {
      const pr = panelRef.current.getBoundingClientRect();
      if (pr.width > 0 && pr.height > 0) {
        const ox = ((sourceRect.left + sourceRect.width / 2 - pr.left) / pr.width) * 100;
        const oy = ((sourceRect.top + sourceRect.height / 2 - pr.top) / pr.height) * 100;
        setOrigin(`${ox}% ${oy}%`);
        setMeasured(true);
      }
    }
  }, [sourceRect, measured]);

  useEffect(() => {
    if (measured && !entered) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setEntered(true));
      });
    }
  }, [measured, entered]);

  useEffect(() => {
    if (closingProp && !closing) {
      setClosing(true);
      setTimeout(onClose, 300);
    }
  }, [closingProp, closing, onClose]);

  const handleClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, 300);
  }, [onClose, closing]);

  useEffect(() => {
    if (closing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [closing, handleClose]);

  const panelStyle = useMemo(() => {
    if (!measured) return { visibility: 'hidden' as const, opacity: 0 };
    return {
      transformOrigin: origin,
      transform: entered && !closing ? 'scale(1)' : 'scale(0)',
      opacity: entered && !closing ? 1 : 0,
    };
  }, [origin, measured, entered, closing]);

  const handleClick = useCallback((emoji: string) => {
    onSelect(emoji);
  }, [onSelect]);

  const handleStickerUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const next = [...stickers, dataUrl];
      setStickers(next);
      saveArray('4send_saved_stickers', next);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [stickers]);

  const handleGifUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const next = [...gifs, dataUrl];
      setGifs(next);
      saveArray('4send_saved_gifs', next);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [gifs]);

  const deleteSticker = useCallback((idx: number) => {
    const next = stickers.filter((_, i) => i !== idx);
    setStickers(next);
    saveArray('4send_saved_stickers', next);
  }, [stickers]);

  const deleteGif = useCallback((idx: number) => {
    const next = gifs.filter((_, i) => i !== idx);
    setGifs(next);
    saveArray('4send_saved_gifs', next);
  }, [gifs]);

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div ref={panelRef} className={styles.panel} data-entered={measured || undefined} style={panelStyle} onClick={e => e.stopPropagation()}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'emoji' ? styles.active : ''}`}
            onClick={() => setActiveTab('emoji')}
          >
            {t('Эмодзи')}
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'stickers' ? styles.active : ''}`}
            onClick={() => setActiveTab('stickers')}
          >
            {t('Стикеры')}
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'gifs' ? styles.active : ''}`}
            onClick={() => setActiveTab('gifs')}
          >
            GIF
          </button>
        </div>

        {activeTab === 'emoji' && categories.map(cat => (
          <div key={cat} className={styles.category}>
            <div className={styles.categoryTitle}>{t(cat)}</div>
            <div className={styles.grid}>
              {EMOJI_CATEGORIES[cat]!.map((emoji, i) => (
                <button
                  key={`${cat}-${i}`}
                  className={styles.emojiBtn}
                  onClick={() => handleClick(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}

        {activeTab === 'stickers' && (
          <>
            <input
              ref={stickerInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleStickerUpload}
            />
            <div className={styles.stickerGrid}>
              {stickers.map((url, i) => (
                <div key={i} className={styles.stickerSlot} onClick={() => onSelect(url)}>
                  <img src={url} alt="" />
                  <button
                    className={styles.stickerDelete}
                    onClick={e => { e.stopPropagation(); deleteSticker(i); }}
                  >
                    ×
                  </button>
                </div>
              ))}
              <div className={styles.stickerSlot} onClick={() => stickerInputRef.current?.click()}>
                <span className={styles.stickerPlus}>+</span>
              </div>
            </div>
          </>
        )}

        {activeTab === 'gifs' && (
          <>
            <input
              ref={gifInputRef}
              type="file"
              accept="image/gif"
              style={{ display: 'none' }}
              onChange={handleGifUpload}
            />
            <div className={styles.stickerGrid} style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {gifs.map((url, i) => (
                <div key={i} className={styles.stickerSlot} onClick={() => onSelect(url)}>
                  <img src={url} alt="" />
                  <button
                    className={styles.stickerDelete}
                    onClick={e => { e.stopPropagation(); deleteGif(i); }}
                  >
                    ×
                  </button>
                </div>
              ))}
              <div className={styles.stickerSlot} onClick={() => gifInputRef.current?.click()}>
                <span className={styles.stickerPlus}>+</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
