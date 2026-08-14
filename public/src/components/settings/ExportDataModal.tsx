import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import ModalShell from './ModalShell';
import { useI18n, translate } from '../../hooks/useI18n';
import { useAuthContext } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { getCachedMessages } from '../../utils/db';
import type { Message } from '../../types/message';
import styles from './ExportDataModal.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type Format = 'html' | 'json' | 'both';
type MediaCategory = 'photo' | 'video' | 'voice' | 'videoNote' | 'music' | 'sticker' | 'gif';

interface ExportedFile {
  id: string;
  sender: string;
  timestamp: string | undefined;
  mediaType: MediaCategory;
  fileName: string | null;
  base64: string | null;
  mimeType: string;
}

interface ExportedMessage {
  id: string;
  text: string;
  sender: string;
  timestamp: string | undefined;
  fileUrl: string | null;
  fileName: string | null;
  mediaType?: MediaCategory | null;
}

interface ExportedChat {
  username: string;
  displayName: string;
  isRoom: boolean;
  roomType: string | null;
  messageCount: number;
  messages: ExportedMessage[];
  files: ExportedFile[];
}

interface ExportData {
  account: { username: string | null; displayName: string | null };
  exportedAt: string;
  chats: ExportedChat[];
}

const AVATAR_COLORS = [
  'linear-gradient(135deg,#667eea,#764ba2)',
  'linear-gradient(135deg,#f093fb,#f5576c)',
  'linear-gradient(135deg,#4facfe,#00f2fe)',
  'linear-gradient(135deg,#a18cd1,#fbc2eb)',
  'linear-gradient(135deg,#ffecd2,#fcb69f)',
  'linear-gradient(135deg,#43e97b,#38f9d7)',
  'linear-gradient(135deg,#fa709a,#fee140)',
  'linear-gradient(135deg,#a74fff,#8b3dff)',
];

function getAvatarColor(username: string) {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getMediaCategory(msg: Message): MediaCategory | null {
  if (!msg.fileUrl && (!msg.fileUrls || msg.fileUrls.length === 0)) return null;
  if (msg.isAudio) return 'voice';
  if (msg.isMusic) return 'music';
  if (msg.isVideoNote) return 'videoNote';
  const name = msg.fileName || msg.fileUrl || '';
  const ext = name.split('.').pop()?.toLowerCase().split('?')[0] || '';
  if (['jpg','jpeg','png','webp','bmp','heic','heif','svg','avif'].includes(ext)) return 'photo';
  if (ext === 'gif') return 'gif';
  if (['mp4','webm','mov','avi','mkv','m4v'].includes(ext)) return 'video';
  if (['tgs','webp'].includes(ext) && name.toLowerCase().includes('sticker')) return 'sticker';
  return 'file' as MediaCategory;
}

function isMediaSelected(cat: MediaCategory | null, state: {
  exportPhotos: boolean; exportVideos: boolean; exportVoice: boolean;
  exportVideoNotes: boolean; exportStickers: boolean; exportGifs: boolean;
}): boolean {
  if (!cat) return false;
  switch (cat) {
    case 'photo': return state.exportPhotos;
    case 'video': return state.exportVideos;
    case 'voice': return state.exportVoice;
    case 'videoNote': return state.exportVideoNotes;
    case 'sticker': return state.exportStickers;
    case 'gif': return state.exportGifs;
    default: return false;
  }
}

async function fetchAsBase64(url: string, signal?: AbortSignal): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const res = await fetch(url, { mode: 'cors', signal });
    if (!res.ok) throw new Error('Direct fetch failed');
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve({ base64, mimeType: blob.type || 'application/octet-stream' });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    try {
      const proxyUrl = `/api/proxy-download?url=${encodeURIComponent(url)}`;
      const token = localStorage.getItem('4send_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(proxyUrl, { headers, signal });
      if (!res.ok) throw new Error('Proxy failed');
      const blob = await res.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          resolve({ base64, mimeType: blob.type || 'application/octet-stream' });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }
}

function mimeFromExt(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
    gif: 'image/gif', bmp: 'image/bmp', svg: 'image/svg+xml',
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
    mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4',
    tgs: 'application/json',
  };
  return map[ext] || 'application/octet-stream';
}

export default function ExportDataModal({ isOpen, onClose }: Props) {
  const { t } = useI18n();
  const { me, displayName } = useAuthContext();
  const { contacts } = useChat();

  const [selectedChats, setSelectedChats] = useState<Set<string>>(new Set());
  const [exportPrivate, setExportPrivate] = useState(true);
  const [exportPrivateGroups, setExportPrivateGroups] = useState(true);
  const [exportChannels, setExportChannels] = useState(true);
  const [exportPhotos, setExportPhotos] = useState(true);
  const [exportVideos, setExportVideos] = useState(true);
  const [exportVoice, setExportVoice] = useState(true);
  const [exportVideoNotes, setExportVideoNotes] = useState(true);
  const [exportStickers, setExportStickers] = useState(false);
  const [exportGifs, setExportGifs] = useState(false);
  const [format, setFormat] = useState<Format>('html');
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportPhase, setExportPhase] = useState<'idle' | 'messages' | 'media' | 'building'>('idle');
  const [fileProgress, setFileProgress] = useState({ current: 0, total: 0 });
  const abortRef = useRef<AbortController | null>(null);

  const filteredContacts = useMemo(() => {
    return contacts.filter(c => {
      const lower = c.username.toLowerCase();
      if (lower === me?.toLowerCase()) return false;
      if (c.isRoom) {
        if (c.roomType === 'channel') {
          return exportChannels;
        }
        return exportPrivateGroups;
      }
      return exportPrivate;
    });
  }, [contacts, me, exportPrivate, exportPrivateGroups, exportChannels]);

  const toggleChat = useCallback((username: string) => {
    setSelectedChats(prev => {
      const next = new Set(prev);
      if (next.has(username)) {
        next.delete(username);
      } else {
        next.add(username);
      }
      return next;
    });
  }, []);

  const selectAllFiltered = useCallback(() => {
    setSelectedChats(new Set(filteredContacts.map(c => c.username)));
  }, [filteredContacts]);

  const deselectAll = useCallback(() => {
    setSelectedChats(new Set());
  }, []);

  const mediaState = { exportPhotos, exportVideos, exportVoice, exportVideoNotes, exportStickers, exportGifs };

  const estimateSize = useCallback(async () => {
    const chatsToCheck = contacts.filter(c => selectedChats.has(c.username));
    let totalFiles = 0;
    let totalMessages = 0;
    const counts: Record<string, number> = {};
    for (const chat of chatsToCheck) {
      const cached = await getCachedMessages(chat.username.toLowerCase());
      const messages = cached || [];
      totalMessages += messages.length;
      for (const msg of messages) {
        const mcat = getMediaCategory(msg);
        if (mcat && isMediaSelected(mcat, mediaState)) {
          totalFiles++;
          counts[mcat] = (counts[mcat] || 0) + 1;
        }
      }
    }
    const avgSizes: Record<string, number> = {
      photo: 0.3, video: 8, voice: 0.08, videoNote: 2,
      music: 5, sticker: 0.05, gif: 1.5, file: 0.5,
    };
    let totalMb = 0;
    for (const [type, count] of Object.entries(counts)) {
      totalMb += count * (avgSizes[type] || 0.5);
    }
    return { totalFiles, totalMessages, totalMb };
  }, [contacts, selectedChats, mediaState]);

  const [sizeEstimate, setSizeEstimate] = useState<{ totalFiles: number; totalMessages: number; totalMb: number } | null>(null);

  useEffect(() => {
    if (selectedChats.size === 0) { setSizeEstimate(null); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const est = await estimateSize();
      if (!cancelled) setSizeEstimate(est);
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [estimateSize, selectedChats.size]);

  const handleExport = useCallback(async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    setExporting(true);
    setExportProgress(0);
    setFileProgress({ current: 0, total: 0 });
    setExportPhase('messages');
    try {
      const chatsToExport = contacts.filter(c => selectedChats.has(c.username));
      const exportData: ExportData = {
        account: { username: me, displayName: displayName || me },
        exportedAt: new Date().toISOString(),
        chats: [],
      };

      let totalMediaFiles = 0;
      for (const chat of chatsToExport) {
        if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        const cached = await getCachedMessages(chat.username.toLowerCase());
        const messages = cached || [];
        for (const msg of messages) {
          const mcat = getMediaCategory(msg);
          if (msg.fileUrl && mcat && isMediaSelected(mcat, mediaState)) {
            totalMediaFiles++;
          }
        }
      }

      setFileProgress({ current: 0, total: totalMediaFiles });
      setExportPhase('media');

      let filesProcessed = 0;
      for (let ci = 0; ci < chatsToExport.length; ci++) {
        if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        const chat = chatsToExport[ci];
        setExportProgress(Math.round((ci / chatsToExport.length) * 100));
        const cached = await getCachedMessages(chat.username.toLowerCase());
        const messages = cached || [];
        const exportedMessages: ExportedMessage[] = [];
        const exportedFiles: ExportedFile[] = [];

        for (const msg of messages) {
          if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
          const mcat = getMediaCategory(msg);
          exportedMessages.push({
            id: msg.id,
            text: msg.text || '',
            sender: msg.sender,
            timestamp: msg.timestamp ? String(msg.timestamp) : undefined,
            fileUrl: msg.fileUrl || null,
            fileName: msg.fileName || null,
            mediaType: mcat,
          });

          if (msg.fileUrl && mcat && isMediaSelected(mcat, mediaState)) {
            filesProcessed++;
            setFileProgress({ current: filesProcessed, total: totalMediaFiles });
            setExportProgress(Math.round((filesProcessed / totalMediaFiles) * 100));
            const controllerSignal = controller.signal;
            const result = await fetchAsBase64(msg.fileUrl, controllerSignal);
            exportedFiles.push({
              id: msg.id,
              sender: msg.sender,
              timestamp: msg.timestamp ? String(msg.timestamp) : undefined,
              mediaType: mcat,
              fileName: msg.fileName || null,
              base64: result?.base64 || null,
              mimeType: result?.mimeType || (msg.fileName ? mimeFromExt(msg.fileName) : 'application/octet-stream'),
            });
          }
        }

        exportData.chats.push({
          username: chat.username,
          displayName: chat.displayName || chat.username,
          isRoom: chat.isRoom || false,
          roomType: chat.roomType || null,
          messageCount: messages.length,
          messages: exportedMessages,
          files: exportedFiles,
        });
      }

      setExportPhase('building');
      setExportProgress(100);
      const jsonStr = JSON.stringify(exportData, null, 2);

      if (format === 'html' || format === 'both') {
        const html = generateHtml(exportData);
        downloadFile(html, `4send-export-${me || 'data'}.html`, 'text/html;charset=utf-8');
      }
      if (format === 'json' || format === 'both') {
        downloadFile(jsonStr, `4send-export-${me || 'data'}.json`, 'application/json;charset=utf-8');
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setExportPhase('idle');
      } else {
        console.error('Export failed:', err);
      }
    } finally {
      setExporting(false);
      setExportProgress(0);
      setExportPhase('idle');
      setFileProgress({ current: 0, total: 0 });
      abortRef.current = null;
    }
  }, [contacts, selectedChats, me, displayName, format, mediaState]);

  const cancelExport = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  function downloadFile(content: string, filename: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function ChatTypeIcon({ chat }: { chat: typeof contacts[0] }) {
    if (chat.isRoom) {
      if (chat.roomType === 'channel') {
        return (
          <svg viewBox="0 0 16 16" width={12} height={12} fill="currentColor">
            <path d="M3 13.5a.5.5 0 0 1-.5-.5V3.707L.354 5.854a.5.5 0 1 1-.708-.708l2-2a.5.5 0 0 1 .708 0l2 2a.5.5 0 1 1-.708.708L3.5 3.707V13a.5.5 0 0 1-.5.5z"/>
            <path d="M6 13.5a.5.5 0 0 1-.5-.5V5.207l-1.146 1.147a.5.5 0 0 1-.708-.708l2-2a.5.5 0 0 1 .708 0l2 2a.5.5 0 1 1-.708.708L6.5 5.207V13a.5.5 0 0 1-.5.5z"/>
            <path d="M9 13.5a.5.5 0 0 1-.5-.5V8.707L7.354 9.854a.5.5 0 1 1-.708-.708l2-2a.5.5 0 0 1 .708 0l2 2a.5.5 0 1 1-.708.708L9.5 8.707V13a.5.5 0 0 1-.5.5z"/>
            <path d="M12 13.5a.5.5 0 0 1-.5-.5v-3.793l-1.146 1.147a.5.5 0 0 1-.708-.708l2-2a.5.5 0 0 1 .708 0l2 2a.5.5 0 1 1-.708.708L12.5 9.207V13a.5.5 0 0 1-.5.5z"/>
            <path d="M15 13.5a.5.5 0 0 1-.5-.5v-5.293l-1.146 1.147a.5.5 0 0 1-.708-.708l2-2a.5.5 0 0 1 .708 0l2 2a.5.5 0 1 1-.708.708L15.5 7.707V13a.5.5 0 0 1-.5.5z"/>
          </svg>
        );
      }
      return (
        <svg viewBox="0 0 16 16" width={12} height={12} fill="currentColor">
          <path d="M5.5 3.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM10.5 3.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
          <path d="M8 10c-2.5 0-3.5.5-3.5 1.5V13h7v-1.5c0-1-1-1.5-3.5-1.5z"/>
        </svg>
      );
    }
    return (
      <svg viewBox="0 0 16 16" width={12} height={12} fill="currentColor">
        <path d="M2.5 2A1.5 1.5 0 0 0 1 3.5v6A1.5 1.5 0 0 0 2.5 11H4v2.5a.5.5 0 0 0 .854.354L7.207 11h6.293A1.5 1.5 0 0 0 15 9.5v-6A1.5 1.5 0 0 0 13.5 2h-11z"/>
      </svg>
    );
  }

  function Checkbox({ checked }: { checked: boolean }) {
    return (
      <div className={`${styles.checkbox} ${checked ? styles.checkboxChecked : ''}`}>
        {checked && (
          <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
    );
  }

  function CheckRow({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
    return (
      <div className={styles.rowCheck} onClick={onToggle}>
        <Checkbox checked={checked} />
        <span>{label}</span>
      </div>
    );
  }

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title={t('Экспорт данных')} maxWidth="400px">
      <div className={styles.wrapper}>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>{t('Информация об аккаунте')}</div>
          <div className={styles.card}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>{t('Имя')}</span>
              <span className={styles.infoValue}>{displayName || me || '—'}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>{t('Имя пользователя')}</span>
              <span className={styles.infoValue}>@{me || '—'}</span>
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            {t('Список чатов')}
            <span style={{ color: '#555', fontWeight: 400, marginLeft: 6, fontSize: 10 }}>
              ({selectedChats.size} {t('из')} {contacts.length})
            </span>
          </div>
          <div className={styles.card}>
            <div className={styles.chatListContainer}>
              {filteredContacts.map(c => (
                <div key={c.username} className={styles.chatItem} onClick={() => toggleChat(c.username)}>
                  <div onClick={e => { e.stopPropagation(); toggleChat(c.username); }}>
                    <Checkbox checked={selectedChats.has(c.username)} />
                  </div>
                  <div className={styles.chatAvatar} style={{ background: getAvatarColor(c.username) }}>
                    {(c.displayName || c.username)[0].toUpperCase()}
                  </div>
                  <span className={styles.chatName}>{c.displayName || c.username}</span>
                  <span className={styles.chatType}><ChatTypeIcon chat={c} /></span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                style={{ flex: 1, padding: '6px', borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.04)', color: '#888', fontSize: 11, cursor: 'pointer' }}
                onClick={selectAllFiltered}
              >
                {t('Выбрать все')}
              </button>
              <button
                style={{ flex: 1, padding: '6px', borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.04)', color: '#888', fontSize: 11, cursor: 'pointer' }}
                onClick={deselectAll}
              >
                {t('Сбросить')}
              </button>
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>{t('Настройки экспорта')}</div>
          <div className={styles.card}>
            <div className={styles.sectionTitle} style={{ fontSize: 10, color: '#666', marginBottom: 6 }}>
              {t('Типы чатов')}
            </div>
            <div className={styles.checkboxRows}>
              <CheckRow checked={exportPrivate} onToggle={() => setExportPrivate(v => !v)} label={t('Личные чаты')} />
              <CheckRow checked={exportPrivateGroups} onToggle={() => setExportPrivateGroups(v => !v)} label={t('Частные группы')} />
              <CheckRow checked={exportChannels} onToggle={() => setExportChannels(v => !v)} label={t('Каналы')} />
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>{t('Экспорт вложений')}</div>
          <div className={styles.card}>
            <div className={styles.checkboxRows}>
              <CheckRow checked={exportPhotos} onToggle={() => setExportPhotos(v => !v)} label={t('Фотографии')} />
              <CheckRow checked={exportVideos} onToggle={() => setExportVideos(v => !v)} label={t('Видеозаписи')} />
              <CheckRow checked={exportVoice} onToggle={() => setExportVoice(v => !v)} label={t('Голосовые сообщения')} />
              <CheckRow checked={exportVideoNotes} onToggle={() => setExportVideoNotes(v => !v)} label={t('Видеосообщения')} />
              <CheckRow checked={exportStickers} onToggle={() => setExportStickers(v => !v)} label={t('Стикеры')} />
              <CheckRow checked={exportGifs} onToggle={() => setExportGifs(v => !v)} label={t('GIF')} />
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>{t('Формат')}</div>
          <div className={styles.formatGroup}>
            {(['html', 'json', 'both'] as Format[]).map(f => (
              <button
                key={f}
                className={`${styles.formatBtn} ${format === f ? styles.formatActive : ''}`}
                onClick={() => setFormat(f)}
              >
                {f === 'html' ? t('Читаемый HTML') : f === 'json' ? t('Машиночитаемый JSON') : t('Оба')}
              </button>
            ))}
          </div>
        </div>

        {exporting && (
          <div className={styles.progressSection}>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${exportProgress}%` }} />
            </div>
            <div className={styles.progressInfo}>
              <span className={styles.progressLabel}>
                {exportPhase === 'messages' && t('Получение сообщений...')}
                {exportPhase === 'media' && t('Загрузка файлов...')}
                {exportPhase === 'building' && t('Формирование файлов...')}
              </span>
              <span className={styles.progressCount}>
                {fileProgress.total > 0
                  ? `${fileProgress.current}/${fileProgress.total}`
                  : `${exportProgress}%`}
              </span>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={styles.exportBtn}
            onClick={handleExport}
            disabled={selectedChats.size === 0 || exporting}
          >
            {exporting ? t('Экспорт...') : t('Экспортировать')}
          </button>
          {exporting && (
            <button
              className={styles.cancelBtn}
              onClick={cancelExport}
            >
              {t('Отмена')}
            </button>
          )}
        </div>

        {!exporting && sizeEstimate && (
          <div className={styles.totalInfo}>
            ~{sizeEstimate.totalMessages} {t('сообщений')}, ~{sizeEstimate.totalFiles} {t('файлов')} &middot; ~{sizeEstimate.totalMb.toFixed(1)} MB
          </div>
        )}

        <div className={styles.totalInfo}>
          {t('Выбрано чатов')}: {selectedChats.size} &middot; {t('Всего')}: {contacts.length}
        </div>
      </div>
    </ModalShell>
  );
}

const EXPORT_MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

function generateHtml(data: ExportData): string {
  const accountUsername = data.account.username || '';

  const chatListHtml = data.chats.map(c => `
    <div class="chat-card" onclick="document.getElementById('chat-${escapeHtml(c.username)}').scrollIntoView({behavior:'smooth'})">
      <div class="chat-card-avatar">${escapeHtml((c.displayName || c.username)[0])}</div>
      <div class="chat-card-info">
        <div class="chat-card-name">${escapeHtml(c.displayName)}</div>
        <div class="chat-card-meta">@${escapeHtml(c.username)} &middot; ${c.messageCount} ${translate('сообщений')} &middot; ${c.files.length} ${translate('вложений')}</div>
      </div>
      <div class="chat-card-type">${c.isRoom ? (c.roomType === 'channel' ? translate('Канал') : translate('Группа')) : translate('Личный')}</div>
    </div>
  `).join('');

  function fmtDate(ts: string): string {
    const d = new Date(ts);
    const month = translate(EXPORT_MONTHS[d.getMonth()]);
    const year = d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '';
    return d.getDate() + ' ' + month + year;
  }
  function fmtTime(ts: string): string {
    return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }
  function isToday(ts: string): boolean {
    const d = new Date(ts);
    const n = new Date();
    return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  }
  function isOwn(sender: string): boolean {
    return sender.toLowerCase() === accountUsername.toLowerCase();
  }

  const chatDetailsHtml = data.chats.map(c => {
    const groupedByDate: Record<string, typeof c.messages> = {};
    let prevDate = '';
    for (const m of c.messages) {
      const dateKey = m.timestamp ? fmtDate(m.timestamp) : '';
      if (dateKey && dateKey !== prevDate) {
        prevDate = dateKey;
        groupedByDate[dateKey] = [];
      }
      if (dateKey) groupedByDate[dateKey].push(m);
    }

    function renderFileInMessage(f: ExportedFile): string {
      if (f.mediaType === 'photo' && f.base64) {
        return `<div class="msg-photo"><img src="data:${escapeHtml(f.mimeType)};base64,${f.base64}" alt="${escapeHtml(f.fileName || 'photo')}" loading="lazy" /></div>`;
      }
      if (f.mediaType === 'video' && f.base64) {
        return `<div class="msg-file"><span class="msg-file-icon">&#9654;</span><span>${escapeHtml(f.fileName || translate('Видео'))}</span><a href="data:${escapeHtml(f.mimeType)};base64,${f.base64}" download="${escapeHtml(f.fileName || 'video')}" class="msg-file-link">${translate('Скачать')}</a></div>`;
      }
      if (f.base64) {
        return `<div class="msg-file"><span class="msg-file-icon">${f.mediaType === 'voice' ? '&#9835;' : '&#128206;'}</span><span>${escapeHtml(f.fileName || mediaTypeLabel(f.mediaType))}</span><a href="data:${escapeHtml(f.mimeType)};base64,${f.base64}" download="${escapeHtml(f.fileName || f.mediaType)}" class="msg-file-link">${translate('Скачать')}</a></div>`;
      }
      return `<div class="msg-file msg-file-na"><span>${escapeHtml(f.fileName || mediaTypeLabel(f.mediaType))}</span><span class="msg-file-na-text">${translate('Нет данных')}</span></div>`;
    }

    const messagesHtml = c.messages.map((m, idx) => {
      const dateSep = idx === 0 || (m.timestamp && c.messages[idx - 1]?.timestamp && fmtDate(m.timestamp) !== fmtDate(c.messages[idx - 1].timestamp!))
        ? `<div class="date-sep"><span>${m.timestamp ? fmtDate(m.timestamp) : ''}</span></div>`
        : '';
      const own = m.sender ? isOwn(m.sender) : false;
      const side = own ? 'right' : 'left';
      const isGroup = c.isRoom;
      const files = c.files.filter(f => f.id === m.id);
      const mediaHtml = files.length > 0 ? files.map(f => renderFileInMessage(f)).join('') : '';
      const showSender = isGroup && !own && side === 'left';

      return `${dateSep}
        <div class="msg-row msg-${side}">
          <div class="msg-bubble ${own ? 'msg-own' : 'msg-other'}">
            ${showSender ? `<div class="msg-sender">${escapeHtml(m.sender)}</div>` : ''}
            ${m.text ? `<div class="msg-text">${escapeHtml(m.text)}</div>` : ''}
            ${mediaHtml}
            <div class="msg-time">${m.timestamp ? fmtTime(m.timestamp) : '—'}</div>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="chat-block" id="chat-${escapeHtml(c.username)}">
        <div class="chat-header">
          <div class="chat-header-avatar">${escapeHtml((c.displayName || c.username)[0])}</div>
          <div>
            <div class="chat-header-name">${escapeHtml(c.displayName)}</div>
            <div class="chat-header-username">@${escapeHtml(c.username)}</div>
          </div>
          <a href="#" class="chat-back" onclick="document.getElementById('top').scrollIntoView({behavior:'smooth'});event.preventDefault();">&#8679; ${translate('К списку')}</a>
        </div>
        <div class="messages">
          ${messagesHtml}
        </div>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>4SEND Export</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0e0e10; color: #eee; padding: 0; }
  .container { max-width: 720px; margin: 0 auto; padding: 20px; }
  h1 { color: #a74fff; font-size: 24px; margin-bottom: 4px; }
  .meta { color: #666; font-size: 12px; margin-bottom: 20px; }
  h2 { color: #ccc; font-size: 16px; font-weight: 600; margin: 20px 0 12px; }

  .chat-card { display:flex; align-items:center; gap:12px; padding:12px 16px; background:rgba(255,255,255,0.03); border-radius:12px; margin-bottom:8px; cursor:pointer; transition:background .15s; }
  .chat-card:hover { background:rgba(255,255,255,0.06); }
  .chat-card-avatar { width:36px; height:36px; border-radius:50%; background:linear-gradient(135deg,#a74fff,#8b3dff); display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:600; flex-shrink:0; }
  .chat-card-info { flex:1; min-width:0; }
  .chat-card-name { font-size:14px; font-weight:500; }
  .chat-card-meta { font-size:11px; color:#666; margin-top:2px; }
  .chat-card-type { font-size:11px; color:#555; background:rgba(255,255,255,0.04); padding:2px 8px; border-radius:6px; flex-shrink:0; }

  .chat-block { margin-top: 32px; padding-top: 32px; border-top: 1px solid rgba(255,255,255,0.06); }
  .chat-header { display:flex; align-items:center; gap:12px; margin-bottom:20px; padding:12px 16px; background:rgba(255,255,255,0.03); border-radius:12px; position:sticky; top:0; z-index:10; backdrop-filter:blur(12px); }
  .chat-header-avatar { width:40px; height:40px; border-radius:50%; background:linear-gradient(135deg,#a74fff,#8b3dff); display:flex; align-items:center; justify-content:center; font-size:16px; font-weight:600; flex-shrink:0; }
  .chat-header-name { font-size:15px; font-weight:600; }
  .chat-header-username { font-size:12px; color:#666; }
  .chat-back { margin-left:auto; font-size:12px; color:#a74fff; text-decoration:none; flex-shrink:0; }
  .chat-back:hover { text-decoration:underline; }

  .messages { display:flex; flex-direction:column; gap:4px; }
  .date-sep { display:flex; justify-content:center; margin:12px 0 8px; }
  .date-sep span { font-size:11px; color:#666; background:rgba(255,255,255,0.04); padding:4px 14px; border-radius:10px; }

  .msg-row { display:flex; margin-bottom:2px; }
  .msg-left { justify-content:flex-start; }
  .msg-right { justify-content:flex-end; }

  .msg-bubble { max-width:85%; padding:8px 14px; border-radius:16px; font-size:14px; line-height:1.45; position:relative; word-wrap:break-word; }
  .msg-other { background:#1c1c1e; border-bottom-left-radius:4px; }
  .msg-own { background:#2a1a4a; border-bottom-right-radius:4px; }
  .msg-sender { font-size:11px; font-weight:600; color:#a74fff; margin-bottom:2px; }
  .msg-text { color:#eee; }
  .msg-text + .msg-photo,
  .msg-text + .msg-file { margin-top:6px; }
  .msg-time { font-size:10px; color:#555; text-align:right; margin-top:4px; }

  .msg-photo { border-radius:10px; overflow:hidden; max-width:250px; background:#111; }
  .msg-photo img { display:block; width:100%; height:auto; }

  .msg-file { display:flex; align-items:center; gap:8px; padding:8px 12px; background:rgba(255,255,255,0.04); border-radius:10px; font-size:12px; max-width:260px; }
  .msg-file-icon { font-size:16px; color:#a74fff; flex-shrink:0; }
  .msg-file-link { margin-left:auto; color:#a74fff; text-decoration:none; font-size:11px; flex-shrink:0; }
  .msg-file-link:hover { text-decoration:underline; }
  .msg-file-na { opacity:.6; }
  .msg-file-na-text { font-size:10px; color:#555; margin-left:auto; }

  @media (max-width:600px) {
    .container { padding:12px; }
    .msg-bubble { max-width:92%; font-size:13px; }
    .chat-header { padding:10px 12px; }
  }
</style>
</head>
<body>
<div class="container" id="top">
  <h1>4SEND Export</h1>
  <p class="meta">${translate('Аккаунт:')} ${escapeHtml(data.account.displayName || data.account.username || '')} (@${escapeHtml(data.account.username || '')})</p>
  <p class="meta">${translate('Дата экспорта:')} ${new Date(data.exportedAt).toLocaleString()}</p>

  <h2>${translate('Чаты')}</h2>
  ${chatListHtml}

  ${chatDetailsHtml}
</div>
</body>
</html>`;
}

function mediaTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    photo: 'Фото',
    video: 'Видео',
    voice: 'Голос',
    videoNote: 'Видеосообщение',
    music: 'Музыка',
    sticker: 'Стикер',
    gif: 'GIF',
    file: 'Файл',
  };
  return labels[type] ? translate(labels[type]) : type;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
