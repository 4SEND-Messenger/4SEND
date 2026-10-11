import { useState, useEffect, useRef, useCallback } from 'react';
import { useI18n } from '../../hooks/useI18n';
import { getVideoMessageSettings, pickVideoMessageMime } from '../../utils/videoMessage';
import styles from './VoiceRecorder.module.css';

interface Props {
  isActive: boolean;
  mode: 'audio' | 'video';
  onCancel: () => void;
  onSend: (blob: Blob, mode: 'audio' | 'video') => void;
  locked: boolean;
  onLockChange: (locked: boolean) => void;
}

export default function VoiceRecorder({ isActive, mode, onCancel, onSend, locked, onLockChange }: Props) {
  const { t } = useI18n();
  const [elapsed, setElapsed] = useState(0);
  const [bars, setBars] = useState<number[]>(new Array(20).fill(2));
  const [closing, setClosing] = useState(false);
  const [visible, setVisible] = useState(isActive);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(() => getVideoMessageSettings().camera);
  const [flashOn, setFlashOn] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef('audio/webm');
  const pendingSendRef = useRef(false);
  const onSendRef = useRef(onSend);
  onSendRef.current = onSend;
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawFrameRef = useRef<number>(0);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (isActive) {
      setVisible(true);
      setClosing(false);
      setElapsed(0);
    }
  }, [isActive]);

  useEffect(() => {
    if (!isActive && locked) {
      onLockChange(false);
    }
  }, [isActive, locked, onLockChange]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    swipeStartRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!swipeStartRef.current || locked) return;
    const dy = swipeStartRef.current.y - e.clientY;
    if (dy > 50) {
      onLockChange(true);
      swipeStartRef.current = null;
    }
  }, [locked, onLockChange]);

  const handlePointerUp = useCallback(() => {
    swipeStartRef.current = null;
  }, []);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    cancelAnimationFrame(animFrameRef.current);
    cancelAnimationFrame(drawFrameRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    stopStream();
  }, [stopStream]);

  const finalizeRecording = useCallback(() => {
    const chunks = chunksRef.current;
    chunksRef.current = [];
    if (!pendingSendRef.current) return;
    pendingSendRef.current = false;
    if (!chunks.length) return;
    const blob = new Blob(chunks, { type: mimeRef.current });
    if (blob.size === 0) return;
    onSendRef.current(blob, mode);
  }, [mode]);

  const animateClose = useCallback((cb: () => void) => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      setVisible(false);
      cb();
    }, 250);
  }, []);

  const handleCancel = useCallback(() => {
    stopRecording();
    chunksRef.current = [];
    setElapsed(0);
    animateClose(onCancel);
  }, [stopRecording, onCancel, animateClose]);

  const handleSend = useCallback(() => {
    pendingSendRef.current = true;
    stopRecording();
    setElapsed(0);
    animateClose(() => {});
  }, [stopRecording, animateClose]);

  const switchCamera = useCallback(async () => {
    const newFacing: 'user' | 'environment' = facingMode === 'user' ? 'environment' : 'user';
    try {
      const camStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacing, width: { ideal: 720 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }
      });
      const newTrack = camStream.getVideoTracks()[0];
      if (!newTrack) { camStream.getTracks().forEach(t => t.stop()); return; }
      const current = streamRef.current;
      let targetStream = current;
      if (current) {
        const oldTrack = current.getVideoTracks()[0];
        current.removeTrack(oldTrack);
        if (oldTrack) oldTrack.stop();
        current.addTrack(newTrack);
      } else {
        targetStream = camStream;
        streamRef.current = camStream;
      }
      if (videoRef.current && targetStream) {
        videoRef.current.srcObject = null;
        videoRef.current.srcObject = targetStream;
        await videoRef.current.play().catch(() => {});
      }
      setFacingMode(newFacing);
    } catch {
      // камера недоступна/занята — продолжаем запись на текущей, модалку не закрываем
    }
  }, [facingMode]);

  const toggleFlash = useCallback(async () => {
    setFlashOn(prev => !prev);
    if (facingMode === 'environment' && streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      try {
        await track?.applyConstraints({ advanced: [{ torch: !flashOn }] as any });
      } catch {}
    }
  }, [facingMode, flashOn]);

  const handleStart = useCallback(async () => {
    try {
      const videoSettings = getVideoMessageSettings();
      const constraints: MediaStreamConstraints = mode === 'video'
        ? { audio: { echoCancellation: true, noiseSuppression: true }, video: { facingMode, width: { ideal: videoSettings.quality }, height: { ideal: videoSettings.quality }, frameRate: { ideal: 30 } } }
        : { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, sampleRate: 44100 } };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      chunksRef.current = [];

      if (mode === 'video') {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const canvas = document.createElement('canvas');
        canvas.width = 600;
        canvas.height = 600;
        const ctx = canvas.getContext('2d')!;

        const drawFrame = () => {
          if (!isActive || !videoRef.current) return;
          const v = videoRef.current;
          if (v.readyState >= 2) {
            const min = Math.min(v.videoWidth, v.videoHeight);
            const sx = (v.videoWidth - min) / 2;
            const sy = (v.videoHeight - min) / 2;
            ctx.drawImage(v, sx, sy, min, min, 0, 0, 600, 600);
          }
          drawFrameRef.current = requestAnimationFrame(drawFrame);
        };
        drawFrame();

        const canvasStream = canvas.captureStream(30);
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) canvasStream.addTrack(audioTrack);

        const mime = pickVideoMessageMime(videoSettings.codec);
        mimeRef.current = mime;
        const recorder = new MediaRecorder(canvasStream, { mimeType: mime, videoBitsPerSecond: videoSettings.bitrate });
        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        recorder.onstop = finalizeRecording;
        recorder.start();
      } else {
        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        analyserRef.current = analyser;

        const gainNode = audioCtx.createGain();
        gainNode.gain.value = 3.5;
        const destination = audioCtx.createMediaStreamDestination();
        analyser.connect(gainNode);
        gainNode.connect(destination);

        const recorder = new MediaRecorder(destination.stream, { audioBitsPerSecond: 128000 });
        mimeRef.current = recorder.mimeType || 'audio/webm';
        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        recorder.onstop = finalizeRecording;
        recorder.start();

        const updateBars = () => {
          if (!analyserRef.current) return;
          const data = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(data);
          const newBars = Array.from({ length: 20 }, (_, i) => {
            const val = data[i] || 0;
            return Math.max(2, (val / 255) * 30);
          });
          setBars(newBars);
          animFrameRef.current = requestAnimationFrame(updateBars);
        };
        updateBars();
      }

      timerRef.current = setInterval(() => {
        setElapsed(prev => prev + 1);
      }, 1000);
    } catch {
      animateClose(onCancel);
    }
  }, [mode, facingMode, isActive, onCancel, animateClose, finalizeRecording]);

  useEffect(() => {
    if (!isActive) return;
    handleStart();
    return () => {
      stopRecording();
    };
  }, [isActive]);

  useEffect(() => {
    if (!isActive || mode !== 'video') return;
    const ov = document.getElementById('flash-overlay');
    if (flashOn && !ov) {
      const el = document.createElement('div');
      el.id = 'flash-overlay';
      Object.assign(el.style, {
        position: 'fixed', inset: '0', background: '#fff',
        opacity: '0.85', zIndex: '2147483647', pointerEvents: 'none'
      });
      document.body.appendChild(el);
    } else if (!flashOn && ov) {
      ov.remove();
    }
    return () => document.getElementById('flash-overlay')?.remove();
  }, [flashOn, isActive, mode]);

  if (!visible) return null;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div
      className={`${styles.container} ${closing ? styles.closing : ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={{ touchAction: 'pan-y' }}
    >
      {mode === 'video' && (
        <>
          <div className={styles.videoPreview}>
            <video ref={videoRef} muted playsInline className={styles.video} style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }} />
          </div>
          <div className={styles.camControls}>
            <button className={styles.camBtn} onClick={toggleFlash} style={{ background: flashOn ? 'var(--accent-solid)' : undefined }}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><path d="M7 2v11h3v9l7-12h-4l4-8z" /></svg>
            </button>
            <button className={styles.camBtn} onClick={switchCamera}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 12 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" /></svg>
            </button>
          </div>
        </>
      )}

      <div className={`${styles.pill} ${locked ? styles.pillLocked : ''}`}>
        <div className={styles.pillLeft}>
          <div className={styles.dot} />
          <span className={styles.timer}>{formatTime(elapsed)}</span>
        </div>

        {mode === 'audio' && (
          <div className={styles.waveform}>
            {bars.map((h, i) => (
              <div key={i} className={styles.bar} style={{ height: `${h}px` }} />
            ))}
          </div>
        )}
        {mode === 'video' && (
          <div className={styles.videoBadge}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="#ff3b30"><circle cx="12" cy="12" r="3" /></svg>
            <span className={styles.timer}>{formatTime(elapsed)}</span>
          </div>
        )}

        <div className={styles.pillRight}>
          {!locked && (
            <span className={styles.cancel} onClick={handleCancel}>{t('Отмена')}</span>
          )}
          {locked && (
            <button className={styles.trashBtn} onClick={handleCancel}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="#ff4d4d"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
            </button>
          )}
          <button className={styles.sendBtn} onClick={handleSend}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
