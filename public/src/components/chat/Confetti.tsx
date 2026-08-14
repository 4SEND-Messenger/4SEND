import { useState, useEffect, useRef } from 'react';
import styles from './Confetti.module.css';

interface Props {
  isOpen: boolean;
  duration?: number;
}

const COLORS = ['#a74fff', '#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff'];

function makeParticles(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const size = Math.random() * 6 + 4;
    return {
      id: i,
      left: Math.random() * 100,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size,
      rotation: Math.random() * 360,
      duration: Math.random() * 2 + 2,
      delay: Math.random() * 0.8,
      circle: Math.random() > 0.5,
    };
  });
}

export default function Confetti({ isOpen, duration = 3000 }: Props) {
  const [particles, setParticles] = useState<ReturnType<typeof makeParticles>>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (isOpen) {
      setParticles(makeParticles(100));
      timerRef.current = setTimeout(() => setParticles([]), duration);
    }
    return () => clearTimeout(timerRef.current);
  }, [isOpen, duration]);

  if (!isOpen || particles.length === 0) return null;

  return (
    <div className={styles.container}>
      {particles.map((p) => (
        <div
          key={p.id}
          className={styles.particle}
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            transform: `rotate(${p.rotation}deg)`,
            borderRadius: p.circle ? '50%' : 0,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
