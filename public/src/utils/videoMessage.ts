export interface VideoMessageSettings {
  camera: 'user' | 'environment';
  quality: number;
  codec: 'mp4' | 'webm';
  bitrate: number;
  shutterSound: boolean;
  maxDuration: number;
  gridOverlay: boolean;
}

export const VIDEO_QUALITIES = [720, 480, 360];
export const VIDEO_BITRATES = [1500000, 2500000, 4000000];
export const VIDEO_MAX_DURATIONS = [0, 15, 30, 60];

export const getVideoMessageSettings = (): VideoMessageSettings => {
  const camera = localStorage.getItem('4send_videoMsg_camera') === 'environment' ? 'environment' : 'user';
  const q = parseInt(localStorage.getItem('4send_videoMsg_quality') || '', 10);
  const quality = VIDEO_QUALITIES.includes(q) ? q : 720;
  const codec = localStorage.getItem('4send_videoMsg_codec') === 'webm' ? 'webm' : 'mp4';
  const b = parseInt(localStorage.getItem('4send_videoMsg_bitrate') || '', 10);
  const bitrate = VIDEO_BITRATES.includes(b) ? b : 1500000;
  const shutterRaw = localStorage.getItem('4send_videoMsg_shutter');
  const shutterSound = shutterRaw === null || (shutterRaw !== '0' && shutterRaw !== 'false');
  const d = parseInt(localStorage.getItem('4send_videoMsg_maxDuration') || '', 10);
  const maxDuration = VIDEO_MAX_DURATIONS.includes(d) ? d : 0;
  const gridRaw = localStorage.getItem('4send_videoMsg_grid');
  const gridOverlay = gridRaw === '1' || gridRaw === 'true';
  return { camera, quality, codec, bitrate, shutterSound, maxDuration, gridOverlay };
};

const STORAGE_KEYS: Record<keyof VideoMessageSettings, string> = {
  camera: '4send_videoMsg_camera',
  quality: '4send_videoMsg_quality',
  codec: '4send_videoMsg_codec',
  bitrate: '4send_videoMsg_bitrate',
  shutterSound: '4send_videoMsg_shutter',
  maxDuration: '4send_videoMsg_maxDuration',
  gridOverlay: '4send_videoMsg_grid'
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
