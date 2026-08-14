import { useEffect, useRef } from 'react';

const STORAGE_KEY = '4send_hotkeys';

interface HotkeyBinding {
  key: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
}

const DEFAULT_HOTKEYS: Record<string, HotkeyBinding> = {
  send_message: { key: 'Enter', ctrl: true, shift: false, alt: false },
  new_line: { key: 'Enter', ctrl: false, shift: true, alt: false },
  close_modal: { key: 'Escape', ctrl: false, shift: false, alt: false },
  search_chats: { key: 'KeyS', ctrl: false, shift: true, alt: true, },
  search_messages: { key: 'KeyM', ctrl: false, shift: true, alt: true, },
  edit_last: { key: 'ArrowUp', ctrl: false, shift: false, alt: false },
  next_result: { key: 'Period', ctrl: true, shift: true, alt: false },
  prev_result: { key: 'Comma', ctrl: true, shift: true, alt: false },
  scroll_bottom: { key: 'KeyG', ctrl: true, shift: false, alt: false },
  reply_last: { key: 'ArrowLeft', ctrl: false, shift: false, alt: false },
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

function loadBindings(): Record<string, HotkeyBinding> {
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

const MODIFIER_IDS = new Set(['send_message', 'search_chats', 'search_messages', 'next_result', 'prev_result', 'scroll_bottom']);

export function useHotkeys(handlers: Record<string, () => void>) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const bindings = loadBindings();

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;

      for (const [id, binding] of Object.entries(DEFAULT_HOTKEYS)) {
        const custom = bindings[id];
        const b = custom || binding;

        if (e.code !== b.key) continue;
        if (e.ctrlKey !== b.ctrl) continue;
        if (e.shiftKey !== b.shift) continue;
        if (e.altKey !== b.alt) continue;

        const handler = handlersRef.current[id];
        if (!handler) continue;

        if (!MODIFIER_IDS.has(id) && isInput) continue;

        e.preventDefault();
        handler();
        return;
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, []);
}
