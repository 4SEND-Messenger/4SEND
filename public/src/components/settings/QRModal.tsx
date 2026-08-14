import { useState, useEffect, useRef } from 'react';
import { useAuthContext } from '../../context/AuthContext';
import { useI18n } from '../../hooks/useI18n';
import QRCode from 'qrcode';
import { Html5Qrcode } from 'html5-qrcode';
import ModalShell from './ModalShell';
import styles from './QRModal.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onScanResult?: (text: string) => void;
}

type Tab = 'myqr' | 'scanner';

export default function QRModal({ isOpen, onClose, onScanResult }: Props) {
  const { t } = useI18n();
  const { me } = useAuthContext();
  const [activeTab, setActiveTab] = useState<Tab>('myqr');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || activeTab !== 'myqr' || !me || !canvasRef.current) return;
    const joinUrl = `${window.location.origin}/?join=${me}`;
    QRCode.toCanvas(canvasRef.current, joinUrl, {
      width: 200,
      margin: 1,
      color: {
        dark: '#1c1c23',
        light: '#ffffff',
      },
    }).catch(() => {});
  }, [isOpen, activeTab, me]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'scanner') return;
    let stopped = false;
    let running = false;
    setScanError(null);
    const scanner = new Html5Qrcode('qr-scanner-region');
    scannerRef.current = scanner;
    const stopScanner = () => {
      if (stopped) return;
      stopped = true;
      scannerRef.current = null;
      if (running) {
        try { scanner.stop(); } catch {}
      }
    };
    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: 220 },
      (decoded) => {
        try { navigator.vibrate?.(50); } catch {}
        const result = decoded.trim();
        if (onScanResult) onScanResult(result);
        stopScanner();
        onClose();
      },
      () => {}
    ).then(() => { running = true; }).catch(() => {
      if (!stopped) setScanError(t('Камера не найдена'));
    });
    return () => {
      stopScanner();
    };
  }, [isOpen, activeTab, onScanResult, onClose, t]);


  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title={t('QR-код')}>
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${activeTab === 'myqr' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('myqr')}>
          {t('Мой QR')}
        </button>
        <button className={`${styles.tab} ${activeTab === 'scanner' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('scanner')}>
          {t('Сканер')}
        </button>
      </div>
      {activeTab === 'myqr' ? (
        <div className={styles.qrContent}>
          <div className={styles.qrBox}>
            <canvas ref={canvasRef} className={styles.qrCanvas} />
          </div>
          <p className={styles.username}>@{me}</p>
          <p className={styles.scanHint}>{t('Отсканируйте, чтобы начать чат')}</p>
        </div>
      ) : (
        <div className={styles.scannerContent}>
          <div id="qr-scanner-region" className={styles.scannerRegion} />
          {scanError && <p className={styles.scannerError}>{scanError}</p>}
          {!scanError && (
            <>
              <p className={styles.scannerText}>{t('Сканирование QR-кодов')}</p>
              <p className={styles.scannerSubtext}>{t('Камера будет активирована для сканирования')}</p>
            </>
          )}
        </div>
      )}
    </ModalShell>
  );
}
