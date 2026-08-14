import { useEffect, useRef } from 'react';

interface UseIdleTimerOptions {
  timeout: number;
  onIdle: () => void;
}

const IDLE_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];

export function useIdleTimer({ timeout, onIdle }: UseIdleTimerOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    if (timeout <= 0) return;

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => onIdleRef.current(), timeout);
    };

    resetTimer();
    IDLE_EVENTS.forEach(event => document.addEventListener(event, resetTimer, { passive: true }));
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      IDLE_EVENTS.forEach(event => document.removeEventListener(event, resetTimer));
    };
  }, [timeout]);
}
