import { useRef, useCallback, useState } from 'react';
import { getSocket } from '../services/socket';
import { useI18n } from './useI18n';

const CHUNK_SIZE = 65536;

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export interface P2PTransferState {
  direction: 'send' | 'receive' | null;
  status: 'idle' | 'offer' | 'incoming' | 'connecting' | 'transferring' | 'done' | 'error' | 'cancelled';
  fileName: string;
  fileSize: number;
  progress: number;
  error?: string;
  blob?: Blob;
  peer?: string;
}

function errMsg(e: unknown, fallback: string, t: (key: string) => string): string {
  const txt = e instanceof Error ? e.message : null;
  if (!txt) return t(fallback);
  if (/network|timeout|abort/i.test(txt)) return t('Соединение потеряно: проверьте интернет');
  if (/buffer|overflow|full/i.test(txt)) return t('Буфер переполнен: слишком быстрая отправка');
  if (/closed|disconnected|failed/i.test(txt)) return t('Собеседник отключился или закрыл вкладку');
  if (/permission|denied|blocked/i.test(txt)) return t('Доступ к WebRTC заблокирован браузером');
  if (/ice|stun|turn|relay/i.test(txt)) return t('Не удалось установить P2P-соединение (ICE)');
  return txt.length < 80 ? txt : t(fallback);
}

export function useP2PTransfer() {
  const { t } = useI18n();
  const [state, setState] = useState<P2PTransferState>({
    direction: null,
    status: 'idle',
    fileName: '',
    fileSize: 0,
    progress: 0,
  });

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const peerRef = useRef<string | null>(null);
  const chunksRef = useRef<ArrayBuffer[]>([]);
  const totalChunksRef = useRef(0);
  const receivedChunksRef = useRef(0);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const transferDoneRef = useRef(false);
  const pendingOfferSdpRef = useRef<RTCSessionDescriptionInit | null>(null);
  const declineTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const cleanup = useCallback(() => {
    if (dcRef.current) {
      dcRef.current.close();
      dcRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    peerRef.current = null;
    chunksRef.current = [];
    totalChunksRef.current = 0;
    receivedChunksRef.current = 0;
    pendingCandidatesRef.current = [];
  }, []);

  const flushCandidates = useCallback(() => {
    if (!pcRef.current) return;
    for (const c of pendingCandidatesRef.current) {
      pcRef.current.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
    }
    pendingCandidatesRef.current = [];
    transferDoneRef.current = false;
  }, []);

  const createPC = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (e) => {
      if (!e.candidate || !peerRef.current) return;
      const socket = getSocket();
      socket.emit('file_ice_candidate', { target: peerRef.current, candidate: e.candidate.toJSON() });
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        if (transferDoneRef.current) return;
        setState(prev => ({ ...prev, status: 'error', error: pc.iceConnectionState === 'failed' ? t('Соединение разорвано: не удалось согласовать параметры (ICE failed)') : t('Соединение потеряно: собеседник вышел из сети') }));
        cleanup();
      }
    };

    pcRef.current = pc;
    return pc;
  }, [cleanup]);

  const setupDcHandlers = useCallback((dc: RTCDataChannel, peerName: string) => {
    dc.binaryType = 'arraybuffer';
    dcRef.current = dc;
    chunksRef.current = [];
    receivedChunksRef.current = 0;
    let pendingChunkSize = 0;

    dc.onmessage = (evt) => {
      if (typeof evt.data === 'string') {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === 'metadata') {
            totalChunksRef.current = msg.totalChunks;
            setState(prev => ({ ...prev, status: 'transferring', progress: 0 }));
          } else if (msg.type === 'chunk') {
            pendingChunkSize = msg.size;
          } else if (msg.type === 'complete') {
            transferDoneRef.current = true;
            const blob = new Blob(chunksRef.current);
            setState(prev => ({
              ...prev,
              status: 'done',
              progress: 100,
              blob,
            }));
            const socket = getSocket();
            socket.emit('file_transfer_complete', { target: peerName, fileName: state.fileName, fileSize: state.fileSize });
          }
        } catch {}
      } else if (evt.data instanceof ArrayBuffer) {
        chunksRef.current.push(evt.data);
        receivedChunksRef.current++;
        const pct = totalChunksRef.current > 0
          ? Math.min(Math.round((receivedChunksRef.current / totalChunksRef.current) * 100), 99)
          : 0;
        setState(prev => ({ ...prev, progress: pct }));
        pendingChunkSize = 0;
      }
    };

    dc.onerror = () => {
      setState(prev => {
        if (!transferDoneRef.current && prev.status !== 'cancelled') {
          return { ...prev, status: 'error', error: t('Ошибка канала: данные не доходят до получателя') };
        }
        return prev;
      });
    };

    dc.onclose = () => {
      setState(prev => {
        if (!transferDoneRef.current && prev.status !== 'cancelled') {
          return { ...prev, status: 'error', error: t('Соединение прервано: собеседник отключился') };
        }
        return prev;
      });
    };
  }, [state.fileName, state.fileSize]);

  const initiateSend = useCallback(async (file: File, peer: string) => {
    cleanup();
    peerRef.current = peer;
    setState({
      direction: 'send',
      status: 'offer',
      fileName: file.name,
      fileSize: file.size,
      progress: 0,
      peer,
    });

    const pc = createPC();
    const dc = pc.createDataChannel('file-transfer');
    dcRef.current = dc;

    const SEND_BUF_LIMIT = 512 * 1024;
    dc.bufferedAmountLowThreshold = SEND_BUF_LIMIT;

    const drainBuffer = (): Promise<void> => {
      if (dc.bufferedAmount < SEND_BUF_LIMIT) return Promise.resolve();
      return new Promise(resolve => {
        const onDrain = () => { resolve(); };
        dc.addEventListener('bufferedamountlow', onDrain, { once: true });
      });
    };

    dc.onopen = async () => {
      setState(prev => ({ ...prev, status: 'transferring', progress: 0 }));
      try {
        const buffer = await file.arrayBuffer();
        const totalChunks = Math.ceil(buffer.byteLength / CHUNK_SIZE);
        totalChunksRef.current = totalChunks;

        dc.send(JSON.stringify({ type: 'metadata', fileName: file.name, fileSize: file.size, totalChunks }));

        for (let i = 0; i < totalChunks; i++) {
          if (dc.readyState !== 'open') break;
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, buffer.byteLength);
          const chunk = buffer.slice(start, end);

          dc.send(JSON.stringify({ type: 'chunk', index: i, size: chunk.byteLength }));
          dc.send(chunk);
          await drainBuffer();

          const pct = Math.round(((i + 1) / totalChunks) * 100);
          setState(prev => ({ ...prev, progress: pct }));
        }

        if (dc.readyState === 'open') {
          transferDoneRef.current = true;
          dc.send(JSON.stringify({ type: 'complete' }));
          setState(prev => ({ ...prev, status: 'done', progress: 100 }));

          const socket = getSocket();
          socket.emit('file_transfer_complete', { target: peer, fileName: file.name, fileSize: file.size });
        }
      } catch (e) {
        setState(prev => ({ ...prev, status: 'error', error: errMsg(e, t('Ошибка при отправке файла'), t) }));
      }
    };

    dc.onerror = () => {
      setState(prev => {
        if (!transferDoneRef.current && prev.status !== 'cancelled') {
          return { ...prev, status: 'error', error: t('Ошибка канала: данные не доходят до получателя') };
        }
        return prev;
      });
    };

    dc.onclose = () => {
      setState(prev => {
        if (!transferDoneRef.current && prev.status !== 'cancelled') {
          return { ...prev, status: 'error', error: t('Соединение прервано: собеседник отключился') };
        }
        return prev;
      });
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const socket = getSocket();
      socket.emit('file_offer', { target: peer, fileName: file.name, fileSize: file.size, sdp: pc.localDescription });
    } catch (e) {
       setState(prev => ({ ...prev, status: 'error', error: errMsg(e, t('Не удалось создать WebRTC-соединение'), t) }));
    }
  }, [cleanup, createPC]);

  const handleIncomingOffer = useCallback((data: { sender: string; fileName: string; fileSize: number; sdp: RTCSessionDescriptionInit }) => {
    if (pendingOfferSdpRef.current || pcRef.current) {
      const socket = getSocket();
      socket.emit('file_cancel', { target: data.sender, reason: 'busy' });
      return;
    }
    cleanup();
    peerRef.current = data.sender;
    pendingOfferSdpRef.current = data.sdp;
    setState({
      direction: 'receive',
      status: 'incoming',
      fileName: data.fileName,
      fileSize: data.fileSize,
      progress: 0,
      peer: data.sender,
    });
    if (declineTimerRef.current) clearTimeout(declineTimerRef.current);
    declineTimerRef.current = setTimeout(() => {
      if (pendingOfferSdpRef.current) {
        const peer = peerRef.current;
        pendingOfferSdpRef.current = null;
        cleanup();
        setState(prev => ({ ...prev, status: 'cancelled', error: t('Время ожидания истекло') }));
        if (peer) {
          const socket = getSocket();
          socket.emit('file_cancel', { target: peer });
        }
      }
    }, 30000);
  }, [cleanup]);

  const acceptIncomingOffer = useCallback(async () => {
    const sdp = pendingOfferSdpRef.current;
    const peer = peerRef.current;
    if (!sdp || !peer) return;
    pendingOfferSdpRef.current = null;
    if (declineTimerRef.current) { clearTimeout(declineTimerRef.current); declineTimerRef.current = undefined; }

    setState(prev => ({ ...prev, status: 'connecting' }));
    const pc = createPC();

    pc.ondatachannel = (e) => {
      setupDcHandlers(e.channel, peer);
    };

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      flushCandidates();
      const socket = getSocket();
      socket.emit('file_answer', { target: peer, sdp: pc.localDescription });
    } catch (e) {
      setState(prev => ({ ...prev, status: 'error', error: errMsg(e, t('Не удалось принять входящее соединение'), t) }));
    }
  }, [createPC, flushCandidates, setupDcHandlers]);

  const handleAnswer = useCallback((data: { sdp: RTCSessionDescriptionInit }) => {
    if (!pcRef.current || !peerRef.current) return;
    const pc = pcRef.current;
    pc.setRemoteDescription(new RTCSessionDescription(data.sdp))
      .then(() => flushCandidates())
      .catch(() => {
        setState(prev => ({ ...prev, status: 'error', error: t('Не удалось установить соединение') }));
        cleanup();
      });
  }, [flushCandidates, cleanup]);

  const handleIceCandidate = useCallback((data: { sender: string; candidate: RTCIceCandidateInit }) => {
    if (!pcRef.current || !peerRef.current) return;
    if (data.sender.toLowerCase() !== peerRef.current.toLowerCase()) return;
    const candidate = new RTCIceCandidate(data.candidate);
    if (pcRef.current.remoteDescription && pcRef.current.remoteDescription.type) {
      pcRef.current.addIceCandidate(candidate).catch(() => {});
    } else {
      pendingCandidatesRef.current.push(data.candidate);
    }
  }, [cleanup]);

  const handleCancel = useCallback((reason?: string) => {
    pendingOfferSdpRef.current = null;
    if (declineTimerRef.current) { clearTimeout(declineTimerRef.current); declineTimerRef.current = undefined; }
    cleanup();
    setState(prev => ({
      ...prev,
      status: 'cancelled',
      error: reason === 'busy' ? t('Собеседник занят другим обменом') : t('Передача отменена'),
    }));
  }, [cleanup]);

  const cancel = useCallback(() => {
    handleCancel();
  }, [handleCancel]);

  const decline = useCallback(() => {
    handleCancel('declined');
  }, [handleCancel]);

  const download = useCallback(() => {
    if (!state.blob) return;
    const url = URL.createObjectURL(state.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = state.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [state.blob, state.fileName]);

  const reset = useCallback(() => {
    pendingOfferSdpRef.current = null;
    if (declineTimerRef.current) { clearTimeout(declineTimerRef.current); declineTimerRef.current = undefined; }
    cleanup();
    setState({
      direction: null,
      status: 'idle',
      fileName: '',
      fileSize: 0,
      progress: 0,
    });
  }, [cleanup]);

  return {
    state,
    initiateSend,
    handleIncomingOffer,
    acceptIncomingOffer,
    handleAnswer,
    handleIceCandidate,
    handleCancel,
    cancel,
    decline,
    download,
    reset,
  };
}
