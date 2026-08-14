import { useState, useEffect, useRef } from 'react';
import { useI18n } from '../hooks/useI18n';

export default function LoadingScreen() {
  const { t } = useI18n();
  const [phase, setPhase] = useState<'visible' | 'fading' | 'hidden'>('visible');
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setPhase('fading'), 800);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (phase !== 'fading') return;
    const el = elRef.current;
    if (!el) return;

    const onEnd = () => setPhase('hidden');
    el.addEventListener('transitionend', onEnd, { once: true });
    const t = setTimeout(onEnd, 600);
    return () => {
      el.removeEventListener('transitionend', onEnd);
      clearTimeout(t);
    };
  }, [phase]);

  if (phase === 'hidden') return null;

  return (
    <div
      ref={elRef}
      className="loading-screen"
      style={{ opacity: phase === 'fading' ? 0 : 1 }}
    >
      <div className="loading-inner">
        <div className="loading-logo-wrap">
          <div className="loading-spinner" />
          <div className="loading-logo">
            <img src="/ico.png" alt="4SEND" style={{ width: 96, height: 96, objectFit: 'contain' }} />
          </div>
        </div>
        <div className="loading-title">4SEND</div>
        <div className="loading-subtitle">{t('Загрузка...')}</div>
      </div>
      <div className="loading-glow" />
      <style>{`
        .loading-screen {
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100vh;
          background: #0a0a0c;
          z-index: 9999999;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          transition: opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .loading-inner {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          z-index: 2;
        }
        .loading-logo-wrap {
          position: relative;
          width: 96px;
          height: 96px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 28px;
        }
        .loading-spinner {
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          background: conic-gradient(from 0deg, transparent 0%, transparent 40%, var(--accent-solid) 80%, #d4aaff 100%);
          animation: loaderSpin 1.2s linear infinite;
          -webkit-mask-image: radial-gradient(transparent 58%, black 59%);
          mask-image: radial-gradient(transparent 58%, black 59%);
        }
        .loading-logo {
          position: relative;
          width: 112px;
          height: 112px;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: loaderFloat 3s ease-in-out infinite;
        }
        .loading-title {
          font-weight: 900;
          font-size: 28px;
          letter-spacing: 4px;
          background: linear-gradient(to right, #ffffff 20%, #d4aaff 50%, #ffffff 80%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: loaderShine 3s linear infinite;
          margin-bottom: 10px;
          margin-right: -4px;
        }
        .loading-subtitle {
          font-size: 12px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.4);
          letter-spacing: 2px;
          text-transform: uppercase;
          animation: loaderPulseText 1.5s ease-in-out infinite;
        }
        .loading-glow {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: radial-gradient(circle at center, rgba(167, 79, 255, 0.1) 0%, transparent 60%);
          pointer-events: none;
        }
        @keyframes loaderSpin { 100% { transform: rotate(360deg); } }
        @keyframes loaderFloat { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-6px); } }
        @keyframes loaderShine { to { background-position: 200% center; } }
        @keyframes loaderPulseText { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
      `}</style>
    </div>
  );
}
