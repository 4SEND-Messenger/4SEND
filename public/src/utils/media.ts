import type { Message } from '../types/message';
import { translate } from '../hooks/useI18n';

export const getFileExt = (fileName?: string, fileUrl?: string): string => {
  const source = fileName || fileUrl || '';
  const match = source.match(/\.([^.?#]+)(?:[?#]|$)/i);
  return match && match[1] ? match[1].toLowerCase() : '';
};

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'tiff', 'tif', 'heic', 'heif'];
const BROWSER_IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico'];

export const isImageFile = (fileName?: string, fileUrl?: string): boolean => {
  const ext = getFileExt(fileName, fileUrl);
  return IMAGE_EXTS.includes(ext);
};

export const isBrowserImage = (fileName?: string, fileUrl?: string): boolean => {
  const ext = getFileExt(fileName, fileUrl);
  return BROWSER_IMAGE_EXTS.includes(ext);
};

const VIDEO_EXTS = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'wmv', 'flv', 'm4v'];

export const isVideoFile = (fileName?: string, fileUrl?: string): boolean => {
  const ext = getFileExt(fileName, fileUrl);
  return VIDEO_EXTS.includes(ext);
};

const AUDIO_EXTS = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'opus'];

export const isAudioExtFile = (fileName?: string, fileUrl?: string): boolean => {
  const ext = getFileExt(fileName, fileUrl);
  return AUDIO_EXTS.includes(ext);
};

export const isGifFile = (text?: string, ext?: string): boolean => {
  if (text === 'GIF') return true;
  if (ext && ext.toLowerCase() === 'gif') return true;
  return false;
};

export const cloudifyDisplay = (url: string, width: number): string => {
  if (url.includes('res.cloudinary.com') && url.includes('/upload/')) {
    return url.replace('/upload/', `/upload/q_auto,f_auto,w_${width},c_limit/`);
  }
  return url;
};

export const cloudifyLightbox = (url: string): string =>
  cloudifyDisplay(url, 1920);

export const hexToRgb = (hex: string): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
};

const FILE_TYPE_COLORS: Record<string, string> = {
  jpg: '#ff4081', jpeg: '#ff4081', png: '#ff4081', gif: '#ff4081', webp: '#ff4081',
  bmp: '#ff4081', svg: '#ff4081', ico: '#ff4081', tiff: '#ff4081', tif: '#ff4081',
  heic: '#ff4081', heif: '#ff4081',
  mp4: '#a74fff', webm: '#a74fff', mov: '#a74fff', avi: '#a74fff', mkv: '#a74fff',
  wmv: '#a74fff', flv: '#a74fff', m4v: '#a74fff',
  mp3: '#26a69a', wav: '#26a69a', ogg: '#26a69a', m4a: '#26a69a', flac: '#26a69a',
  opus: '#26a69a',
  zip: '#ff9500', rar: '#ff9500', '7z': '#ff9500', tar: '#ff9500', gz: '#ff9500',
  bz2: '#ff9500', xz: '#ff9500',
  pdf: '#4a9eff', doc: '#4a9eff', docx: '#4a9eff', xls: '#4a9eff', xlsx: '#4a9eff',
  ppt: '#4a9eff', pptx: '#4a9eff', txt: '#4a9eff', csv: '#4a9eff', rtf: '#4a9eff',
  odt: '#4a9eff', ods: '#4a9eff', odp: '#4a9eff',
  json: '#7c4dff', xml: '#7c4dff', yaml: '#7c4dff', yml: '#7c4dff', toml: '#7c4dff',
  ini: '#7c4dff', cfg: '#7c4dff', conf: '#7c4dff', log: '#7c4dff',
  js: '#7c4dff', ts: '#7c4dff', jsx: '#7c4dff', tsx: '#7c4dff', py: '#7c4dff',
  rb: '#7c4dff', go: '#7c4dff', rs: '#7c4dff', java: '#7c4dff', dart: '#7c4dff',
  cpp: '#7c4dff', c: '#7c4dff', h: '#7c4dff', hpp: '#7c4dff',
  css: '#7c4dff', scss: '#7c4dff', less: '#7c4dff', html: '#7c4dff', php: '#7c4dff',
  sh: '#7c4dff', bat: '#7c4dff', ps1: '#7c4dff', sql: '#7c4dff',
  exe: '#ff5252', apk: '#ff5252', dmg: '#ff5252', msi: '#ff5252', iso: '#ff5252',
  img: '#ff5252',
  ttf: '#7c4dff', otf: '#7c4dff', woff: '#7c4dff', woff2: '#7c4dff', eot: '#7c4dff',
  epub: '#ffab00', mobi: '#ffab00', fb2: '#ffab00',
  psd: '#ff7043', ai: '#ff7043', eps: '#ff7043',
  fbx: '#009688', obj: '#009688', stl: '#009688', '3ds': '#009688',
  glb: '#009688', gltf: '#009688', blend: '#009688',
  sqlite: '#8d6e63', db: '#8d6e63',
  torrent: '#4caf50',
};

export const getFileTypeColor = (ext: string): string =>
  FILE_TYPE_COLORS[ext.toLowerCase()] || '#a74fff';

export const getSafeFileName = (d: { fileName?: string; fileUrl?: string; text?: string }): string => {
  if (d.fileName) return d.fileName;
  if (d.fileUrl && d.fileUrl !== 'dummy') {
    const fromUrl = d.fileUrl.split('/').pop()?.split('?')[0];
    if (fromUrl) return decodeURIComponent(fromUrl);
  }
  return d.text || translate('📁 Файл');
};

const TEXT_LABELS_AUDIO = ['🎤 Голосовое сообщение', 'Голосовое сообщение', '🎤 Voice message', 'Voice message'];
const TEXT_LABELS_VIDEONOTE = ['📹 Видеосообщение', 'Видосообщение', 'Видеосообщение', '📹 Video message', 'Video message'];

export interface MediaContext {
  fileUrl?: string;
  fileUrls?: string[];
  fileName?: string;
  isAudio?: boolean;
  isVideoNote?: boolean;
  isMusic?: boolean;
  text?: string;
}

export const shouldShowText = (d: MediaContext): boolean => {
  const text = (d.text || '').trim();
  if (text === '') return false;

  const fileUrl = d.fileUrl;

  if (fileUrl && fileUrl !== 'dummy') {
    const ext = getFileExt(d.fileName, fileUrl);

    if (d.isAudio && TEXT_LABELS_AUDIO.includes(text)) return false;
    if (d.isVideoNote && TEXT_LABELS_VIDEONOTE.includes(text)) return false;
    if (d.fileName && text === d.fileName) return false;

    const urlFileName = fileUrl.split('/').pop()?.split('?')[0] || '';
    if (text === urlFileName || text === decodeURIComponent(urlFileName)) return false;
    if (text === 'GIF' || text === 'Стикер') return false;
    if ((isImageFile(d.fileName, fileUrl) || isVideoFile(d.fileName, fileUrl)) &&
        text.match(/\.(jpeg|jpg|png|gif|webp|bmp|svg|ico|tiff|tif|heic|heif|mp4|mov|webm|avi|mkv|wmv|flv|m4v)$/i)) {
      return false;
    }
  } else if (fileUrl === 'dummy') {
    if (d.isAudio && TEXT_LABELS_AUDIO.includes(text)) return false;
    if (d.isVideoNote && TEXT_LABELS_VIDEONOTE.includes(text)) return false;
    if (d.fileName && text === d.fileName) return false;
    if (text === 'GIF' || text === 'Стикер') return false;
  }

  return true;
};

export const computeMediaFlags = (d: MediaContext): {
  isImage: boolean;
  isVideo: boolean;
  isAudioExt: boolean;
  isMediaOnly: boolean;
  showText: boolean;
  ext: string;
} => {
  let isImage = false;
  let isVideo = false;
  let isAudioExt = false;
  let ext = '';

  if (d.fileUrl && d.fileUrl !== 'dummy') {
    ext = getFileExt(d.fileName, d.fileUrl);
    isImage = isBrowserImage(d.fileName, d.fileUrl);
    isVideo = isVideoFile(d.fileName, d.fileUrl);
    isAudioExt = isAudioExtFile(d.fileName, d.fileUrl);
  }

  const showText = shouldShowText(d);
  const isMediaOnly = (isImage || isVideo || isAudioExt || (!!d.fileUrls && d.fileUrls.length > 1)) && !showText;

  return { isImage, isVideo, isAudioExt, isMediaOnly, showText, ext };
};

export const preloadImages = (messages: Message[]): Promise<void> => {
  const urls: string[] = [];
  for (const m of messages) {
    if (m.fileUrl && m.fileUrl !== 'dummy' && isImageFile(m.fileName, m.fileUrl)) {
      urls.push(cloudifyDisplay(m.fileUrl, 800));
    }
    if (m.fileUrls) {
      for (const u of m.fileUrls) {
        if (isImageFile(m.fileName, u)) {
          urls.push(cloudifyDisplay(u, 600));
        }
      }
    }
  }
  if (urls.length === 0) return Promise.resolve();
  return Promise.race([
    Promise.all(urls.map(url => new Promise<void>(resolve => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = url;
    }))),
    new Promise<void>(resolve => setTimeout(resolve, 1500)),
  ]).then(() => {});
};

export const getContentPaddingBottom = (d: MediaContext, isMediaOnly: boolean): string => {
  if (isMediaOnly) return '0px';
  if (d.fileUrl || (d.fileUrls && d.fileUrls.length > 0)) return '20px';
  return '14px';
};

export type { Message };
