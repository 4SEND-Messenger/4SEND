export interface VideoMessageSettings {
  camera: 'user' | 'environment';
  quality: number;
  codec: 'mp4' | 'webm';
  bitrate: number;
}

export const VIDEO_QUALITIES = [720, 480, 360];
export const VIDEO_BITRATES = [1500000, 2500000, 4000000];

export const getVideoMessageSettings = (): VideoMessageSettings => {
  const camera = localStorage.getItem('4send_videoMsg_camera') === 'environment' ? 'environment' : 'user';
  const q = parseInt(localStorage.getItem('4send_videoMsg_quality') || '', 10);
  const quality = VIDEO_QUALITIES.includes(q) ? q : 720;
  const codec = localStorage.getItem('4send_videoMsg_codec') === 'webm' ? 'webm' : 'mp4';
  const b = parseInt(localStorage.getItem('4send_videoMsg_bitrate') || '', 10);
  const bitrate = VIDEO_BITRATES.includes(b) ? b : 1500000;
  return { camera, quality, codec, bitrate };
};

const STORAGE_KEYS: Record<keyof VideoMessageSettings, string> = {
  camera: '4send_videoMsg_camera',
  quality: '4send_videoMsg_quality',
  codec: '4send_videoMsg_codec',
  bitrate: '4send_videoMsg_bitrate'
};

export const setVideoMessageSetting = <K extends keyof VideoMessageSettings>(key: K, value: VideoMessageSettings[K]): void => {
  localStorage.setItem(STORAGE_KEYS[key], String(value));
};

export const pickVideoMessageMime = (codec: 'mp4' | 'webm'): string => {
  const supportsMp4 = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/mp4');
  const supportsWebm = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/webm');
  if (codec === 'mp4') return supportsMp4 ? 'video/mp4' : (supportsWebm ? 'video/webm' : 'video/mp4');
  return supportsWebm ? 'video/webm' : (supportsMp4 ? 'video/mp4' : 'video/webm');
};
