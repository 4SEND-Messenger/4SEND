import { useCallback, useRef } from 'react';
import { getSocket } from '../../services/socket';
import styles from './ReactionsDisplay.module.css';
import type { Reaction } from '../../types/message';

interface ReactionsDisplayProps {
  msgId: string;
  reactions: Reaction[];
  me: string;
  target: string;
  isSent: boolean;
  onReact?: (msgId: string, emoji: string) => void;
}

export function playReactionParticles(msgEl: HTMLElement | null, emoji: string, isSent: boolean) {
  if (!msgEl) return;
  const rect = msgEl.getBoundingClientRect();
  const startX = isSent ? rect.right - 20 : rect.left + 20;
  const startY = rect.bottom;

  for (let i = 0; i < 8; i++) {
    const p = document.createElement('div');
    p.innerText = emoji;
    p.style.position = 'fixed';
    p.style.left = startX + 'px';
    p.style.top = startY + 'px';
    p.style.fontSize = (Math.random() * 10 + 14) + 'px';
    p.style.pointerEvents = 'none';
    p.style.zIndex = '9999';
    p.style.transition = 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.6s ease-out';
    p.style.transform = 'translate(-50%, -50%) scale(0.5)';
    p.style.opacity = '1';
    document.body.appendChild(p);

    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * 40 + 20;
    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist - 20;

    setTimeout(() => {
      p.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(1.2)`;
      p.style.opacity = '0';
    }, 10);

    setTimeout(() => p.remove(), 600);
  }
}

export default function ReactionsDisplay({ msgId, reactions, me, target, isSent, onReact }: ReactionsDisplayProps) {
  const locks = useRef<Record<string, boolean>>({});

  const toggleReaction = useCallback((emoji: string) => {
    if (locks.current[msgId]) return;
    locks.current[msgId] = true;
    setTimeout(() => { locks.current[msgId] = false; }, 400);

    const socket = getSocket();
    socket.emit('set_reaction', { msgId, emoji, receiver: target });
    onReact?.(msgId, emoji);

    const msgEl = document.querySelector(`[data-id="${msgId}"]`) as HTMLElement;
    playReactionParticles(msgEl, emoji, isSent);
  }, [msgId, target, onReact]);

  if (!reactions || reactions.length === 0) return null;

  return (
    <div className={`${styles.container} ${isSent ? styles.sent : styles.received}`}>
      {reactions.map((r) => (
        <div
          key={r.emoji}
          className={styles.pill}
          onClick={() => toggleReaction(r.emoji)}
        >
          <span>{r.emoji}</span>
          <span className={styles.count}>{r.count}</span>
        </div>
      ))}
    </div>
  );
}
