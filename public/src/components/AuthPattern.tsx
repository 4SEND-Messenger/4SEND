import { useEffect, useRef, useCallback } from 'react';
import styles from '../pages/AuthPage.module.css';

const ICON_PATHS = [
  'M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z',
  'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
  'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6z',
  'M7 2v11h3v9l7-12h-4l4-8z',
  'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
  'M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z',
];

interface PatternSvg {
  el: SVGElement;
  depth: number;
  rotate: string;
}

export default function AuthPattern() {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgsRef = useRef<PatternSvg[]>([]);

  const scatter = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = '';

    const svgs: PatternSvg[] = [];
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 7; j++) {
        const d = ICON_PATHS[Math.floor(Math.random() * ICON_PATHS.length)]!;
        const size = Math.floor(Math.random() * 35) + 65;
        const x = (i * 100 / 9) + (100 / 9 / 2) + (Math.random() * 12 - 6);
        const y = (j * 100 / 7) + (100 / 7 / 2) + (Math.random() * 12 - 6);
        const rot = Math.floor(Math.random() * 100) - 50;
        const op = (Math.random() * 0.05 + 0.04).toFixed(3);

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('width', String(size));
        svg.setAttribute('height', String(size));
        svg.style.cssText = `position:absolute;width:${size}px;height:${size}px;left:${x}%;top:${y}%;transform:translate(-50%,-50%) rotate(${rot}deg);opacity:${op};fill:#ffffff;transition:none;pointer-events:none;`;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        svg.appendChild(path);
        container.appendChild(svg);

        svgs.push({ el: svg, depth: size / 100, rotate: `rotate(${rot}deg)` });
      }
    }
    svgsRef.current = svgs;
  }, []);

  useEffect(() => {
    scatter();

    const onMove = (e: MouseEvent) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const mouseX = (e.clientX - cx) / cx;
      const mouseY = (e.clientY - cy) / cy;

      for (const svg of svgsRef.current) {
        svg.el.style.transform = `translate(calc(-50% + ${mouseX * 25 * svg.depth}px), calc(-50% + ${mouseY * 25 * svg.depth}px)) ${svg.rotate}`;
      }
    };

    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [scatter]);

  return <div ref={containerRef} className={styles.authPattern} />;
}
