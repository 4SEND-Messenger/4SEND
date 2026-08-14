import { useEffect, useRef } from 'react';
import { api } from '../services/api';

const THROTTLE_MS = 3000;

export function useScreenshotDetector(target: string | null | undefined, copyRestricted: boolean = false, onScreenshot?: () => void) {
  const lastNotify = useRef(0);
  const targetRef = useRef(target);
  targetRef.current = target;
  const copyRestrictedRef = useRef(copyRestricted);
  copyRestrictedRef.current = copyRestricted;
  const onScreenshotRef = useRef(onScreenshot);
  onScreenshotRef.current = onScreenshot;

  useEffect(() => {
    const notify = () => {
      const tgt = targetRef.current;
      if (!tgt) return;
      const now = Date.now();
      if (now - lastNotify.current < THROTTLE_MS) return;
      lastNotify.current = now;
      api.post('/api/screenshot-notify', { target: tgt }).catch(() => {});
      if (copyRestrictedRef.current) {
        onScreenshotRef.current?.();
      }
    };

    const checkKey = (e: KeyboardEvent) => {
      const key = e.key;
      const hasMeta = e.metaKey || e.ctrlKey;
      const hasShift = e.shiftKey;
      const hasAlt = e.altKey;

      if (key === 'PrintScreen') { notify(); return; }
      if (hasMeta && key === 'PrintScreen') { notify(); return; }
      if (hasAlt && key === 'PrintScreen') { notify(); return; }

      if (hasMeta && hasShift) {
        if (['3', '4', '5', '6'].includes(key)) { notify(); return; }
        if (key.toLowerCase() === 's' || e.code === 'KeyS') { notify(); return; }
      }

      if (hasShift && (key === 'S' || key === 's' || e.code === 'KeyS')) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !(e.target as HTMLElement)?.isContentEditable) {
          notify();
        }
      }
    };

    document.addEventListener('keydown', checkKey);
    document.addEventListener('keyup', checkKey);
    return () => {
      document.removeEventListener('keydown', checkKey);
      document.removeEventListener('keyup', checkKey);
    };
  }, []);

  useEffect(() => {
    let clipboardTimer: ReturnType<typeof setInterval>;
    let lastClipTypes = '';

    const readClipboard = async () => {
      try {
        if (!navigator.clipboard?.read) return;
        const items = await navigator.clipboard.read();
        const types = items.map(i => i.types.join(',')).join('|');
        if (types && types !== lastClipTypes) {
          lastClipTypes = types;
          if (items.some(i => i.types.some(t => t.startsWith('image/')))) {
            const tgt = targetRef.current;
            if (!tgt) return;
            const now = Date.now();
            if (now - lastNotify.current >= THROTTLE_MS) {
              lastNotify.current = now;
              api.post('/api/screenshot-notify', { target: tgt }).catch(() => {});
              if (copyRestrictedRef.current) {
                onScreenshotRef.current?.();
              }
            }
          }
        }
      } catch {
        // empty
      }
    };

    const onFocus = () => {
      setTimeout(readClipboard, 200);
    };

    window.addEventListener('focus', onFocus);
    clipboardTimer = setInterval(readClipboard, 3000);
    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(clipboardTimer);
    };
  }, []);
}
