import { memo, useEffect, useRef, useState, useCallback } from 'react';
import { useI18n } from '../../hooks/useI18n';
import { getSocket } from '../../services/socket';
import styles from './CallOverlay.module.css';

interface CallOverlayProps {
  type: 'incoming' | 'outgoing' | 'active' | 'ended';
  peer: string;
  peerDisplay?: string;
  peerAvatar?: string;
  withVideo?: boolean;
  signals?: Array<{ sdp?: unknown; candidate?: unknown }>;
  preloadedStream?: MediaStream | null;
  onAccept?: () => void;
  onClose: () => void;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.services.mozilla.com:3478' },
    { urls: 'stun:stunserver.stunprotocol.org:3478' },
  ],
};

export const CALL_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

const MicIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
  </svg>
);

const MicOffIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
    <path d="M2 2l20 20" stroke="currentColor" strokeWidth="2" fill="none"/>
  </svg>
);

function CallOverlay({ type, peer, peerDisplay, peerAvatar, withVideo, signals, preloadedStream, onAccept, onClose }: CallOverlayProps) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [callSecs, setCallSecs] = useState(0);
  const [micOff, setMicOff] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [cameraFlipped, setCameraFlipped] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  const [remoteHasVideo, setRemoteHasVideo] = useState(false);
  const [connState, setConnState] = useState<string>('new');
  const [screenSharing, setScreenSharing] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const localStreamRef = useRef<MediaStream | null>(null);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const streamStartedRef = useRef(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteSetRef = useRef(false);
  const processedSignalsRef = useRef(0);
  const signalChainRef = useRef<Promise<void>>(Promise.resolve());
  const incomingOfferDeferredRef = useRef(false);
  const acceptedRef = useRef(false);
  const makingOfferRef = useRef(false);
  const processingSdpRef = useRef(false);
  const politeRef = useRef(true);
  const ignoreOfferRef = useRef(false);
  const iceRestartedRef = useRef(false);
  const streamPromiseRef = useRef<Promise<void> | null>(null);
  const typeRef = useRef(type);
  typeRef.current = type;
  const preloadedStreamRef = useRef(preloadedStream);
  preloadedStreamRef.current = preloadedStream;

  const displayName = peerDisplay || peer;

  const tryPlay = (el: HTMLAudioElement | HTMLVideoElement | null) => {
    if (!el) return;
    el.play().catch(() => {
      const handler = () => {
        el.play().catch(() => {});
        document.removeEventListener('click', handler);
        document.removeEventListener('touchstart', handler);
      };
      document.addEventListener('click', handler, { once: true });
      document.addEventListener('touchstart', handler, { once: true });
    });
  };

  const closeWithAnim = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
      setScreenSharing(false);
    }
    setClosing(true);
    setTimeout(() => onClose(), 300);
  }, [onClose]);

  const createPeerConnection = useCallback(() => {
    if (pcRef.current) return pcRef.current;
    const pc = new RTCPeerConnection(RTC_CONFIG);
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        getSocket().emit('webrtc_signal', { target: peer, signal: { candidate: e.candidate.toJSON() } });
      }
    };
    pc.ontrack = (e) => {
      const stream = e.streams[0] || new MediaStream([e.track]);
      if (e.track.kind === 'audio') {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
          tryPlay(remoteAudioRef.current);
        }
      } else if (remoteVideoRef.current) {
        setRemoteHasVideo(true);
        e.track.onended = () => setRemoteHasVideo(false);
        e.track.onmute = () => setRemoteHasVideo(false);
        e.track.onunmute = () => setRemoteHasVideo(true);
        remoteVideoRef.current.srcObject = stream;
        tryPlay(remoteVideoRef.current);
      }
    };
    pc.oniceconnectionstatechange = () => {
      setConnState(pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed' && !iceRestartedRef.current && !politeRef.current && pc.signalingState === 'stable') {
        iceRestartedRef.current = true;
        (async () => {
          makingOfferRef.current = true;
          try {
            const offer = await pc.createOffer({ iceRestart: true });
            await pc.setLocalDescription(offer);
            getSocket().emit('webrtc_signal', { target: peer, signal: { sdp: pc.localDescription } });
          } catch {} finally {
            makingOfferRef.current = false;
          }
        })();
      }
    };
    pc.onconnectionstatechange = () => setConnState(pc.connectionState);
    pc.onnegotiationneeded = async () => {
      if (makingOfferRef.current || processingSdpRef.current || pc.signalingState !== 'stable') return;
      if (typeRef.current === 'incoming' && !acceptedRef.current) return;
      makingOfferRef.current = true;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        getSocket().emit('webrtc_signal', { target: peer, signal: { sdp: pc.localDescription } });
      } catch {} finally {
        makingOfferRef.current = false;
      }
    };
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current!));
    }
    pcRef.current = pc;
    return pc;
  }, [peer]);

  const startLocalStream = useCallback((video = false) => {
    if (streamPromiseRef.current) return streamPromiseRef.current;
    const preloaded = preloadedStreamRef.current;
    if (preloaded) {
      localStreamRef.current = preloaded;
      streamStartedRef.current = true;
      setHasVideo(video);
      streamPromiseRef.current = (async () => {
        if (video && localVideoRef.current) {
          localVideoRef.current.srcObject = preloaded;
        }
      })();
      return streamPromiseRef.current;
    }
    streamPromiseRef.current = (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: CALL_AUDIO_CONSTRAINTS,
          video: video ? { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, facingMode: 'user' } : false
        });
        localStreamRef.current = stream;
        streamStartedRef.current = true;
        setHasVideo(video);
        if (video && localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (e) {}
    })();
    return streamPromiseRef.current;
  }, []);

  const sendOffer = useCallback(async () => {
    if (pcRef.current) return;
    if (!localStreamRef.current) {
      await startLocalStream(!!withVideo);
    }
    if (pcRef.current) return;
    politeRef.current = false;
    makingOfferRef.current = true;
    try {
      const pc = createPeerConnection();
      if (localStreamRef.current) {
        const existingKinds = new Set(pc.getSenders().map(s => s.track?.kind));
        localStreamRef.current.getTracks().forEach(track => {
          if (!existingKinds.has(track.kind)) {
            pc.addTrack(track, localStreamRef.current!);
            existingKinds.add(track.kind);
          }
        });
      }
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      getSocket().emit('webrtc_signal', { target: peer, signal: { sdp: pc.localDescription } });
    } catch {} finally {
      makingOfferRef.current = false;
    }
  }, [createPeerConnection, peer, startLocalStream, withVideo]);

  const addMissingTracks = useCallback((pc: RTCPeerConnection) => {
    if (!localStreamRef.current) return;
    const existingKinds = new Set(pc.getSenders().map(s => s.track?.kind));
    localStreamRef.current.getTracks().forEach(track => {
      if (!existingKinds.has(track.kind)) {
        pc.addTrack(track, localStreamRef.current!);
        existingKinds.add(track.kind);
      }
    });
  }, []);

  const handleRemoteSignal = useCallback(async (sig: { sdp?: unknown; candidate?: unknown }) => {
    if (!pcRef.current && sig.sdp) {
      await startLocalStream(!!withVideo);
      if (!pcRef.current) {
        politeRef.current = true;
        createPeerConnection();
      }
    }
    const pc = pcRef.current;
    if (!pc) return;
    if (localStreamRef.current) {
      addMissingTracks(pc);
    }
    if (sig.sdp && (sig.sdp as RTCSessionDescriptionInit).type) {
      processingSdpRef.current = true;
      try {
        const desc = sig.sdp as RTCSessionDescriptionInit;
        if (desc.type === 'offer') {
          const offerCollision = makingOfferRef.current || pc.signalingState !== 'stable';
          ignoreOfferRef.current = offerCollision && !politeRef.current;
          if (ignoreOfferRef.current) return;
          if (pc.signalingState === 'have-local-offer') {
            await pc.setLocalDescription({ type: 'rollback' });
          }
          await pc.setRemoteDescription(desc);
          ignoreOfferRef.current = false;
          remoteSetRef.current = true;
          for (const c of pendingCandidatesRef.current) {
            await pc.addIceCandidate(c).catch(() => {});
          }
          pendingCandidatesRef.current = [];
          const needDefer = typeRef.current === 'incoming' && !acceptedRef.current;
          if (needDefer) {
            incomingOfferDeferredRef.current = true;
          } else {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            getSocket().emit('webrtc_signal', { target: peer, signal: { sdp: pc.localDescription } });
          }
        } else if (desc.type === 'answer' && pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(desc);
          ignoreOfferRef.current = false;
          remoteSetRef.current = true;
          for (const c of pendingCandidatesRef.current) {
            await pc.addIceCandidate(c).catch(() => {});
          }
          pendingCandidatesRef.current = [];
        }
      } catch {} finally {
        processingSdpRef.current = false;
      }
    } else if (sig.candidate) {
      if (ignoreOfferRef.current) return;
      const candidate = sig.candidate as RTCIceCandidateInit;
      if (remoteSetRef.current) {
        await pc.addIceCandidate(candidate).catch(() => {});
      } else {
        pendingCandidatesRef.current.push(candidate);
      }
    }
  }, [createPeerConnection, peer, startLocalStream, withVideo]);

  useEffect(() => {
    if (!signals || signals.length === 0) return;
    const pending = signals.slice(processedSignalsRef.current);
    if (pending.length === 0) return;
    processedSignalsRef.current = signals.length;
    let chain = signalChainRef.current;
    for (const sig of pending) {
      chain = chain.then(() => handleRemoteSignal(sig)).catch(() => {});
    }
    signalChainRef.current = chain;
  }, [signals, handleRemoteSignal]);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    if (type === 'outgoing') {
      startLocalStream(withVideo).then(() => sendOffer());
    }
    if (type === 'active') {
      timerRef.current = setInterval(() => {
        setCallSecs(s => s + 1);
      }, 1000);
    }
    if (type === 'incoming' || type === 'outgoing') {
      const audio = new Audio('calling.mp3');
      audio.loop = true;
      audio.currentTime = 0;
      audio.play().catch(() => {
        const handler = () => {
          if (ringtoneRef.current === audio && audio.paused) audio.play().catch(() => {});
          document.removeEventListener('click', handler);
          document.removeEventListener('touchstart', handler);
        };
        document.addEventListener('click', handler);
        document.addEventListener('touchstart', handler);
      });
      ringtoneRef.current = audio;
    }
    if (type === 'ended') {
      setTimeout(() => closeWithAnim(), 2000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
        ringtoneRef.current.loop = false;
        ringtoneRef.current = null;
      }
    };
  }, [type, closeWithAnim, startLocalStream, withVideo, sendOffer]);

  useEffect(() => {
    return () => {
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      if (preloadedStreamRef.current) {
        preloadedStreamRef.current.getTracks().forEach(track => track.stop());
      }
      streamPromiseRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (type === 'active') {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setCallSecs(s => s + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current && type !== 'active') {
        clearInterval(timerRef.current);
      }
    };
  }, [type]);

  useEffect(() => {
    if (type === 'ended' || type === 'active') {
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
        ringtoneRef.current.loop = false;
        ringtoneRef.current = null;
      }
    }
  }, [type]);

  const handleAccept = async () => {
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
      ringtoneRef.current.loop = false;
      ringtoneRef.current = null;
    }
    acceptedRef.current = true;
    await startLocalStream(!!withVideo);
    await signalChainRef.current.catch(() => {});

    const existingPc = pcRef.current;
    if (existingPc && (incomingOfferDeferredRef.current || existingPc.signalingState === 'have-remote-offer')) {
      addMissingTracks(existingPc);
      try {
        const answer = await existingPc.createAnswer();
        await existingPc.setLocalDescription(answer);
        getSocket().emit('webrtc_signal', { target: peer, signal: { sdp: existingPc.localDescription } });
      } catch {}
      incomingOfferDeferredRef.current = false;
    }

    const socket = getSocket();
    socket.emit('call_response', { target: peer, answer: 'accepted' });
    if (remoteAudioRef.current) tryPlay(remoteAudioRef.current);
    if (remoteVideoRef.current) tryPlay(remoteVideoRef.current);
    onAccept?.();
  };

  const handleReject = () => {
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
      ringtoneRef.current.loop = false;
      ringtoneRef.current = null;
    }
    const socket = getSocket();
    socket.emit('call_response', { target: peer, answer: 'rejected' });
    closeWithAnim();
  };

  const handleEnd = () => {
    const dur = localStreamRef.current && localStreamRef.current.getVideoTracks().length > 0;
    const socket = getSocket();
    socket.emit('call_end', { target: peer, callDuration: callSecs, withVideo: dur });
    closeWithAnim();
  };

  const handleCancel = () => {
    const socket = getSocket();
    socket.emit('call_end', { target: peer, callDuration: 0, withVideo: false });
    closeWithAnim();
  };

  const toggleCallVideo = async () => {
    if (!localStreamRef.current) return;
    const tracks = localStreamRef.current.getVideoTracks();
    if (tracks.length > 0) {
      tracks[0].enabled = !tracks[0].enabled;
      setVideoOff(!tracks[0].enabled);
    } else {
      try {
        const needAudio = localStreamRef.current.getAudioTracks().length === 0;
        const newStream = await navigator.mediaDevices.getUserMedia({
          audio: needAudio ? CALL_AUDIO_CONSTRAINTS : false,
          video: { facingMode: 'user' }
        });
        const videoTrack = newStream.getVideoTracks()[0];
        const newAudioTracks = newStream.getAudioTracks();
        if (needAudio && newAudioTracks[0]) {
          localStreamRef.current.addTrack(newAudioTracks[0]);
        } else {
          newAudioTracks.forEach(t => t.stop());
        }
        if (videoTrack) {
          localStreamRef.current.addTrack(videoTrack);
          if (pcRef.current) {
            addMissingTracks(pcRef.current);
            const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
            if (sender) {
              await sender.replaceTrack(videoTrack);
            } else {
              pcRef.current.addTrack(videoTrack, localStreamRef.current);
            }
          }
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }
          setHasVideo(true);
          setVideoOff(false);
        }
      } catch (e) {}
    }
  };

  const toggleCallMic = () => {
    if (!localStreamRef.current) return;
    const audioTracks = localStreamRef.current.getAudioTracks();
    if (audioTracks.length > 0) {
      audioTracks[0].enabled = !audioTracks[0].enabled;
      setMicOff(!audioTracks[0].enabled);
    }
  };

  const flipCallCamera = async () => {
    if (!localStreamRef.current) return;
    const oldTracks = localStreamRef.current.getVideoTracks();
    oldTracks.forEach(t => { localStreamRef.current?.removeTrack(t); t.stop(); });
    try {
      const needAudio = localStreamRef.current.getAudioTracks().length === 0;
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: needAudio ? CALL_AUDIO_CONSTRAINTS : false,
        video: { facingMode: cameraFlipped ? 'user' : 'environment' }
      });
      const videoTrack = newStream.getVideoTracks()[0];
      const newAudioTracks = newStream.getAudioTracks();
      if (needAudio && newAudioTracks[0]) {
        localStreamRef.current.addTrack(newAudioTracks[0]);
      } else {
        newAudioTracks.forEach(t => t.stop());
      }
      if (videoTrack) {
        localStreamRef.current.addTrack(videoTrack);
        if (pcRef.current) {
          addMissingTracks(pcRef.current);
          const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            await sender.replaceTrack(videoTrack);
          } else {
            pcRef.current.addTrack(videoTrack, localStreamRef.current);
          }
        }
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
        setCameraFlipped(!cameraFlipped);
      }
    } catch (e) {}
  };

  const stopScreenShare = async () => {
    const display = screenStreamRef.current;
    screenStreamRef.current = null;
    const displayTrack = display?.getVideoTracks()[0] || null;
    if (displayTrack) displayTrack.onended = null;
    display?.getTracks().forEach(t => t.stop());
    setScreenSharing(false);
    const local = localStreamRef.current;
    if (localVideoRef.current && local) localVideoRef.current.srcObject = local;
    const pc = pcRef.current;
    if (pc && displayTrack) {
      const sender = pc.getSenders().find(s => s.track === displayTrack || s.track?.kind === 'video');
      const camTrack = local?.getVideoTracks()[0];
      if (sender) {
        if (camTrack) {
          await sender.replaceTrack(camTrack).catch(() => {});
        } else {
          try { pc.removeTrack(sender); } catch {}
        }
      }
    }
  };

  const startScreenShare = async () => {
    if (screenStreamRef.current) return;
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const track = display.getVideoTracks()[0];
      if (!track) {
        display.getTracks().forEach(t => t.stop());
        return;
      }
      screenStreamRef.current = display;
      track.onended = () => { void stopScreenShare(); };
      if (localVideoRef.current) localVideoRef.current.srcObject = display;
      const pc = pcRef.current;
      if (pc) {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(track);
        } else {
          pc.addTrack(track, display);
        }
      }
      setScreenSharing(true);
    } catch {}
  };

  const toggleScreenShare = () => {
    if (screenStreamRef.current) void stopScreenShare();
    else void startScreenShare();
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const connPending = connState === 'new' || connState === 'connecting' || connState === 'checking';
  const statusText = type === 'outgoing'
    ? (withVideo ? t('Видеозвонок...') : t('Звонок...'))
    : type === 'incoming'
    ? (withVideo ? t('Входящий видеозвонок') : t('Входящий звонок'))
    : type === 'active'
    ? (connState === 'failed' || connState === 'disconnected'
        ? t('Нет соединения')
        : connPending
        ? t('Соединение...')
        : formatTime(callSecs))
    : t('Звонок завершён');

  return (
    <div className={`${styles.overlay} ${visible && !closing ? styles.overlayVisible : ''}`}>
      <div className={styles.videoContainer}>
        <video ref={remoteVideoRef} autoPlay playsInline muted className={`${styles.remoteVideo} ${type === 'active' && remoteHasVideo ? styles.remoteVideoVisible : ''}`} />
        <audio ref={remoteAudioRef} autoPlay />
        <video ref={localVideoRef} autoPlay playsInline muted className={`${styles.localVideo} ${type === 'active' && ((hasVideo && !videoOff) || screenSharing) ? styles.localVideoVisible : ''}`} />
      </div>
      <div className={styles.uiLayer}>
        <div className={styles.mainArea}>
          <div className={`${styles.avatarContainer} ${type !== 'active' ? styles.avatarPulse : ''}`}>
            {peerAvatar ? (
              <img src={peerAvatar} alt="" className={styles.avatarImg} />
            ) : (
              displayName.charAt(0).toUpperCase()
            )}
          </div>
          <div className={styles.name}>{displayName}</div>
          <div className={styles.status}>{statusText}</div>
        </div>
        <div className={styles.controls}>
          {type === 'incoming' && (
            <>
              <button className={`${styles.controlBtn} ${styles.rejectBtn}`} onClick={handleReject}>
                <svg viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
              </button>
              <button className={`${styles.controlBtn} ${styles.acceptBtn}`} onClick={handleAccept}>
                <svg viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
              </button>
            </>
          )}
          {type === 'outgoing' && (
            <button className={`${styles.controlBtn} ${styles.endBtn}`} onClick={handleCancel}>
              <svg viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
            </button>
          )}
          {type === 'active' && (
            <>
              <button className={styles.activeControlBtn} onClick={toggleCallVideo} title={videoOff ? t('Вкл. видео') : t('Выкл. видео')}>
                <svg viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
              </button>
              {hasVideo && (
                <button className={styles.activeControlBtn} onClick={flipCallCamera} title={t('Переключить камеру')}>
                  <svg viewBox="0 0 24 24"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
                </button>
              )}
              <button
                className={`${styles.activeControlBtn} ${screenSharing ? styles.activeControlBtnOn : ''}`}
                onClick={toggleScreenShare}
                title={screenSharing ? t('Остановить демонстрацию') : t('Демонстрация экрана')}
              >
                <svg viewBox="0 0 24 24"><path d="M4 4h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm15 3H5v6h14V7zm-7 .5l3 3h-1.75v2.5h-2.5V11H9l3-3.5z"/></svg>
              </button>
              <button className={styles.activeControlBtn} onClick={toggleCallMic} title={micOff ? t('Вкл. микрофон') : t('Выкл. микрофон')}>
                {micOff ? <MicOffIcon /> : <MicIcon />}
              </button>
              <button className={`${styles.controlBtn} ${styles.endBtn}`} onClick={handleEnd}>
                <svg viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(CallOverlay);
