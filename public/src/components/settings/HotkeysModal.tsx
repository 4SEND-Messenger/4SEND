import { useState, useCallback, useEffect, useRef } from 'react';
import { useI18n } from '../../hooks/useI18n';
import styles from './HotkeysModal.module.css';

interface HotkeyBinding {
  key: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  desc: string;
  category: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const STORAGE_KEY = '4send_hotkeys';

const DEFAULT_HOTKEYS: Record<string, HotkeyBinding> = {
  send_message: { key: 'Enter', ctrl: true, shift: false, alt: false, desc: 'Отправить сообщение', category: 'Сообщения' },
  new_line: { key: 'Enter', ctrl: false, shift: true, alt: false, desc: 'Новая строка', category: 'Сообщения' },
  close_modal: { key: 'Escape', ctrl: false, shift: false, alt: false, desc: 'Закрыть / Отмена', category: 'Общие' },
  search_chats: { key: 'KeyS', ctrl: false, shift: true, alt: true, desc: 'Поиск чатов', category: 'Навигация' },
  search_messages: { key: 'KeyM', ctrl: false, shift: true, alt: true, desc: 'Поиск по сообщениям', category: 'Навигация' },
  edit_last: { key: 'ArrowUp', ctrl: false, shift: false, alt: false, desc: 'Редактировать последнее', category: 'Сообщения' },
  next_result: { key: 'Period', ctrl: true, shift: true, alt: false, desc: 'Следующий результат поиска', category: 'Поиск' },
  prev_result: { key: 'Comma', ctrl: true, shift: true, alt: false, desc: 'Предыдущий результат поиска', category: 'Поиск' },
  scroll_bottom: { key: 'KeyG', ctrl: true, shift: false, alt: false, desc: 'Прокрутить вниз', category: 'Навигация' },
  reply_last: { key: 'ArrowLeft', ctrl: false, shift: false, alt: false, desc: 'Ответить на последнее сообщение', category: 'Сообщения' },
};

const KEY_MIGRATIONS: Record<string, string> = {
  '.': 'Period', ',': 'Comma', '/': 'Slash', '`': 'Backquote',
  '-': 'Minus', '=': 'Equal', '[': 'BracketLeft', ']': 'BracketRight',
  '\\': 'Backslash', ';': 'Semicolon', "'": 'Quote',
};

function migrateKey(key: string): string {
  if (key.length === 1) {
    const upper = key.toUpperCase();
    if (upper >= 'A' && upper <= 'Z') return 'Key' + upper;
    if (upper >= '0' && upper <= '9') return 'Digit' + upper;
    if (KEY_MIGRATIONS[key]) return KEY_MIGRATIONS[key];
  }
  return key;
}

function loadHotkeys(): Record<string, HotkeyBinding> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      let needsSave = false;
      const migrated: Record<string, HotkeyBinding> = {};
      for (const [id, binding] of Object.entries(parsed)) {
        const b = binding as HotkeyBinding;
        const newKey = migrateKey(b.key);
        if (newKey !== b.key) needsSave = true;
        migrated[id] = { ...b, key: newKey };
      }
      if (needsSave) localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch {}
  return {};
}

function saveHotkeys(bindings: Record<string, HotkeyBinding>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
}

function getEffective(bindings: Record<string, HotkeyBinding>, id: string): HotkeyBinding {
  return bindings[id] ?? DEFAULT_HOTKEYS[id]!;
}

function keyDisplay(key: string): string {
  const map: Record<string, string> = {
    Enter: '↵', Escape: 'Esc', ArrowUp: '↑', ArrowDown: '↓',
    ArrowLeft: '←', ArrowRight: '→', Tab: 'Tab', Backspace: '⌫',
    Delete: 'Del', Shift: '⇧', Control: 'Ctrl', Alt: 'Alt',
    Meta: '⌘', ' ': 'Space', Period: '.', Comma: ',', Slash: '/',
    Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']',
    Backslash: '\\', Semicolon: ';', Quote: "'", IntlBackslash: '\\',
  };
  if (key.startsWith('Key')) return key.slice(3);
  if (key.startsWith('Digit')) return key.slice(5);
  return map[key] || key;
}

function keyWidth(key: string): string {
  if (['Enter', 'Escape', 'Tab', 'Backspace', 'Backslash'].includes(key)) return '56px';
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(key)) return '48px';
  if (key.startsWith('Key') || key.startsWith('Digit')) return '32px';
  if (['Period', 'Comma', 'Slash', 'Backquote', 'Minus', 'Equal', 'BracketLeft', 'BracketRight', 'Semicolon', 'Quote'].includes(key)) return '32px';
  if (key.length <= 2) return '32px';
  return '40px';
}

const CATEGORIES = ['Сообщения', 'Навигация', 'Поиск', 'Общие'];

export default function HotkeysModal({ isOpen, onClose }: Props) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [entered, setEntered] = useState(false);
  const [closing, setClosing] = useState(false);
  const [bindings, setBindings] = useState<Record<string, HotkeyBinding>>(() => loadHotkeys());
  const [recording, setRecording] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState<string | null>(null);
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
    return;
  }, [isOpen]);

  const handleClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    setTimeout(() => onCloseRef.current(), 400);
  }, []);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (recording) { setRecording(null); return; }
        if (resetConfirm) { setResetConfirm(null); return; }
        handleClose();
      }
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [handleClose, recording, resetConfirm]);

  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const code = e.code;
      if (code === 'Escape') { setRecording(null); return; }
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const alt = e.altKey;
      if (code.startsWith('Control') || code.startsWith('Shift') || code.startsWith('Alt') || code.startsWith('Meta')) return;
      const def = getEffective(bindings, recording);
      const updated = { ...bindings };
      updated[recording] = { ...def, key: code, ctrl, shift, alt };
      setBindings(updated);
      saveHotkeys(updated);
      setRecording(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [recording, bindings]);

  const startRecording = useCallback((id: string) => {
    setResetConfirm(null);
    setRecording(id);
  }, []);

  const resetBinding = useCallback((id: string) => {
    const updated = { ...bindings };
    delete updated[id];
    setBindings(updated);
    saveHotkeys(updated);
    setResetConfirm(null);
  }, [bindings]);

  const resetAll = useCallback(() => {
    setBindings({});
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const isCustom = (id: string): boolean => id in bindings;

  if (!visible) return null;

  const showOpen = entered && !closing;

  const allIds = Object.keys(DEFAULT_HOTKEYS);

  return (
    <div className={`${styles.overlay} ${showOpen ? styles.active : ''} ${closing ? styles.closing : ''}`} onClick={handleClose}>
      <div className={`${styles.modal} ${showOpen ? styles.modalOpen : ''} ${closing ? styles.modalClosing : ''}`} onClick={e => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={handleClose}>&#10005;</button>
        <div className={styles.header}>
          <div className={styles.headerIcon}>
            <svg viewBox="0 0 16 16" fill="currentColor" width="20" height="20"><path d="M0 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6zm13 .25v.5c0 .138.112.25.25.25h.5a.25.25 0 0 0 .25-.25v-.5a.25.25 0 0 0-.25-.25h-.5a.25.25 0 0 0-.25.25zM2.25 8a.25.25 0 0 0-.25.25v.5c0 .138.112.25.25.25h.5A.25.25 0 0 0 3 8.75v-.5A.25.25 0 0 0 2.75 8h-.5zM4 8.25v.5c0 .138.112.25.25.25h.5A.25.25 0 0 0 5 8.75v-.5A.25.25 0 0 0 4.75 8h-.5a.25.25 0 0 0-.25.25zM6.25 8a.25.25 0 0 0-.25.25v.5c0 .138.112.25.25.25h.5A.25.25 0 0 0 7 8.75v-.5A.25.25 0 0 0 6.75 8h-.5zM8 8.25v.5c0 .138.112.25.25.25h.5A.25.25 0 0 0 9 8.75v-.5A.25.25 0 0 0 8.75 8h-.5a.25.25 0 0 0-.25.25zM13.25 8a.25.25 0 0 0-.25.25v.5c0 .138.112.25.25.25h.5a.25.25 0 0 0 .25-.25v-.5a.25.25 0 0 0-.25-.25h-.5zm0 2a.25.25 0 0 0-.25.25v.5c0 .138.112.25.25.25h.5a.25.25 0 0 0 .25-.25v-.5a.25.25 0 0 0-.25-.25h-.5zm-3-2a.25.25 0 0 0-.25.25v.5c0 .138.112.25.25.25h1.5a.25.25 0 0 0 .25-.25v-.5a.25.25 0 0 0-.25-.25h-1.5zm.75 2.25v.5c0 .138.112.25.25.25h.5a.25.25 0 0 0 .25-.25v-.5a.25.25 0 0 0-.25-.25h-.5a.25.25 0 0 0-.25.25zM11.25 6a.25.25 0 0 0-.25.25v.5c0 .138.112.25.25.25h.5a.25.25 0 0 0 .25-.25v-.5a.25.25 0 0 0-.25-.25h-.5zM9 6.25v.5c0 .138.112.25.25.25h.5a.25.25 0 0 0 .25-.25v-.5A.25.25 0 0 0 9.75 6h-.5a.25.25 0 0 0-.25.25zM7.25 6a.25.25 0 0 0-.25.25v.5c0 .138.112.25.25.25h.5A.25.25 0 0 0 8 6.75v-.5A.25.25 0 0 0 7.75 6h-.5zM5 6.25v.5c0 .138.112.25.25.25h.5A.25.25 0 0 0 6 6.75v-.5A.25.25 0 0 0 5.75 6h-.5a.25.25 0 0 0-.25.25zM2.25 6a.25.25 0 0 0-.25.25v.5c0 .138.112.25.25.25h1.5A.25.25 0 0 0 4 6.75v-.5A.25.25 0 0 0 3.75 6h-1.5zM2 10.25v.5c0 .138.112.25.25.25h.5a.25.25 0 0 0 .25-.25v-.5a.25.25 0 0 0-.25-.25h-.5a.25.25 0 0 0-.25.25zM4.25 10a.25.25 0 0 0-.25.25v.5c0 .138.112.25.25.25h5.5a.25.25 0 0 0 .25-.25v-.5a.25.25 0 0 0-.25-.25h-5.5z"/></svg>
          </div>
          <div>
            <h2 className={styles.title}>{t('Горячие клавиши')}</h2>
            <p className={styles.subtitle}>{t('Нажмите на сочетание, чтобы изменить')}</p>
          </div>
        </div>

        <div className={styles.scrollArea}>
          {CATEGORIES.map(cat => {
            const items = allIds.filter(id => (DEFAULT_HOTKEYS[id]?.category || '') === cat);
            if (!items.length) return null;
            return (
              <div key={cat} className={styles.categoryGroup}>
                <h3 className={styles.categoryTitle}>{t(cat)}</h3>
                <div className={styles.shortcutList}>
                  {items.map(id => {
                    const binding = getEffective(bindings, id);
                    const isRec = recording === id;
                    const custom = isCustom(id);
                    return (
                      <div key={id} className={`${styles.shortcutItem} ${isRec ? styles.recording : ''}`}>
                        <div className={styles.shortcutInfo}>
                          <span className={styles.shortcutDesc}>{t(binding.desc)}</span>
                          {custom && <span className={styles.customBadge}>{t('изменено')}</span>}
                        </div>
                        <div className={styles.shortcutKeys}>
                          {isRec ? (
                            <div className={styles.recordingBox}>
                              <span className={styles.recordingDot} />
                              <span className={styles.recordingText}>{t('Нажмите комбинацию...')}</span>
                            </div>
                          ) : (
                            <button className={styles.keyCombo} onClick={() => startRecording(id)} title={t('Изменить')}>
                              {binding.ctrl && <span className={styles.keyCap} style={{ width: keyWidth('Control') }}>Ctrl</span>}
                              {binding.shift && <span className={styles.keyCap} style={{ width: keyWidth('Shift') }}>Shift</span>}
                              {binding.alt && <span className={styles.keyCap} style={{ width: keyWidth('Alt') }}>Alt</span>}
                              <span className={styles.keyCap} style={{ width: keyWidth(binding.key) }}>{keyDisplay(binding.key)}</span>
                            </button>
                          )}
                          <div className={styles.shortcutActions}>
                            {!isRec && custom && (
                              <button
                                className={styles.resetBtn}
                                onClick={e => { e.stopPropagation(); setResetConfirm(resetConfirm === id ? null : id); }}
                                title={t('Сбросить')}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
                              </button>
                            )}
                            {resetConfirm === id && (
                              <button className={styles.confirmReset} onClick={e => { e.stopPropagation(); resetBinding(id); }}>
                                {t('Сбросить?')}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className={styles.footer}>
          <button className={styles.resetAllBtn} onClick={resetAll}>{t('Сбросить все')}</button>
        </div>
      </div>
    </div>
  );
}
