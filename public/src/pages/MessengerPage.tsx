import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { useAuthContext } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { useChatMessages } from '../context/ChatMessagesContext';
import { useUI } from '../context/UIContext';
import { useSettings } from '../context/SettingsContext';
import { useEncryption } from '../context/EncryptionContext';
import { useI18n } from '../hooks/useI18n';
import { useChats } from '../hooks/useChats';
import { useIdleTimer } from '../hooks/useIdleTimer';
import { useMessageSearch } from '../hooks/useMessageSearch';
import { getCachedMessages, cacheMessages, clearCachedMessages, getCachedPin, cachePin } from '../utils/db';
import { preloadImages, getFileExt, isImageFile, isVideoFile, isAudioExtFile, isGifFile } from '../utils/media';
import { downloadFile } from '../utils/download';
import UploadingBubble from '../components/chat/UploadingBubble';
import { getSocket } from '../services/socket';
import { api } from '../services/api';
import { globalLocale } from '../services/storage';
import ContactList from '../components/sidebar/ContactList';
import ChatSearchPanel from '../components/chat/ChatSearchPanel';
import SettingsDrawer from '../components/sidebar/SettingsDrawer';
import SettingsModal from '../components/SettingsModal';
import MessageBubble from '../components/chat/MessageBubble';
import { playReactionParticles } from '../components/chat/ReactionsDisplay';
import { lazy, Suspense } from 'react';
const EmojiPanel = lazy(() => import('../components/chat/EmojiPanel'));
import DeleteChatModal from '../components/DeleteChatModal';
import ForwardModal from '../components/chat/ForwardModal';
import CallOverlay from '../components/chat/CallOverlay';
import { useP2PTransfer } from '../hooks/useP2PTransfer';
import { getSharedFile } from '../utils/sharedFile';
import P2PTransferOverlay from '../components/chat/P2PTransferOverlay';
import ChatSettingsModal from '../components/settings/ChatSettingsModal';
import CustomizationModal from '../components/settings/CustomizationModal';
import HotkeysModal from '../components/settings/HotkeysModal';
import SoundSettingsModal from '../components/settings/SoundSettingsModal';
import NotificationRepeatModal from '../components/settings/NotificationRepeatModal';
import QuickReactionModal from '../components/settings/QuickReactionModal';
import VideoMessageSettingsModal from '../components/settings/VideoMessageSettingsModal';
import LanguageModal from '../components/settings/LanguageModal';
import SecurityModal from '../components/settings/SecurityModal';
import PasswordModal from '../components/settings/PasswordModal';
import TwoFactorModal from '../components/settings/TwoFactorModal';
import PanicPasswordModal from '../components/settings/PanicPasswordModal';
import AutoLockModal from '../components/settings/AutoLockModal';
import ActiveSessionsModal from '../components/settings/ActiveSessionsModal';
import AutoDeleteModal from '../components/settings/AutoDeleteModal';

const EncryptionModal = lazy(() => import('../components/settings/EncryptionModal'));
import DataStorageModal from '../components/settings/DataStorageModal';
import ExportDataModal from '../components/settings/ExportDataModal';
import ReportBugModal from '../components/settings/ReportBugModal';
import FaqModal from '../components/settings/FaqModal';
import AboutModal from '../components/settings/AboutModal';
import AutoLogoutModal from '../components/settings/AutoLogoutModal';
import PinLockScreen from '../components/settings/PinLockScreen';
import PrivacySettingsModal from '../components/settings/PrivacySettingsModal';
import PrivacyOptionModal from '../components/settings/PrivacyOptionModal';
import ArchivePasswordModal from '../components/settings/ArchivePasswordModal';
import ArchiveUnlockModal from '../components/settings/ArchiveUnlockModal';
import QRModal from '../components/settings/QRModal';
import ChatHeaderMenu from '../components/settings/ChatHeaderMenu';
import ChatHeader from '../components/chat/ChatHeader';
import PinnedBar from '../components/chat/PinnedBar';
import VoiceRecorder from '../components/chat/VoiceRecorder';
import ScheduleMenu from '../components/chat/ScheduleMenu';
import ScheduleMessagesList from '../components/chat/ScheduleMessagesList';
import ChatAutoDeleteModal from '../components/chat/ChatAutoDeleteModal';
import MultiSelectBar from '../components/chat/MultiSelectBar';
import ChatStatsModal from '../components/chat/ChatStatsModal';
import SecretChatModal from '../components/chat/SecretChatModal';
import CreateGroupModal from '../components/chat/CreateGroupModal';
import RoomPreviewModal from '../components/chat/RoomPreviewModal';
import Lightbox from '../components/chat/Lightbox';
import { useScreenshotDetector } from '../hooks/useScreenshotDetector';
import { useE2EE } from '../hooks/useE2EE';
import { useHotkeys } from '../hooks/useHotkeys';
import LogoutModal from '../components/settings/LogoutModal';

import TimerMenu from '../components/chat/TimerMenu';
import Confetti from '../components/chat/Confetti';
import FilePreviewModal from '../components/chat/FilePreviewModal';
import FileLimitModal from '../components/chat/FileLimitModal';
import P2PInfoModal from '../components/chat/P2PInfoModal';
import PinConfirmModal from '../components/chat/PinConfirmModal';
import ProfileModal from '../components/chat/ProfileModal';
import RoomSettingsModal from '../components/chat/RoomSettingsModal';
import MediaEditor from '../components/chat/MediaEditor';
import FingerprintModal from '../components/chat/FingerprintModal';
import TypingIndicator from '../components/chat/TypingIndicator';
import PrivacyExceptionsModal from '../components/settings/PrivacyExceptionsModal';
import DeleteAccountModal from '../components/settings/DeleteAccountModal';
import AiRewriteModal from '../components/chat/AiRewriteModal';
import FolderBar from '../components/sidebar/FolderBar';
import FolderEditModal from '../components/sidebar/FolderEditModal';
import { playNotificationSound } from '../utils/notificationSound';
import { messageRetryQueue } from '../utils/messageRetry';
import SendFailureIndicator from '../components/chat/SendFailureIndicator';
import type { Message } from '../types/message';
import { prepareOutgoing, processIncoming, processBatch, updateSessionCache, cacheOwnMessagePlaintext, SECRET_PREFIX, stripSecret } from '../utils/e2ee/messenger';
import { getFolders, getFolderForChat, addChatToFolder, removeChatFromFolder, isFoldersEnabled, FOLDER_ICONS } from '../utils/folders';
import styles from './MessengerPage.module.css';
import { Menu, Plus, Search, ArrowBack, FilledSearch, MoreVert, ArrowUp, ArrowDown, RoundedChatBubble, Attach, Emoji, Mic, Send, Forward, Copy, Reply, Pin, Edit, Trash, Phone } from '../utils/svg';

function formatMsgTime(ts: Date | string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

type PrivacyEntry = Record<string, string> & { exceptions?: Record<string, string[]> };
type PrivacyRegistry = Record<string, PrivacyEntry>;

function isPrivacyHidden(registry: PrivacyRegistry, owner: string, requester: string | null, type: string): boolean {
  if (!owner || !requester) return false;
  if (owner.toLowerCase() === requester.toLowerCase()) return false;
  const p = registry[owner.toLowerCase()];
  if (!p) return false;
  const val = p[type];
  if (val === 'none') return true;
  if (val === 'selected') return !(p.exceptions && p.exceptions[type] && p.exceptions[type].includes(requester.toLowerCase()));
  return false;
}

type ContactList = import('../types/user').ContactItem[];

function updateContact(list: ContactList, username: string, updater: (c: import('../types/user').ContactItem) => import('../types/user').ContactItem): ContactList {
  const idx = list.findIndex(c => c.username.toLowerCase() === username.toLowerCase());
  if (idx === -1) return list;
  const next = [...list];
  next[idx] = updater(next[idx]);
  return next;
}

function removeContact(list: ContactList, username: string): ContactList {
  const next = list.filter(c => c.username.toLowerCase() !== username.toLowerCase());
  return next.length === list.length ? list : next;
}

function upsertContact(list: ContactList, username: string, data: Partial<import('../types/user').ContactItem>): ContactList {
  const existing = list.find(c => c.username.toLowerCase() === username.toLowerCase());
  const next = list.filter(c => c.username.toLowerCase() !== username.toLowerCase());
  next.unshift({ ...existing, username: existing?.username || username, ...data } as import('../types/user').ContactItem);
  return next;
}

function getPinnedMediaType(msg: { text?: string; fileUrl?: string; fileName?: string; isAudio?: boolean; isVideoNote?: boolean; isMusic?: boolean }): string | undefined {
  if (msg.isVideoNote) return 'videonote';
  if (msg.isAudio) return 'voice';
  if (msg.isMusic) return 'audio';
  const text = (msg.text || '').trim();
  if (text === 'Стикер') return 'sticker';
  if (text === 'GIF') return 'gif';
  if (msg.fileUrl && msg.fileUrl !== 'dummy') {
    if (isGifFile(text, getFileExt(msg.fileName, msg.fileUrl))) return 'gif';
    if (isVideoFile(msg.fileName, msg.fileUrl)) return 'video';
    if (isImageFile(msg.fileName, msg.fileUrl)) return 'photo';
    if (isAudioExtFile(msg.fileName, msg.fileUrl)) return 'audio';
    return 'file';
  }
  return undefined;
}

const PINNED_MEDIA_LABELS: Record<string, string> = {
  voice: 'Голосовое сообщение',
  videonote: 'Видеосообщение',
  photo: 'Фотография',
  video: 'Видео',
  audio: 'Аудиозапись',
  sticker: 'Стикер',
  gif: 'GIF',
  file: 'Файл',
};

function getPinnedMediaLabel(mediaType: string, t: (s: string) => string): string {
  return t(PINNED_MEDIA_LABELS[mediaType] || 'Медиа');
}

export default function MessengerPage() {
  const { me, loadAuth } = useAuthContext();
  const { isUnlocked } = useEncryption();
  const { showToast, openModal, closeModal } = useUI();
  const { t } = useI18n();
  const {
    target, setTarget,
    contacts, setContacts, updateContactPreview,
    onlineUsers, setOnlineUsers,
    showDrawer, setShowDrawer, viewingArchive, setViewingArchive,
    unreadCounts, drafts, setDraft,
  } = useChat();
  const {
    messages, setMessages, addMessage,
    editingMsgId, setEditingMsgId, editingMsgText, setEditingMsgText,
    replyText, setReplyText, replyMsgId, setReplyMsgId,
    isChatLoading, setIsChatLoading,
    pendingSchedules, addScheduledTask, removeScheduledTask,
    currentRoomType, setCurrentRoomType,
  } = useChatMessages();
  const { loadChats } = useChats();
  const { isAppLocked, unlockApp, setAllPrivacy, menuItems, messageAlignment: settingsMessageAlignment } = useSettings();

  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isServerSearchResults, setIsServerSearchResults] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const [chatStatus, setChatStatus] = useState('');
  const [chatStatusColor, setChatStatusColor] = useState('#888');
  const [chatName, setChatName] = useState('');
  const [chatAvatar, setChatAvatar] = useState('');
  const [chatVerified, setChatVerified] = useState(false);
  const [isChatBlocked, setIsChatBlocked] = useState(false);
  const [copyRestricted, setCopyRestricted] = useState(false);
  const [screenshotFlash, setScreenshotFlash] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; msg: Message } | null>(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const [lastDateLabel, setLastDateLabel] = useState<string | null>(null);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [pinnedMessage, setPinnedMessage] = useState<Array<{ text: string; id: string; mediaType?: string }>>([]);
  const [showPinConfirm, setShowPinConfirm] = useState(false);
  const [pinTargetMsg, setPinTargetMsg] = useState<Message | null>(null);
  const [showEmojiPanel, setShowEmojiPanel] = useState(false);
  const [emojiClosing, setEmojiClosing] = useState(false);
  const [emojiSourceRect, setEmojiSourceRect] = useState<DOMRect | null>(null);
  const emojiBtnRef = useRef<HTMLButtonElement>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [deleteChatTarget, setDeleteChatTarget] = useState<{ username: string; name: string; isSecret?: boolean } | null>(null);
  const [chatContextMenu, setChatContextMenu] = useState<{ x: number; y: number; username: string; isPinned: boolean; isMuted: boolean; isArchived: boolean; isBlocked: boolean } | null>(null);
  const [forwardMsg, setForwardMsg] = useState<Message | null>(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [activeSubModal, setActiveSubModal] = useState<string | null>(null);
  const [showChatSettingsModal, setShowChatSettingsModal] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [privacyOptionKey, setPrivacyOptionKey] = useState<string | null>(null);
  const [privacyOptionTitle, setPrivacyOptionTitle] = useState('');
  const [showQRModal, setShowQRModal] = useState(false);
  const [previewRoomId, setPreviewRoomId] = useState<string | null>(null);
  const [showChatHeaderMenu, setShowChatHeaderMenu] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingMode, setRecordingMode] = useState<'audio' | 'video'>('audio');
  const [isRecordingLocked, setIsRecordingLocked] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);
  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const [showAiRewriteModal, setShowAiRewriteModal] = useState(false);
  const [showScheduleMenu, setShowScheduleMenu] = useState(false);
  const [scheduledMinutes, setScheduledMinutes] = useState(0);
  const [scheduledMessages, setScheduledMessages] = useState<Array<{id: string; text: string; sendAt: Date; chat: string}>>([]);
  const [showScheduledList, setShowScheduledList] = useState(false);
  const [showChatAutoDelete, setShowChatAutoDelete] = useState(false);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());
  const [showChatStats, setShowChatStats] = useState(false);
  const [showSecretChatModal, setShowSecretChatModal] = useState(false);
  const [chatStatsData, setChatStatsData] = useState<{ createdAt: string; messageCount: number } | null>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [showLogout, setShowLogout] = useState(false);
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const [showSendOptions, setShowSendOptions] = useState(false);
  const [sendOptionsClosing, setSendOptionsClosing] = useState(false);
  const [sendOptionsPos, setSendOptionsPos] = useState<{ bottom: number; right: number } | null>(null);
  const [showSendTimerMenu, setShowSendTimerMenu] = useState(false);
  const [timerMenuClosing, setTimerMenuClosing] = useState(false);
  const [showSendScheduleMenu, setShowSendScheduleMenu] = useState(false);
  const [scheduleMenuClosing, setScheduleMenuClosing] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [privacyRegistry, setPrivacyRegistry] = useState<Record<string, Record<string, string> & { exceptions?: Record<string, string[]> }>>({});
  const [attachMenuClosing, setAttachMenuClosing] = useState(false);
  const [attachMenuPos, setAttachMenuPos] = useState<{ bottom: number; left: number } | null>(null);
  const [p2pMode, setP2pMode] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [showFilePreview, setShowFilePreview] = useState(false);
  const [showFileLimit, setShowFileLimit] = useState(false);
  const [showP2PInfoModal, setShowP2PInfoModal] = useState(false);
  const [failedMessages, setFailedMessages] = useState<Record<string, Message>>({});
  const [allLoaded, setAllLoaded] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [chatSearchResults, setChatSearchResults] = useState<string[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [isIdleLocked, setIsIdleLocked] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileData, setProfileData] = useState<{ username: string; displayName?: string; avatar?: string; bio?: string; lastSeen?: string; isOnline?: boolean; isVerified?: boolean; isRoom?: boolean; roomType?: 'group' | 'channel'; roomDescription?: string } | null>(null);
  const [showRoomSettings, setShowRoomSettings] = useState(false);
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [groupMemberDetails, setGroupMemberDetails] = useState<{ username: string; displayName?: string; avatar?: string; isVerified?: boolean }[]>([]);
  const [isGroupAdmin, setIsGroupAdmin] = useState(false);
  const [roomIsPublic, setRoomIsPublic] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const mentionListRef = useRef<HTMLDivElement>(null);
  const [roomPublicLink, setRoomPublicLink] = useState('');
  const [roomDescription, setRoomDescription] = useState('');
  const [showMediaEditor, setShowMediaEditor] = useState(false);
  const [mediaEditorFile, setMediaEditorFile] = useState<File | null>(null);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [privacyExceptionsKey, setPrivacyExceptionsKey] = useState<string | null>(null);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [showArchiveUnlock, setShowArchiveUnlock] = useState(false);
  const [showFingerprintModal, setShowFingerprintModal] = useState<string | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [folderVersion, setFolderVersion] = useState(0);
  const [showFolderEdit, setShowFolderEdit] = useState(false);
  const [deletingMsgIds, setDeletingMsgIds] = useState<Set<string>>(new Set());
  const [uploadingMessages, setUploadingMessages] = useState<Record<string, { fileName: string; tempId: string; completed?: boolean }>>({});
  const uploadingMessagesRef = useRef(uploadingMessages);
  useEffect(() => { uploadingMessagesRef.current = uploadingMessages; }, [uploadingMessages]);
  const [callState, setCallState] = useState<{
    type: 'incoming' | 'outgoing' | 'active' | 'ended';
    peer: string;
    peerDisplay?: string;
    peerAvatar?: string;
    withVideo?: boolean;
    duration?: number;
    signals?: Array<{ sdp?: unknown; candidate?: unknown }>;
  } | null>(null);
  const callStateRef = useRef(callState);
  callStateRef.current = callState;
  const preloadedStreamRef = useRef<MediaStream | null>(null);

  const startOutgoingCall = useCallback(async (withVideo: boolean, displayName: string, avatar?: string) => {
    if (!target) return;
    preloadedStreamRef.current?.getTracks().forEach(t => t.stop());
    preloadedStreamRef.current = null;
    try {
      preloadedStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: withVideo ? { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, facingMode: 'user' } : false
      });
    } catch (e) {}
    setCallState({ type: 'outgoing', peer: target, peerDisplay: displayName, peerAvatar: avatar, withVideo });
    const ringFile = Math.random() < 0.08 ? 'calling2.mp3' : 'calling.mp3';
    getSocket().emit('call_request', { target, withVideo, ringFile });
  }, [target]);

  const acceptCall = useCallback(() => {
    setCallState(prev => prev ? { ...prev, type: 'active' } : null);
  }, []);

  const closeCall = useCallback(() => {
    preloadedStreamRef.current?.getTracks().forEach(t => t.stop());
    preloadedStreamRef.current = null;
    setCallState(null);
  }, []);

  const p2p = useP2PTransfer();
  const p2pRef = useRef(p2p);
  p2pRef.current = p2p;
  const [showP2PTransfer, setShowP2PTransfer] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const msgContainerRef = useRef<HTMLDivElement>(null);
  const messagesContentRef = useRef<HTMLDivElement>(null);
  const highlightTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const prevTargetRef = useRef<string | null>(null);
  const messagesRef = useRef<Message[]>(messages);
  messagesRef.current = messages;
  const failedMessagesRef = useRef<Record<string, Message>>(failedMessages);
  failedMessagesRef.current = failedMessages;

  const autoLockMinutes = parseFloat(localStorage.getItem('4send_autoLockMinutes') || '0');
  useIdleTimer({
    timeout: autoLockMinutes > 0 ? autoLockMinutes * 60 * 1000 : 999999999,
    onIdle: () => { if (autoLockMinutes > 0) setIsIdleLocked(true); },
  });

  const handleScreenshotFlash = useCallback(() => {
    setScreenshotFlash(true);
    setTimeout(() => setScreenshotFlash(false), 150);
  }, []);

  useScreenshotDetector(target, copyRestricted, handleScreenshotFlash);
  const { hasSession: hasE2EESession, initiateE2EE, sessions: e2eeSessions, removeSession } = useE2EE();

  const chatSelected = !!target;
  const meLower = (me || '').toLowerCase();

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.length <= 1000) {
      setMessageText(val);
      setCharCount(val.length);
    }
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
    ta.style.overflowY = ta.scrollHeight > 150 ? 'auto' : 'hidden';
    if (val.length > 0 && target) {
      setDraft(target, val);
      const socket = getSocket();
      socket.emit('typing', { sender: me, receiver: stripSecret(target) });
    } else if (target) {
      setDraft(target, '');
    }
    const m = val.match(/@([a-zA-Z0-9_]*)$/);
    const isGroup = (groupMembers.length > 1) || (target?.startsWith('room_'));
    if (m && isGroup) {
      setMentionQuery(m[1].toLowerCase());
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  }, [target, me, setDraft, groupMembers, target]);

  const scrollToBottom = useCallback((smooth = true, instant = false) => {
    const c = msgContainerRef.current;
    if (!c) return;
    if (instant) {
      c.scrollTop = Number.MAX_SAFE_INTEGER;
    } else {
      c.scrollTo({ top: c.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    }
  }, []);

  const initialScrollTargetRef = useRef<string | null>(null);
  const initializedScrollTargetRef = useRef<string | null>(null);
  const initialScrollFrameRef = useRef<number | null>(null);

  const handleSend = useCallback(async () => {
    const text = messageText.trim();
    const curTarget = stripSecret(target);
    const isSecretView = !!target && target.startsWith(SECRET_PREFIX);
    if (!text && !editingMsgId && !replyText) return;
    if (!curTarget) {
      showToast(t('Выберите чат!'));
      return;
    }

    const socket = getSocket();

    if (editingMsgId) {
      const textChanged = text !== editingMsgText;
      if (textChanged) {
        socket.emit('edit_msg', {
          id: editingMsgId,
          newText: text
        });
        setMessages(prev => {
          const updated = prev.map(m =>
            (m.id || m.tempId) === editingMsgId
              ? { ...m, text, is_edited: true }
              : m
          );
          cacheMessages(curTarget, updated);
          return updated;
        });
      }
      setEditingMsgId(null);
      setEditingMsgText('');
      setMessageText('');
      setCharCount(0);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      return;
    }

    const tiktokMatch = text.match(/https?:\/\/(?:www\.|vm\.)?tiktok\.com\/\S+/i);
    if (tiktokMatch && !isSecretView) {
      const tiktokUrl = tiktokMatch[0].replace(/[^\w:/.\-?=&#]+$/, '');
      setMessageText('');
      setCharCount(0);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      const tid = 'tiktok_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      setUploadingMessages(prev => ({ ...prev, [tid]: { fileName: 'TikTok video...', tempId: tid } }));
      setTimeout(() => scrollToBottom(), 50);
      showToast(t('Загружаю видео из TikTok...'));
      api.post<{ url?: string; error?: string }>('/api/upload-tiktok', { url: tiktokUrl }).then(async res => {
        setUploadingMessages(prev => { const n = { ...prev }; delete n[tid]; return n; });
        if (res.url) {
          const cleanedText = text.replace(tiktokUrl, '').replace(/\s+/g, ' ').trim();
          const e2eeFields = await prepareOutgoing(cleanedText, curTarget);
          socket.emit('chat_message', {
            sender: me,
            receiver: curTarget,
            text: e2eeFields.is_encrypted ? '' : cleanedText,
            fileUrl: res.url,
            fileName: 'TikTok video.mp4',
            timestamp: new Date().toISOString(),
            tempId: tid,
            ...e2eeFields,
          });
        } else {
          const msg = { sender: me, receiver: curTarget, text, tempId: 't_' + Date.now(), timestamp: new Date().toISOString(), reply_to_id: replyMsgId, reply_to: replyText } as Message;
          addMessage(msg);
          cacheMessages(curTarget, [...messages, msg]);
          const e2eeFields = await prepareOutgoing(text, curTarget);
          socket.emit('chat_message', { ...msg, ...e2eeFields });
          showToast(res.error || t('Ошибка загрузки TikTok'), true);
        }
      }).catch(async () => {
        setUploadingMessages(prev => { const n = { ...prev }; delete n[tid]; return n; });
        const msg = { sender: me, receiver: curTarget, text, tempId: 't_' + Date.now(), timestamp: new Date().toISOString(), reply_to_id: replyMsgId, reply_to: replyText } as Message;
        addMessage(msg);
        cacheMessages(curTarget, [...messages, msg]);
        const e2eeFields = await prepareOutgoing(text, curTarget);
        socket.emit('chat_message', { ...msg, ...e2eeFields });
        showToast(t('Ошибка загрузки TikTok'), true);
      });
      setReplyText(null);
      setReplyMsgId(null);
      setTimerSeconds(0);
      return;
    }

    const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

    const e2eeFields = isSecretView ? await prepareOutgoing(text, target) : {};

    if (e2eeFields.is_encrypted) {
      cacheOwnMessagePlaintext(tempId, text);
    }

    const msgData: Partial<Message> & Record<string, unknown> = {
      sender: me || '',
      receiver: curTarget,
      text,
      tempId,
      timestamp: new Date().toISOString(),
      ...(timerSeconds > 0 && { expires_at: new Date(Date.now() + timerSeconds * 1000).toISOString() }),
      ...e2eeFields,
    };

    if (replyMsgId) {
      msgData.reply_to_id = replyMsgId;
      msgData.reply_to = replyText || '';
    }

    try {
      socket.emit('chat_message', msgData);
    } catch {
      messageRetryQueue.enqueue(msgData as Message);
      setFailedMessages(prev => ({ ...prev, [msgData.tempId || '']: msgData as Message }));
    }

    addMessage(msgData as Message);
    cacheMessages(curTarget, [...messages, msgData as Message]);

    setContacts(prev => {
      const chatUser = curTarget.toLowerCase();
      return upsertContact(prev, chatUser, {
        lastText: e2eeFields.is_encrypted ? (prev.find(c => c.username.toLowerCase() === chatUser)?.lastText || '') : text,
        timestamp: new Date().toISOString(),
        lastSender: me || '',
      });
    });

    setReplyText(null);
    setReplyMsgId(null);
    setMessageText('');
    setCharCount(0);
    if (target) setDraft(target, '');
    setTimerSeconds(0);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.overflowY = 'hidden';
    }

    setTimeout(() => scrollToBottom(), 50);
  }, [messageText, target, editingMsgId, editingMsgText, replyText, replyMsgId, me, showToast, t, addMessage, cacheMessages, messages, setEditingMsgId, setEditingMsgText, setReplyText, setReplyMsgId, scrollToBottom, setContacts, timerSeconds]);

  const scheduleMessage = useCallback((minutes: number) => {
    setShowSendScheduleMenu(false);
    if (minutes > 0 && target && messageText.trim()) {
      const id = 'sched_' + Date.now();
      const sendAt = new Date(Date.now() + minutes * 60 * 1000);
      setScheduledMessages(prev => [...prev, { id, text: messageText.trim(), sendAt, chat: target }]);
      showToast(t('Сообщение запланировано на {time}', { time: sendAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }));
      setMessageText('');
      setCharCount(0);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }
  }, [target, messageText, showToast, t]);

  const scheduleCustom = useCallback(() => {
    const el = document.getElementById('custom-schedule-time') as HTMLInputElement;
    if (!el?.value) return;
    const targetDate = new Date(el.value);
    const diff = Math.floor((targetDate.getTime() - Date.now()) / 60000);
    if (diff > 0 && target && messageText.trim()) {
      setShowSendScheduleMenu(false);
      const id = 'sched_' + Date.now();
      const sendAt = new Date(Date.now() + diff * 60 * 1000);
      setScheduledMessages(prev => [...prev, { id, text: messageText.trim(), sendAt, chat: target }]);
      showToast(t('Сообщение запланировано на {time}', { time: sendAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }));
      setMessageText('');
      setCharCount(0);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }
  }, [target, messageText, showToast, t]);

  const filteredMembers = groupMemberDetails.filter(m =>
    mentionQuery !== null &&
    m.username.toLowerCase() !== meLower &&
    (mentionQuery === '' || m.username.toLowerCase().includes(mentionQuery) || (m.displayName || '').toLowerCase().includes(mentionQuery))
  ).slice(0, 8);

  const applyMention = useCallback((username: string) => {
    setMessageText(prev => {
      const next = prev.replace(/@([a-zA-Z0-9_]*)$/, `@${username} `);
      setCharCount(next.length);
      setMentionQuery(null);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
      });
      return next;
    });
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (mentionQuery !== null && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(i => (i + 1) % filteredMembers.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(i => (i - 1 + filteredMembers.length) % filteredMembers.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        applyMention(filteredMembers[mentionIndex].username);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'ArrowLeft' && !messageText.trim()) {
      e.preventDefault();
      const otherMsg = [...messages].reverse().find(m => (m.sender || '').toLowerCase() !== meLower);
      if (otherMsg?.text) {
        setReplyText(otherMsg.text.slice(0, 200));
        setReplyMsgId(otherMsg.id || null);
      }
    }
    if (e.key === 'ArrowUp' && !messageText.trim()) {
      const myLastMsg = [...messages].reverse().find(m => (m.sender || '').toLowerCase() === meLower);
      if (myLastMsg?.text) {
        e.preventDefault();
        setEditingMsgId(myLastMsg.id || null);
        setEditingMsgText(myLastMsg.text);
        setMessageText(myLastMsg.text);
        setCharCount(myLastMsg.text.length);
      }
    }
  }, [handleSend, messages, setReplyText, setReplyMsgId, messageText, meLower, setEditingMsgId, setEditingMsgText, mentionQuery, filteredMembers, mentionIndex, applyMention]);

  const handleAttachClick = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 240;
    const left = Math.min(rect.left, window.innerWidth - menuWidth - 12);
    setAttachMenuPos({
      bottom: window.innerHeight - rect.top + 12,
      left: Math.max(12, left),
    });
    setShowAttachMenu(true);
  }, []);

  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !target) return;
    const file = files[0]!;
    e.target.value = '';
    if (p2pMode) {
      setP2pMode(false);
      if (target?.toLowerCase() === meLower) {
        showToast(t('Недоступно в Избранном'), true);
        return;
      }
      const contact = contacts.find(c => c.username.toLowerCase() === target?.toLowerCase());
      if (contact?.isRoom) {
        showToast(t('Недоступно в группах и каналах'), true);
        return;
      }
      const lowerTarget = target?.toLowerCase();
      if (lowerTarget === '4send_help' || lowerTarget === '4send_system') {
        showToast(t('Недоступно для системных ботов'), true);
        return;
      }
      p2pRef.current.initiateSend(file, target);
      setShowP2PTransfer(true);
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setShowFileLimit(true);
      return;
    }
    if (file.type.startsWith('image/') && file.size < 20 * 1024 * 1024) {
      setMediaEditorFile(file);
      setShowMediaEditor(true);
    } else {
      setPreviewFile(file);
      setShowFilePreview(true);
    }
  }, [target, p2pMode, showToast, t, contacts, meLower]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items || !target) return;
    const pastedFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item) continue;
      if (item.kind === 'file') {
        const blob = item.getAsFile();
        if (blob) pastedFiles.push(blob);
      }
    }
    if (pastedFiles.length === 0) return;
    e.preventDefault();
    const file = pastedFiles[0]!;
    if (file.size > 25 * 1024 * 1024) {
      setShowFileLimit(true);
      return;
    }
    if (file.type.startsWith('image/') && file.size < 20 * 1024 * 1024) {
      setMediaEditorFile(file);
      setShowMediaEditor(true);
    } else {
      setPreviewFile(file);
      setShowFilePreview(true);
    }
  }, [target]);

  const handleSendFromPreview = useCallback(async (file: File, caption: string) => {
    if (!target) return;
    const tempId = 'upload_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    setUploadingMessages(prev => ({ ...prev, [tempId]: { fileName: file.name, tempId } }));
    scrollToBottom();
    setShowFilePreview(false);
    setPreviewFile(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('sender', me || '');
    formData.append('receiver', stripSecret(target));

    try {
      const res = await api.upload('/upload', formData) as { url?: string; error?: string };
      if (res.url) {
        const socket = getSocket();
        const e2eeFields = await prepareOutgoing(caption || '', stripSecret(target));
        socket.emit('chat_message', {
          sender: me,
          receiver: stripSecret(target),
          text: e2eeFields.is_encrypted ? '' : (caption || ''),
          fileUrl: res.url,
          fileName: file.name,
          timestamp: new Date().toISOString(),
          tempId,
          ...e2eeFields,
        });
      } else {
        setUploadingMessages(prev => { const n = { ...prev }; delete n[tempId]; return n; });
        showToast(res.error || t('Ошибка загрузки'), true);
      }
    } catch (err) {
      setUploadingMessages(prev => { const n = { ...prev }; delete n[tempId]; return n; });
      const srvErr = (err as { error?: string })?.error;
      const msg = srvErr && !/Session expired|Unauthorized|Forbidden/i.test(srvErr) ? srvErr : t('Ошибка загрузки');
      showToast(msg, true);
    }
  }, [target, me, showToast, t]);

  const handleEmojiSelect = useCallback(async (emoji: string) => {
    if (emoji.startsWith('data:')) {
      if (!target) {
        showToast(t('Выберите чат!'));
        return;
      }
      setShowEmojiPanel(false);
      const isGif = emoji.startsWith('data:image/gif');
      const ext = isGif ? 'gif' : 'png';
      const file = new File([await (await fetch(emoji)).blob()], `sticker.${ext}`, { type: `image/${ext}` });
      const tempId = 'upload_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      setUploadingMessages(prev => ({ ...prev, [tempId]: { fileName: file.name, tempId } }));
      scrollToBottom();
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('sender', me || '');
        formData.append('receiver', stripSecret(target));
        const uploadRes = await api.upload('/upload', formData) as { url?: string; error?: string };
        if (uploadRes.url) {
          const socket = getSocket();
          const label = isGif ? 'GIF' : t('Стикер');
          const e2eeFields = await prepareOutgoing(label, stripSecret(target));
          socket.emit('chat_message', {
            sender: me,
            receiver: stripSecret(target),
            text: e2eeFields.is_encrypted ? '' : label,
            fileUrl: uploadRes.url,
            fileName: file.name,
            timestamp: new Date().toISOString(),
            tempId,
            ...e2eeFields,
          });
        } else {
          setUploadingMessages(prev => { const n = { ...prev }; delete n[tempId]; return n; });
          showToast(uploadRes.error || t('Ошибка загрузки'), true);
        }
      } catch {
        setUploadingMessages(prev => { const n = { ...prev }; delete n[tempId]; return n; });
        showToast(t('Ошибка загрузки'), true);
      }
      return;
    }
    setMessageText(prev => prev + emoji);
    setCharCount(prev => prev + emoji.length);
    setShowEmojiPanel(false);
    textareaRef.current?.focus();
  }, [target, me, showToast, t]);

  const [ctxMenuClosing, setCtxMenuClosing] = useState(false);
  const [chatCtxMenuClosing, setChatCtxMenuClosing] = useState(false);
  const [chatCtxFolderMenu, setChatCtxFolderMenu] = useState(false);

  const closeContextMenu = useCallback(() => {
    if (!contextMenu) return;
    setCtxMenuClosing(true);
    setTimeout(() => {
      setContextMenu(null);
      setHighlightedMsgId(null);
      setCtxMenuClosing(false);
    }, 200);
  }, [contextMenu]);

  const closeChatContextMenu = useCallback(() => {
    if (!chatContextMenu) return;
    setChatCtxMenuClosing(true);
    setChatCtxFolderMenu(false);
    setTimeout(() => {
      setChatContextMenu(null);
      setChatCtxMenuClosing(false);
    }, 200);
  }, [chatContextMenu]);

  const handleDeleteChat = useCallback((username: string, chatName: string, isSecret?: boolean) => {
    setDeleteChatTarget({ username, name: chatName, isSecret });
    closeChatContextMenu();
  }, [closeChatContextMenu]);

  const confirmDeleteChat = useCallback(() => {
    if (!deleteChatTarget) return;
    const socket = getSocket();
    const chatUsername = deleteChatTarget.username;
    const isSecret = deleteChatTarget.isSecret;
    const plainUsername = isSecret ? chatUsername.slice('secret::'.length) : chatUsername;
    if (isSecret) {
      removeSession(plainUsername);
    } else {
      const contact = contacts.find(c => c.username.toLowerCase() === chatUsername.toLowerCase());
      if (contact?.isRoom) {
        socket.emit('leave_room', chatUsername);
      } else {
        socket.emit('clear_history', { user: meLower, contact: chatUsername });
      }
    }
    setContacts(prev => removeContact(prev, chatUsername));
    clearCachedMessages(plainUsername.toLowerCase());
    if (target?.toLowerCase() === chatUsername.toLowerCase() || target?.toLowerCase() === ('secret::' + plainUsername).toLowerCase()) {
      setTarget(null);
      prevTargetRef.current = null;
    }
    showToast(isSecret ? t('Секретный чат удалён') : t('Чат удалён'), 'success');
    setDeleteChatTarget(null);
  }, [deleteChatTarget, meLower, contacts, target, setTarget, setContacts, showToast, t, removeSession]);

  const handleForward = useCallback(() => {
    if (contextMenu?.msg) {
      setForwardMsg(contextMenu.msg);
      setShowForwardModal(true);
    }
    closeContextMenu();
  }, [contextMenu, closeContextMenu]);

  const handlePin = useCallback(() => {
    if (!contextMenu?.msg?.id || !target) return;
    setPinTargetMsg(contextMenu.msg);
    setShowPinConfirm(true);
    closeContextMenu();
  }, [contextMenu, target, closeContextMenu]);

  const handlePinConfirm = useCallback((forAll: boolean) => {
    if (!pinTargetMsg?.id || !target) return;
    const socket = getSocket();
    const mediaType = getPinnedMediaType(pinTargetMsg);
    const label = mediaType ? getPinnedMediaLabel(mediaType, t) : '';
    const textPreview = label || pinTargetMsg.text?.slice(0, 100) || '';
    socket.emit('pin_request', {
      messageId: pinTargetMsg.id,
      chatId: stripSecret(target).toLowerCase(),
      pinnerId: meLower,
      type: forAll ? 'both' : 'me',
      textPreview,
    });
    const text = mediaType ? getPinnedMediaLabel(mediaType, t) : (pinTargetMsg.text || '');
    setPinnedMessage(prev => {
      const next = [{ text, id: pinTargetMsg.id, mediaType }, ...prev.filter(p => p.id !== pinTargetMsg.id)];
      cachePin(target.toLowerCase(), next);
      return next;
    });
    setShowPinConfirm(false);
    setPinTargetMsg(null);
    showToast(t('Сообщение закреплено'), 'success');
  }, [pinTargetMsg, target, meLower, me, showToast, t, addMessage, cacheMessages, messagesRef]);

  const handleDeleteForAll = useCallback(() => {
    if (!contextMenu?.msg?.id) return;
    const socket = getSocket();
    socket.emit('delete_msg', contextMenu.msg.id);
    setMessages(prev => prev.filter(m => m.id !== contextMenu.msg.id));
    closeContextMenu();
  }, [contextMenu, setMessages, closeContextMenu]);

  const handleChatContextAction = useCallback((action: string, username: string) => {
    const socket = getSocket();
    if (action === 'pin') {
      socket.emit('toggle_pin', { user: meLower, contact: username });
      setContacts(prev => updateContact(prev, username, c => ({ ...c, is_pinned: !c.is_pinned })));
    } else if (action === 'mute') {
      socket.emit('toggle_mute', { contact: username, me: meLower });
      setContacts(prev => updateContact(prev, username, c => ({ ...c, is_muted: !c.is_muted })));
    } else if (action === 'archive') {
      const contact = contacts.find(c => c.username.toLowerCase() === username.toLowerCase());
      const currentlyArchived = !!contact?.is_archived;
      socket.emit('toggle_archive', { contact: username, me: meLower });
      setContacts(prev => updateContact(prev, username, c => ({ ...c, is_archived: !currentlyArchived })));
    } else if (action === 'block') {
      (async () => {
        const res = await api.post<{ status: string }>('/api/toggle-block', { me, target: username });
        const isBlocked = res.status === 'blocked';
        setIsChatBlocked(prev => username.toLowerCase() === (target || '').toLowerCase() ? isBlocked : prev);
        setContacts(prev => updateContact(prev, username, c => ({ ...c, i_blocked_him: isBlocked })));
        showToast(isBlocked ? t('Пользователь заблокирован') : t('Пользователь разблокирован'));
      })();
    } else if (action === 'delete') {
      const isSecret = username.toLowerCase().startsWith('secret::');
      const plainUsername = isSecret ? username.slice('secret::'.length) : username;
      const lower = plainUsername.toLowerCase();
      const contact = contacts.find(c => c.username.toLowerCase() === lower);
      const rawName = contact?.displayName || plainUsername;
      const displayName = lower === '4send_system' ? t('Системные уведомления') : lower === '4send_help' ? t('Поддержка 4SEND') : rawName;
      handleDeleteChat(isSecret ? username : plainUsername, displayName, isSecret);
    }
    closeChatContextMenu();
  }, [contacts, meLower, me, setContacts, handleDeleteChat, closeChatContextMenu]);

  const toggleMultiSelect = useCallback((msgId: string) => {
    setSelectedMsgIds(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  }, []);

  const handleMultiDelete = useCallback(() => {
    const socket = getSocket();
    const ids = [...selectedMsgIds];
    setDeletingMsgIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
      return next;
    });
    ids.forEach(id => {
      socket.emit('delete_msg', id);
    });
    setTimeout(() => {
      setMessages(prev => {
        const remaining = prev.filter(m => !selectedMsgIds.has(m.id || m.tempId || ''));
        if (target) cacheMessages(target, remaining);
        if (remaining.length === 0) {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => { scrollToBottom(false, true); });
          });
        }
        return remaining;
      });
      setDeletingMsgIds(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.delete(id));
        return next;
      });
      setSelectedMsgIds(new Set());
      setMultiSelectMode(false);
    }, 300);
  }, [selectedMsgIds, me, target, setMessages]);

  const handleMultiForward = useCallback(() => {
    setShowForwardModal(true);
  }, []);

  const handleMultiSelectCancel = useCallback(() => {
    setSelectedMsgIds(new Set());
    setMultiSelectMode(false);
  }, []);

  const handleDoubleClickMsg = useCallback((msg: Message) => {
    if (multiSelectMode) {
      toggleMultiSelect(msg.id || msg.tempId || '');
      return;
    }
    if (!msg.text) return;
    setReplyText(msg.text.slice(0, 200));
    setReplyMsgId(msg.id || null);
  }, [multiSelectMode, toggleMultiSelect, setReplyText, setReplyMsgId]);

  const handleReact = useCallback((msgId: string, emoji: string) => {
    setMessages(prev => prev.map(m => {
      if ((m.id || m.tempId) !== msgId) return m;
      const existing = m.reactions || [];
      const idx = existing.findIndex(r => r.emoji === emoji);
      if (idx >= 0) {
        const r = existing[idx]!;
        if (r.count <= 1) {
          return { ...m, reactions: existing.filter((_, i) => i !== idx) };
        }
        return { ...m, reactions: existing.map((rr, i) => i === idx ? { ...rr, count: rr.count - 1 } : rr) };
      }
      return { ...m, reactions: [...existing, { emoji, count: 1 }] };
    }));
  }, []);

  const handleStartMultiSelect = useCallback(() => {
    if (!contextMenu?.msg) return;
    const msgId = contextMenu.msg.id || contextMenu.msg.tempId;
    if (!msgId) return;
    setMultiSelectMode(true);
    setSelectedMsgIds(new Set([msgId]));
    closeContextMenu();
  }, [contextMenu, closeContextMenu]);

  const savedContactsRef = useRef<import('../types/user').ContactItem[] | null>(null);

  const handleSearchInput = useCallback((q: string) => {
    setSearchQuery(q);
    clearTimeout(searchTimeoutRef.current);
    if (!q.trim()) {
      setIsServerSearchResults(false);
      if (savedContactsRef.current) {
        setContacts(savedContactsRef.current);
        savedContactsRef.current = null;
      }
      return;
    }
    searchTimeoutRef.current = setTimeout(() => {
      const socket = getSocket();
      if (socket.connected) {
        if (!savedContactsRef.current) savedContactsRef.current = contacts;
        socket.emit('search_user', q.trim());
      }
    }, 500);
  }, [contacts, setContacts]);

  const handleSelectChat = useCallback(async (username: string) => {
    const newTarget = username.toLowerCase();
    if (prevTargetRef.current === newTarget) return;
    prevTargetRef.current = newTarget;

    setTarget(newTarget);
    setShowProfileModal(false);
    setProfileData(null);
    if (window.innerWidth <= 768) {
      window.history.pushState({ chatOpen: true }, '');
    }
    setIsChatLoading(true);
    setMessages([]);
    setPinnedMessage([]);
    setUploadingMessages({});
    setEditingMsgId(null);
    setEditingMsgText('');
    setReplyText(null);
    setReplyMsgId(null);
    setContextMenu(null);
    setHighlightedMsgId(null);
    setCtxMenuClosing(false);
    setChatSearchQuery('');
    setChatSearchResults([]);
    setCurrentSearchIndex(0);
    const restoredDraft = drafts[newTarget] || '';
    setMessageText(restoredDraft);
    setCharCount(restoredDraft.length);
    setShowEmojiPanel(false);
    setShowScrollBtn(false);
    setMessages([]);
    if (msgContainerRef.current) msgContainerRef.current.scrollTop = 0;

    setSearchQuery('');
    setSearchFocused(false);
    searchInputRef.current?.blur();
    setIsServerSearchResults(false);
    setViewingArchive(false);
    setChatStatsData(null);
    setContacts(prev => updateContact(prev, stripSecret(newTarget), c => ({ ...c, unreadCount: 0 })));

    const isSaved = newTarget === meLower;
    const contact = contacts.find(c => c.username.toLowerCase() === newTarget);
    if (isSaved) {
      setChatName(t('Избранное'));
      setChatAvatar('');
      setChatVerified(false);
      setChatStatus(t('сохранённые сообщения'));
      setChatStatusColor('#888');
    } else if (contact) {
      setChatName(contact.displayName || contact.username);
      setChatAvatar(contact.avatar || '');
      setChatVerified(!!contact.isVerified);
      if (newTarget === '4send_system' || newTarget === '4send_help') {
        setChatName(newTarget === '4send_system' ? t('Системные уведомления') : t('Поддержка 4SEND'));
        setChatAvatar('/ico.png');
        setChatVerified(true);
        setChatStatus(t('системный бот'));
        setChatStatusColor('#888');
      } else if (contact.isRoom) {
        setChatName(contact.displayName || contact.username);
        setChatAvatar(contact.avatar || '');
        setChatVerified(!!contact.isVerified);
        if (contact.memberCount !== undefined) {
          setChatStatus(contact.roomType === 'channel'
            ? `${contact.memberCount} ${t('подписчиков')}`
            : `${contact.memberCount} ${t('участников')}`);
        } else {
          setChatStatus(contact.roomType === 'channel' ? t('Канал') : t('Группа'));
        }
        setChatStatusColor('#888');
      } else if (onlineUsers.has(newTarget) || contact.isOnline) {
        setChatStatus(t('в сети'));
        setChatStatusColor('#4caf50');
      } else if (contact.last_seen) {
        const lastDate = new Date(contact.last_seen);
        if (!isNaN(lastDate.getTime())) {
          const isToday = lastDate.toDateString() === new Date().toDateString();
          const timeStr = lastDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setChatStatus(isToday ? `${t('был(а)')} ${t('в')} ${timeStr}` : `${t('был(а)')} ${lastDate.toLocaleDateString(globalLocale(), { day: 'numeric', month: 'long' })} ${t('в')} ${timeStr}`);
        } else {
          setChatStatus(t('был(а) недавно'));
        }
        setChatStatusColor('#888');
      } else {
        setChatStatus(t('был(а) недавно'));
        setChatStatusColor('#888');
      }
      if (!contact.isRoom && newTarget !== '4send_system' && newTarget !== '4send_help') {
        if (isPrivacyHidden(privacyRegistry, newTarget, me, 'avatar')) setChatAvatar('');
        if (isPrivacyHidden(privacyRegistry, newTarget, me, 'status')) {
          setChatStatus(t('был(а) недавно'));
          setChatStatusColor('#888');
        }
      }
    } else {
      if (newTarget === '4send_system' || newTarget === '4send_help') {
        setChatName(newTarget === '4send_system' ? t('Системные уведомления') : t('Поддержка 4SEND'));
        setChatAvatar('/ico.png');
        setChatVerified(true);
        setChatStatus(t('системный бот'));
        setChatStatusColor('#888');
      } else {
        setChatName(newTarget);
        setChatAvatar('');
        setChatVerified(false);
        setChatStatus(t('был(а) недавно'));
        setChatStatusColor('#888');
      }
    }

        getCachedMessages(newTarget).then(async (cached) => {
      if (cached && cached.length > 0 && prevTargetRef.current === newTarget) {
        const isSecretView = newTarget.startsWith(SECRET_PREFIX);
        let decrypted = await processBatch(cached);
        decrypted = decrypted.filter(m => isSecretView ? !!m.is_encrypted && !m.e2ee_failed : !m.is_encrypted);
        await preloadImages(decrypted);
        if (prevTargetRef.current !== newTarget) return;
        setMessages(decrypted);
        setIsChatLoading(false);
      }
    });

    const socket = getSocket();
    socket.emit('join', me);

    const isSecretTarget = newTarget.startsWith(SECRET_PREFIX);
    if (!isSecretTarget) {
      const realTargetForPin = newTarget;
      getCachedPin(newTarget).then((cachedPins) => {
        if (cachedPins && prevTargetRef.current === newTarget) {
          setPinnedMessage(cachedPins);
        }
      });
      api.get<Array<{ id: string; text: string }>>(`/api/get-pins/${encodeURIComponent(meLower)}/${encodeURIComponent(realTargetForPin)}?t=${Date.now()}`)
        .then((pins) => {
          if (prevTargetRef.current !== newTarget) return;
          const list = Array.isArray(pins) && pins.length > 0
            ? pins.map(p => ({ text: p.text, id: p.id }))
            : [];
          setPinnedMessage(list);
          cachePin(newTarget, list.length > 0 ? list : null);
        })
        .catch(() => {});
    } else {
      setPinnedMessage([]);
    }

    const fetchHistory = async () => {
      const realTarget = newTarget.startsWith(SECRET_PREFIX) ? newTarget.slice(SECRET_PREFIX.length) : newTarget;
      const isSecretView = newTarget.startsWith(SECRET_PREFIX);
      setAllLoaded(false);
      try {
        const res = await api.get<Message[]>(`/history/${encodeURIComponent(meLower)}/${encodeURIComponent(realTarget)}?t=${Date.now()}`);
        if (Array.isArray(res)) {
          let decrypted = await processBatch(res);
          decrypted = decrypted.filter(m => isSecretView ? !!m.is_encrypted && !m.e2ee_failed : !m.is_encrypted);
          if (prevTargetRef.current === newTarget) {
            if (decrypted.length < 50) setAllLoaded(true);
            const currentMsgIds = messagesRef.current.map(m => m.id).filter(Boolean);
            const newMsgIds = new Set(decrypted.map(m => m.id).filter(Boolean));
            const same = currentMsgIds.length === newMsgIds.size && currentMsgIds.every(id => newMsgIds.has(id));
            await preloadImages(decrypted);
            if (prevTargetRef.current !== newTarget) return;
            if (!same) {
              setMessages(decrypted);
            }
            setPinnedMessage(prev => {
              if (prev.length === 0) return prev;
              const updated = prev.map(p => {
                if (p.mediaType) return p;
                const pinnedMsg = decrypted.find(m => m.id === p.id);
                if (pinnedMsg) {
                  const mt = getPinnedMediaType(pinnedMsg);
                  if (mt) {
                    const newText = getPinnedMediaLabel(mt, t);
                    return { ...p, text: newText, mediaType: mt };
                  }
                }
                return p;
              });
              const changed = updated.some((p, i) => p.mediaType !== prev[i]?.mediaType);
              if (changed) cachePin(newTarget.toLowerCase(), updated);
              return updated;
            });
            setIsChatLoading(false);
          }
          cacheMessages(newTarget, decrypted);
        } else {
          setIsChatLoading(false);
          setAllLoaded(true);
        }
      } catch {
        setIsChatLoading(false);
        setAllLoaded(true);
      }
    };

     const fetchStatus = async () => {
      try {
        if (newTarget.startsWith(SECRET_PREFIX)) {
          const real = stripSecret(newTarget);
          const c = contacts.find(x => x.username.toLowerCase() === real.toLowerCase());
          setChatName(c?.displayName || real);
          setChatAvatar(c?.avatar || '');
          setChatVerified(false);
          setIsChatBlocked(false);
          setChatStatus(t('секретный чат'));
          setChatStatusColor('#4caf50');
          return;
        }
        if (newTarget.startsWith('room_') || newTarget.includes('_group') || newTarget.includes('_channel')) {
          const roomData = await api.get<{ name?: string; avatar?: string; type?: string; members?: string[]; memberDetails?: { username: string; displayName?: string; avatar?: string; isVerified?: boolean }[]; isVerified?: boolean; owner?: string; isPublic?: boolean; publicLink?: string; description?: string }>(`/api/room/${encodeURIComponent(newTarget)}`);
          if (prevTargetRef.current !== newTarget) return;
          if (roomData.name) setChatName(roomData.name);
          if (roomData.avatar) setChatAvatar(roomData.avatar);
          if (roomData.isVerified !== undefined) setChatVerified(roomData.isVerified);
          setIsGroupAdmin(roomData.owner?.toLowerCase() === meLower);
          setGroupMembers(roomData.members || []);
          setGroupMemberDetails(roomData.memberDetails || []);
          setRoomIsPublic(!!roomData.isPublic);
          setRoomPublicLink(roomData.publicLink || '');
          setRoomDescription(roomData.description || '');
          const mCount = roomData.members?.length || 1;
          setChatStatus(roomData.type === 'channel' ? `${mCount} ${t('подписчиков')}` : `${mCount} ${t('участников')}`);
          setChatStatusColor('#888');
        } else {
          if (newTarget.toLowerCase() === meLower) {
            setChatName(t('Избранное'));
            setChatAvatar('');
            setChatVerified(false);
            setIsChatBlocked(false);
            setChatStatus(t('сохранённые сообщения'));
            setChatStatusColor('#888');
          } else {
            const data = await api.get<any>(`/api/status/${encodeURIComponent(newTarget)}?me=${encodeURIComponent(meLower)}`);
            if (prevTargetRef.current !== newTarget) return;
            setCopyRestricted(!!data?.copyRestriction);
            if (newTarget === '4send_system' || newTarget === '4send_help') {
              setChatName(newTarget === '4send_system' ? t('Системные уведомления') : t('Поддержка 4SEND'));
              setChatAvatar('/ico.png');
              setChatVerified(true);
              setIsChatBlocked(false);
              setChatStatus(t('системный бот'));
              setChatStatusColor('#888');
            } else {
              if (data.displayName) setChatName(data.displayName);
              if (data.avatar) setChatAvatar(data.avatar);
              if (data.isVerified !== undefined) setChatVerified(data.isVerified);
              setIsChatBlocked(!!data.is_blocked);
              if (data.is_blocked) {
                setChatStatus(t('был(а) давно'));
                setChatStatusColor('#888');
              } else if (data.isOnline) {
                setChatStatus(t('в сети'));
                setChatStatusColor('#4caf50');
              } else if (data.last_seen) {
                const lastDate = new Date(data.last_seen);
                const isToday = lastDate.toDateString() === new Date().toDateString();
                const timeStr = lastDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          setChatStatus(isToday ? `${t('был(а)')} ${t('в')} ${timeStr}` : `${t('был(а)')} ${lastDate.toLocaleDateString(globalLocale(), { day: 'numeric', month: 'long' })} ${t('в')} ${timeStr}`);
                setChatStatusColor('#888');
              }
            }
          }
        }
      } catch {
        if (prevTargetRef.current !== newTarget) return;
        setChatStatusColor('#888');
      }
    };

    await Promise.all([fetchHistory(), fetchStatus()]);
    setIsChatLoading(false);

    api.get<{ createdAt: string; messageCount: number }>(`/api/chat-stats/${newTarget}`).then(res => {
      if (prevTargetRef.current === newTarget) setChatStatsData(res);
    }).catch(() => {});

    socket.emit('mark_read', { sender: stripSecret(newTarget), receiver: me, ...(newTarget.startsWith('room_') ? { isRoom: true } : {}) });
    setTimeout(() => {
      if (textareaRef.current && newTarget !== '4send_system') {
        textareaRef.current.focus();
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
      }
    }, 200);
  }, [me, meLower, contacts, drafts, onlineUsers, setTarget, setMessages, setIsChatLoading, setEditingMsgId, setEditingMsgText, setReplyText, setReplyMsgId, scrollToBottom, t, setViewingArchive]);

  const handleContextMenu = useCallback((e: React.MouseEvent, msg: Message) => {
    e.preventDefault();
    const bubbleEl = (e.currentTarget as HTMLElement).querySelector('[data-bubble]') as HTMLElement;
    if (bubbleEl) {
      const rect = bubbleEl.getBoundingClientRect();
      const menuWidth = 240;
      const menuHeight = 350;
      const isSent = (msg.sender || '').toLowerCase() === (me || '').toLowerCase();
      const allLeft = settingsMessageAlignment === 'allLeft';
      let x: number;
      let y: number;
      if (isSent && !allLeft) {
        x = rect.left - menuWidth - 8;
      } else {
        x = rect.right + 8;
      }
      y = rect.top - 10;
      if (x < 10) x = 10;
      if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10;
      if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10;
      if (y < 10) y = 10;
      setContextMenu({ x, y, msg });
      setHighlightedMsgId(msg.id || msg.tempId || null);
    } else {
      setContextMenu({ x: e.clientX, y: e.clientY, msg });
      setHighlightedMsgId(msg.id || msg.tempId || null);
    }
  }, [me]);

  const handleLongPress = useCallback((msg: Message, x: number, y: number) => {
    const menuWidth = 240;
    const menuHeight = 350;
    let posX = x;
    let posY = y;
    if (posX + menuWidth > window.innerWidth) posX = window.innerWidth - menuWidth - 10;
    if (posY + menuHeight > window.innerHeight) posY = window.innerHeight - menuHeight - 10;
    if (posX < 10) posX = 10;
    if (posY < 10) posY = 10;
    setContextMenu({ x: posX, y: posY, msg });
    setHighlightedMsgId(msg.id || msg.tempId || null);
  }, []);

  const confirmForward = useCallback(async (toUser: string) => {
    if (!me) return;
    const socket = getSocket();

    const ids: string[] = [];
    if (multiSelectMode && selectedMsgIds.size > 0) {
      selectedMsgIds.forEach(id => ids.push(id));
    } else if (forwardMsg?.id) {
      ids.push(forwardMsg.id);
    }
    if (ids.length === 0) return;

    ids.forEach(id => {
      socket.emit('forward_message', { msgId: id, fromUser: me, toUser });
    });

    const chatUser = toUser.toLowerCase();
    const isDifferentChat = chatUser !== (target || '').toLowerCase();

    if (!multiSelectMode && forwardMsg) {
      const originalContact = contacts.find(c => c.username.toLowerCase() === forwardMsg.sender.toLowerCase());
      const senderName = originalContact?.displayName || forwardMsg.sender;
      const forwardedText = `📂 ${t('Переслано от')} ${senderName}:\n${forwardMsg.text || ''}`;
      const tempId = 'temp_forward_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      const optimisticMsg = {
        sender: me,
        receiver: toUser,
        text: forwardedText,
        tempId,
        timestamp: new Date().toISOString(),
      } as Message;

      if (isDifferentChat) {
        await handleSelectChat(toUser);
      }
      addMessage(optimisticMsg);
      cacheMessages(chatUser, [...(messagesRef.current || []), optimisticMsg]);
    } else if (isDifferentChat) {
      handleSelectChat(toUser);
    }

    setShowForwardModal(false);
    setForwardMsg(null);
    if (multiSelectMode) {
      setSelectedMsgIds(new Set());
      setMultiSelectMode(false);
    }
    showToast(t('Сообщение переслано'), 'success');
  }, [forwardMsg, me, multiSelectMode, selectedMsgIds, target, showToast, t, handleSelectChat, addMessage, cacheMessages, messagesRef, contacts]);

  const handleDownloadFile = useCallback(() => {
    if (!contextMenu?.msg?.fileUrl) return;
    downloadFile(contextMenu.msg.fileUrl, contextMenu.msg.fileName);
    closeContextMenu();
  }, [contextMenu, closeContextMenu]);

  const isStickerMsg = useCallback(() => {
    const url = contextMenu?.msg?.fileUrl?.toLowerCase() || '';
    const name = contextMenu?.msg?.fileName?.toLowerCase() || '';
    return url.endsWith('.webp') || name.endsWith('.webp');
  }, [contextMenu]);

  const isGifMsg = useCallback(() => {
    const url = contextMenu?.msg?.fileUrl?.toLowerCase() || '';
    const name = contextMenu?.msg?.fileName?.toLowerCase() || '';
    return url.includes('.gif') || name.endsWith('.gif');
  }, [contextMenu]);

  const handleSaveSticker = useCallback(() => {
    const url = contextMenu?.msg?.fileUrl;
    if (!url) return;
    const saved: string[] = JSON.parse(localStorage.getItem('4send_saved_stickers') || '[]');
    if (saved.includes(url)) {
      showToast(t('Стикер уже сохранен'), false);
    } else {
      saved.unshift(url);
      localStorage.setItem('4send_saved_stickers', JSON.stringify(saved));
      showToast(t('Стикер сохранен'), false);
    }
    closeContextMenu();
  }, [contextMenu, closeContextMenu, showToast, t]);

  const handleSaveGif = useCallback(() => {
    const url = contextMenu?.msg?.fileUrl;
    if (!url) return;
    const saved: string[] = JSON.parse(localStorage.getItem('4send_saved_gifs') || '[]');
    if (saved.includes(url)) {
      showToast(t('GIF уже сохранена'), false);
    } else {
      saved.unshift(url);
      localStorage.setItem('4send_saved_gifs', JSON.stringify(saved));
      showToast(t('GIF сохранена'), false);
    }
    closeContextMenu();
  }, [contextMenu, closeContextMenu, showToast, t]);

  const handleSaveToFavorites = useCallback(async () => {
    if (!me || !contextMenu?.msg) return;
    const socket = getSocket();
    const msg = contextMenu.msg;
    const toUser = me;

    socket.emit('forward_message', { msgId: msg.id, fromUser: me, toUser });

    const originalContact = contacts.find(c => c.username.toLowerCase() === msg.sender.toLowerCase());
    const senderName = originalContact?.displayName || msg.sender;
    const forwardedText = `📂 ${t('Переслано от')} ${senderName}:\n${msg.text || ''}`;
    const tempId = 'temp_forward_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const optimisticMsg = {
      sender: me,
      receiver: toUser,
      text: forwardedText,
      tempId,
      timestamp: new Date().toISOString(),
    } as Message;

    const chatUser = toUser.toLowerCase();
    if (chatUser !== (target || '').toLowerCase()) {
      await handleSelectChat(toUser);
    }
    addMessage(optimisticMsg);
    cacheMessages(chatUser, [...(messagesRef.current || []), optimisticMsg]);

    closeContextMenu();
    showToast(t('Сохранено в избранное'), 'success');
  }, [me, contextMenu, contacts, t, target, handleSelectChat, addMessage, cacheMessages, messagesRef, closeContextMenu, showToast]);

  const handleCopyText = useCallback(() => {
    if (contextMenu?.msg?.text) {
      navigator.clipboard.writeText(contextMenu.msg.text).then(() => {
        showToast(t('Скопировано'), 'success');
      }).catch(() => {});
    }
    closeContextMenu();
  }, [contextMenu, showToast, t, closeContextMenu]);

  const handleReply = useCallback(() => {
    if (contextMenu?.msg?.text) {
      setReplyText(contextMenu.msg.text.slice(0, 200));
      setReplyMsgId(contextMenu.msg.id || null);
    }
    closeContextMenu();
  }, [contextMenu, setReplyText, setReplyMsgId, closeContextMenu]);

  const handleEdit = useCallback(() => {
    if (contextMenu?.msg) {
      setEditingMsgId(contextMenu.msg.id || contextMenu.msg.tempId || null);
      setEditingMsgText(contextMenu.msg.text || '');
      setMessageText(contextMenu.msg.text);
      setCharCount(contextMenu.msg.text.length);
      closeContextMenu();
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
      }, 250);
    }
  }, [contextMenu, setEditingMsgId, setEditingMsgText, closeContextMenu]);

  const handleDelete = useCallback(() => {
    if (contextMenu?.msg?.id) {
      const msgId = contextMenu.msg.id;
      setDeletingMsgIds(prev => new Set(prev).add(msgId));
      const socket = getSocket();
      socket.emit('delete_msg', msgId);
      setTimeout(() => {
        setMessages(prev => {
          const remaining = prev.filter(m => m.id !== msgId);
          if (target) cacheMessages(target, remaining);
          if (remaining.length === 0) {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => { scrollToBottom(false, true); });
            });
          }
          return remaining;
        });
        setDeletingMsgIds(prev => { const next = new Set(prev); next.delete(msgId); return next; });
      }, 300);
    }
    closeContextMenu();
  }, [contextMenu, me, target, setMessages, closeContextMenu, scrollToBottom]);



  const loadMoreHistory = useCallback(async () => {
    if (allLoaded || isLoadingMore || !target) return;
    const oldest = messagesRef.current[0];
    if (!oldest?.id) return;
    const isSecretView = target.startsWith(SECRET_PREFIX);
    const realTarget = stripSecret(target);
    setIsLoadingMore(true);
    try {
      const res = await api.get<Message[]>(`/history/${encodeURIComponent(meLower)}/${encodeURIComponent(realTarget)}?lastId=${oldest.id}&limit=50`);
      const decrypted = await processBatch(Array.isArray(res) ? res : []);
      const msgs = (Array.isArray(res) ? decrypted : []).filter(m => isSecretView ? !!m.is_encrypted && !m.e2ee_failed : !m.is_encrypted);
      if (msgs.length > 0) {
        const existingIds = new Set(messagesRef.current.map(m => m.id).filter(Boolean));
        let newMsgs = msgs.filter(m => m.id && !existingIds.has(m.id));
        if (newMsgs.length > 0) {
          newMsgs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          const c = msgContainerRef.current;
          const prevHeight = c?.scrollHeight || 0;
          setMessages(prev => [...newMsgs, ...prev]);
          if (c) {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                c.scrollTop = c.scrollHeight - prevHeight;
              });
            });
          }
        }
        if (res.length < 50 || newMsgs.length === 0) setAllLoaded(true);
      } else {
        setAllLoaded(true);
      }
    } catch {
      setAllLoaded(true);
    }
    setIsLoadingMore(false);
  }, [allLoaded, isLoadingMore, target, meLower]);

  useEffect(() => {
    const container = msgContainerRef.current;
    if (!container) return;
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 200);

      if (scrollTop < 100 && !isChatLoading && target && !allLoaded && !isLoadingMore) {
        loadMoreHistory();
      }
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [isChatLoading, target, allLoaded, isLoadingMore, loadMoreHistory]);

  useEffect(() => {
    const container = msgContainerRef.current;
    const content = messagesContentRef.current;
    if (!container || !content || !target) return;
    let nearBottom = true;
    const ro = new ResizeObserver(() => {
      if (nearBottom || initialScrollTargetRef.current === target) {
        container.scrollTop = Number.MAX_SAFE_INTEGER;
      }
    });
    ro.observe(content);
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      nearBottom = scrollHeight - scrollTop - clientHeight < 300;
    };
    const releaseInitialScroll = () => {
      initialScrollTargetRef.current = null;
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    container.addEventListener('wheel', releaseInitialScroll, { passive: true });
    container.addEventListener('touchstart', releaseInitialScroll, { passive: true });
    container.addEventListener('pointerdown', releaseInitialScroll, { passive: true });
    return () => {
      ro.disconnect();
      container.removeEventListener('scroll', onScroll);
      container.removeEventListener('wheel', releaseInitialScroll);
      container.removeEventListener('touchstart', releaseInitialScroll);
      container.removeEventListener('pointerdown', releaseInitialScroll);
    };
  }, [target]);

  useLayoutEffect(() => {
    if (!target || messages.length === 0) {
      initializedScrollTargetRef.current = null;
      return;
    }
    if (initializedScrollTargetRef.current === target) return;
    initializedScrollTargetRef.current = target;
    initialScrollTargetRef.current = target;
    const c = msgContainerRef.current;
    if (!c) return;
    let frames = 0;
    const pinToBottom = () => {
      if (initialScrollTargetRef.current !== target) return;
      c.scrollTop = Math.max(0, c.scrollHeight - c.clientHeight);
      frames += 1;
      if (frames < 30) initialScrollFrameRef.current = requestAnimationFrame(pinToBottom);
    };
    pinToBottom();
    return () => {
      if (initialScrollFrameRef.current !== null) cancelAnimationFrame(initialScrollFrameRef.current);
    };
  }, [target, messages.length]);

  useEffect(() => {
    const handleClick = () => {
      if (contextMenu) closeContextMenu();
      if (chatContextMenu) closeChatContextMenu();
    };
    if (contextMenu || chatContextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
    return undefined;
  }, [contextMenu, chatContextMenu, closeContextMenu, closeChatContextMenu]);

  useEffect(() => {
    const socket = getSocket();

    socket.on('connect', () => {
      socket.emit('join', meLower);
      socket.emit('request_privacy_sync');
    });

    const onNewMessage = async (rawData: Message) => {
      const data = await processIncoming(rawData);
      const myId = meLower;
      const s = (data.sender || '').toLowerCase();
      const r = (data.receiver || '').toLowerCase();
      const isEnc = !!data.is_encrypted;
      const normalPreviewText = isEnc ? null : (data.text || data.fileUrl || data.lastText || '');
      const unreadDelta = isEnc ? 0 : (s !== myId ? 1 : 0);
      const curTarget = (target || '').toLowerCase();
      const curTargetStripped = stripSecret(target).toLowerCase();
      const prevStripped = stripSecret(prevTargetRef.current).toLowerCase();

      // Stale handler — target already changed, skip in-chat processing
      if (curTarget && prevTargetRef.current && curTarget !== prevTargetRef.current) {
        const chatUser = s === myId ? r : s;
        setContacts(prev => upsertContact(prev, chatUser, {
          ...(normalPreviewText !== null ? { lastText: normalPreviewText } : {}),
          timestamp: data.timestamp || new Date().toISOString(),
          lastSender: data.sender,
          unreadCount: (prev.find(c => c.username.toLowerCase() === chatUser)?.unreadCount || 0) + unreadDelta,
          isLastMessageRead: false,
        }));
        return;
      }

      if (data.id && messagesRef.current.some(m => m.id === data.id)) return;

      const isOwnEcho = data.tempId && messagesRef.current.some(m => m.tempId === data.tempId);

      if (data.tempId && failedMessagesRef.current[data.tempId]) {
        messageRetryQueue.dequeue(data.tempId);
        setFailedMessages(prev => {
          const next = { ...prev };
          delete next[data.tempId!];
          return next;
        });
      }

      if (data.tempId && uploadingMessagesRef.current[data.tempId]) {
        setUploadingMessages(prev => {
          const next = { ...prev };
          const entry = next[data.tempId!];
          if (entry) {
            next[data.tempId!] = { fileName: entry.fileName, tempId: entry.tempId, completed: true };
          }
          return next;
        });
        setTimeout(() => {
          setUploadingMessages(prev => {
            const next = { ...prev };
            delete next[data.tempId!];
            return next;
          });
        }, 400);
      }

      const isCurrentChat = prevTargetRef.current && (
        (s === prevStripped && r === myId) ||
        (s === myId && r === prevStripped) ||
        (r.startsWith('room_') && r === prevStripped)
      );

      if (isCurrentChat) {
        const isCurrentSecretView = (prevTargetRef.current || '').startsWith(SECRET_PREFIX);
        const belongsToView = isCurrentSecretView ? !!data.is_encrypted && !data.e2ee_failed : !data.is_encrypted;
        if (!isOwnEcho && belongsToView) {
          addMessage(data);
          cacheMessages(curTarget, [...messagesRef.current, data]);
        }
        const c = msgContainerRef.current;
        if (c) {
          const nearBottom = c.scrollHeight - c.scrollTop - c.clientHeight < 500;
          if (s === myId || nearBottom) {
            setTimeout(() => scrollToBottom(), 50);
          }
        }
        updateContactPreview(curTargetStripped, {
          ...(normalPreviewText !== null ? { lastText: normalPreviewText } : {}),
          timestamp: data.timestamp || new Date().toISOString(),
          lastSender: data.sender,
          unreadCount: s !== myId ? 0 : undefined,
          isLastMessageRead: false,
        } as import('../types/user').ContactItem);
        if (s !== myId) {
          const isRoom = r.startsWith('room_');
          socket.emit('mark_read', { sender: isRoom ? r : data.sender, receiver: me, ...(isRoom ? { isRoom: true } : {}) });
        }
      } else {
        const chatUser = s === myId ? r : s;
        setContacts(prev => upsertContact(prev, chatUser, {
          ...(normalPreviewText !== null ? { lastText: normalPreviewText } : {}),
          timestamp: data.timestamp || new Date().toISOString(),
          lastSender: data.sender,
          unreadCount: (prev.find(c => c.username.toLowerCase() === chatUser)?.unreadCount || 0) + unreadDelta,
          isLastMessageRead: false,
        }));
      }

      if (s !== myId) {
        const vol = parseFloat(localStorage.getItem('4send_volume') || '1');
        if (vol > 0) {
          playNotificationSound(vol);
        } else if (navigator.vibrate) {
          navigator.vibrate([200, 100, 200]);
        }
        if (document.hidden) {
          const tTitle = document.title;
          document.title = t('🔔 Новое сообщение!');
          setTimeout(() => { document.title = tTitle; }, 3000);
        }
        if (data.text && /поздравл|дн.*рожден|happy.*birth|congrat|ура|🎉|🎊|🥳/i.test(data.text)) {
          setShowConfetti(true);
        }
      }
    };

    const onSearchResults = (data: unknown) => {
      let users: Array<{ username: string; displayName?: string; avatar?: string; isVerified?: boolean }> = [];
      let rooms: Array<{ roomId: string; name: string; avatar?: string; type?: string; isVerified?: boolean }> = [];

      if (Array.isArray(data)) {
        users = data;
      } else if (data && typeof data === 'object') {
        const d = data as Record<string, unknown>;
        users = (d.users || []) as typeof users;
        rooms = (d.rooms || []) as typeof rooms;
      }

      if (!users.length && !rooms.length) {
        setContacts([]);
        setIsServerSearchResults(true);
        return;
      }

      const results: import('../types/user').ContactItem[] = [
        ...users.map(u => ({
          username: u.username,
          displayName: u.displayName,
          avatar: u.avatar,
          isVerified: u.isVerified,
        })),
        ...rooms.map(r => ({
          username: r.roomId,
          displayName: r.name,
          avatar: r.avatar,
          isVerified: r.isVerified,
          isRoom: true as const,
          roomType: (r.type === 'channel' ? 'channel' : 'group') as 'group' | 'channel',
        })),
      ];

      setContacts(results);
      setIsServerSearchResults(true);
    };

    const onOnlineList = (list: string[]) => {
      setOnlineUsers(new Set(list.map(u => u.toLowerCase())));
    };

    const onUserStatusUpdate = (data: { username: string }) => {
      setOnlineUsers(prev => {
        const next = new Set(prev);
        next.delete(data.username.toLowerCase());
        return next;
      });
    };

    const onUserTyping = (data: { sender: string; receiver: string }) => {
      if (data.sender.toLowerCase() === (target || '').toLowerCase() && data.receiver.toLowerCase() === meLower) {
        setTypingUser(data.sender);
        setTimeout(() => setTypingUser(null), 3000);
      }
    };

    const onReactionsUpdate = (data: { msgId: string; reactions?: { emoji: string; count: number; users: string[] }[] }) => {
      if (data.reactions) {
        setMessages(prev => prev.map(m =>
          m.id === data.msgId ? { ...m, reactions: data.reactions } : m
        ));
      }
    };

    const onMessagesRead = (data: { sender: string; reader: string }) => {
      if (!data?.sender || !data?.reader) return;
      const senderLower = data.sender.toLowerCase();
      const readerLower = data.reader.toLowerCase();
      const openChat = (target || '').toLowerCase();

      if (readerLower === meLower) {
        setContacts(prev => updateContact(prev, senderLower, c => ({ ...c, isLastMessageRead: true, unreadCount: 0 })));
      }

      if (openChat && senderLower === meLower && openChat === readerLower) {
        setMessages(prev => prev.map(m =>
          (m.sender || '').toLowerCase() === meLower ? { ...m, is_read: true } : m
        ));
      }
    };

    const onMsgUpdated = (data: { id: string; text: string; is_edited?: boolean; sender?: string; receiver?: string }) => {
      setMessages(prev => {
        const updated = prev.map(m =>
          (m.id || m.tempId) === data.id
            ? { ...m, text: data.text, is_edited: data.is_edited !== false }
            : m
        );
        const msg = prev.find(m => (m.id || m.tempId) === data.id);
        if (msg) {
          const contactUser = (msg.sender || '').toLowerCase() === meLower
            ? msg.receiver?.toLowerCase()
            : msg.sender?.toLowerCase();
          if (contactUser) {
            setContacts(prevContacts => updateContact(prevContacts, contactUser, c => ({ ...c, lastText: data.text || c.lastText })));
          }
          const cacheKey = data.receiver || contactUser || target;
          if (cacheKey) cacheMessages(cacheKey, updated);
        }
        return updated;
      });
    };

    const onMsgDeleted = (data: { id: string; receiver?: string }) => {
      if (!data?.id) return;
      setDeletingMsgIds(prev => new Set(prev).add(data.id));
      setTimeout(() => {
        setMessages(prev => {
          const remaining = prev.filter(m => m.id !== data.id);
          const cacheKey = data.receiver || target;
          if (cacheKey) cacheMessages(cacheKey, remaining);
          if (remaining.length === 0) {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => { scrollToBottom(false, true); });
            });
          }
          return remaining;
        });
        setDeletingMsgIds(prev => { const next = new Set(prev); next.delete(data.id); return next; });
      }, 300);
    };

    const onErrorMessage = (data: { text?: string; tempId?: string }) => {
      if (data?.text) showToast(data.text, 'error');
      if (data?.tempId && !failedMessagesRef.current[data.tempId]) {
        const msg = messagesRef.current.find(m => m.tempId === data.tempId);
        if (msg) {
          setFailedMessages(prev => ({ ...prev, [data.tempId as string]: msg as Message }));
        }
      }
    };

    const onPinUpdate = (data: { messageId: string; text?: string; action: 'add' | 'remove'; chatId: string }) => {
      if (!target) return;
      const chatA = (data.chatId || '').toLowerCase();
      const chatB = stripSecret(target).toLowerCase();
      if (chatA !== chatB) return;
      if (data.action === 'remove') {
        setPinnedMessage(prev => {
          const next = prev.filter(p => p.id !== data.messageId);
          cachePin(target.toLowerCase(), next.length > 0 ? next : null);
          return next;
        });
      } else {
        const msg = messagesRef.current.find(m => m.id === data.messageId);
        const mediaType = msg ? getPinnedMediaType(msg) : undefined;
        const text = mediaType ? getPinnedMediaLabel(mediaType, t) : (data.text || '');
        setPinnedMessage(prev => {
          if (prev.some(p => p.id === data.messageId)) return prev;
          const next = [{ text, id: data.messageId, mediaType }, ...prev];
          cachePin(target.toLowerCase(), next);
          return next;
        });
      }
    };

    const onPrivacySync = (data: Record<string, Record<string, string> & { exceptions?: Record<string, string[]> }>) => {
      setPrivacyRegistry(data);
      if (me && data[me]) {
        const myPrivacy = data[me];
        const state: Record<string, 'all' | 'none' | 'selected'> = {
          avatar: (myPrivacy.avatar as 'all' | 'none' | 'selected') || 'all',
          bio: (myPrivacy.bio as 'all' | 'none' | 'selected') || 'all',
          status: (myPrivacy.status as 'all' | 'none' | 'selected') || 'all',
          messages: (myPrivacy.messages as 'all' | 'none' | 'selected') || 'all',
          calls: (myPrivacy.calls as 'all' | 'none' | 'selected') || 'all',
          voice_video: (myPrivacy.voice_video as 'all' | 'none' | 'selected') || 'all',
          forwards: (myPrivacy.forwards as 'all' | 'none' | 'selected') || 'all',
          search: (myPrivacy.search as 'all' | 'none' | 'selected') || 'all',
        };
        const exceptions: Record<string, string[]> = {
          avatar: myPrivacy.exceptions?.avatar || [],
          bio: myPrivacy.exceptions?.bio || [],
          status: myPrivacy.exceptions?.status || [],
          messages: myPrivacy.exceptions?.messages || [],
          calls: myPrivacy.exceptions?.calls || [],
          voice_video: myPrivacy.exceptions?.voice_video || [],
          forwards: myPrivacy.exceptions?.forwards || [],
          search: myPrivacy.exceptions?.search || [],
        };
        setAllPrivacy(state, exceptions);
      }
    };

    const onUpdateChatList = () => {
      loadChats();
    };

    const onRoomEvent = () => {
      loadChats();
    };

    const onCallIncoming = (data: { caller: string; withVideo?: boolean; ringFile?: string }) => {
      if (!data?.caller) return;
      if (callStateRef.current && callStateRef.current.type !== 'ended') {
        const socket = getSocket();
        socket.emit('call_response', { target: data.caller, answer: 'busy' });
        return;
      }
      const contact = contacts.find(c => c.username.toLowerCase() === data.caller.toLowerCase());
      setCallState({
        type: 'incoming',
        peer: data.caller,
        peerDisplay: contact?.displayName || data.caller,
        peerAvatar: contact?.avatar,
        withVideo: data.withVideo ?? false
      });
    };

    const onCallAnswered = (data: { answer: string }) => {
      if (!data?.answer) return;
      if (data.answer === 'accepted') {
        if (callStateRef.current?.type === 'outgoing') {
          setCallState(prev => prev ? { ...prev, type: 'active' } : null);
        }
      } else if (data.answer === 'rejected' || data.answer === 'busy') {
        if (callStateRef.current?.type === 'outgoing') {
          setCallState(null);
        }
      }
    };

    const onCallEnded = () => {
      if (callStateRef.current) {
        setCallState(prev => prev ? { ...prev, type: 'ended' } : null);
      }
    };

    const onCallTaken = () => {
      setCallState(prev => (prev && prev.type === 'incoming') ? null : prev);
    };

    const onCallError = (data: { reason?: string }) => {
      if (data?.reason === 'busy') {
        setCallState(prev => prev ? { ...prev, type: 'ended' } : null);
      } else if (data?.reason === 'privacy') {
        setCallState(null);
      }
    };

    const onWebrtcSignal = (data: { sender: string; signal: any }) => {
      if (!data?.signal) return;
      const peer = (callStateRef.current?.peer || '').toLowerCase();
      if (data.sender.toLowerCase() !== peer) return;
      setCallState(prev => prev ? { ...prev, signals: [...(prev.signals || []), data.signal] } : null);
    };

    const onFileOffer = (data: { sender: string; fileName: string; fileSize: number; sdp: any }) => {
      if (!data?.sender || !data?.sdp) return;
      if (p2pRef.current.state.status !== 'idle') return;
      p2pRef.current.handleIncomingOffer(data);
      setShowP2PTransfer(true);
    };

    const onFileAnswer = (data: { sdp: any }) => {
      if (!data?.sdp) return;
      p2pRef.current.handleAnswer(data);
    };

    const onFileIceCandidate = (data: { sender: string; candidate: any }) => {
      if (!data?.candidate) return;
      p2pRef.current.handleIceCandidate(data);
    };

    const onFileCancel = (data?: { reason?: string }) => {
      p2pRef.current.handleCancel(data?.reason);
    };

    const onFileTransferComplete = () => {};

    socket.on('new_message', onNewMessage);
    socket.on('search_results', onSearchResults);
    socket.on('online_list', onOnlineList);
    socket.on('user_status_update', onUserStatusUpdate);
    socket.on('is_typing', onUserTyping);
    socket.on('update_msg_reactions', onReactionsUpdate);
    socket.on('messages_read', onMessagesRead);
    socket.on('msg_updated', onMsgUpdated);
    socket.on('msg_deleted', onMsgDeleted);
    socket.on('error_message', onErrorMessage);
    socket.on('pin_update', onPinUpdate);
    socket.on('privacy_sync', onPrivacySync);
    socket.on('update_chat_list', onUpdateChatList);
    socket.on('room_joined', onRoomEvent);
    socket.on('member_removed', onRoomEvent);
    socket.on('member_added', onRoomEvent);
    socket.on('join_requested', onRoomEvent);
    socket.on('call_incoming', onCallIncoming);
    socket.on('call_answered', onCallAnswered);
    socket.on('call_ended', onCallEnded);
    socket.on('call_taken', onCallTaken);
    socket.on('call_error', onCallError);
    socket.on('webrtc_signal', onWebrtcSignal);
    socket.on('file_offer', onFileOffer);
    socket.on('file_answer', onFileAnswer);
    socket.on('file_ice_candidate', onFileIceCandidate);
    socket.on('file_cancel', onFileCancel);
    socket.on('file_transfer_complete', onFileTransferComplete);

    return () => {
      socket.off('connect');
      socket.off('new_message', onNewMessage);
      socket.off('search_results', onSearchResults);
      socket.off('online_list', onOnlineList);
      socket.off('user_status_update', onUserStatusUpdate);
      socket.off('is_typing', onUserTyping);
      socket.off('update_msg_reactions', onReactionsUpdate);
      socket.off('messages_read', onMessagesRead);
      socket.off('msg_updated', onMsgUpdated);
      socket.off('msg_deleted', onMsgDeleted);
      socket.off('error_message', onErrorMessage);
      socket.off('pin_update', onPinUpdate);
      socket.off('privacy_sync', onPrivacySync);
      socket.off('update_chat_list', onUpdateChatList);
      socket.off('room_joined', onRoomEvent);
      socket.off('member_removed', onRoomEvent);
      socket.off('member_added', onRoomEvent);
      socket.off('join_requested', onRoomEvent);
      socket.off('call_incoming', onCallIncoming);
      socket.off('call_answered', onCallAnswered);
      socket.off('call_ended', onCallEnded);
      socket.off('call_taken', onCallTaken);
      socket.off('call_error', onCallError);
      socket.off('webrtc_signal', onWebrtcSignal);
      socket.off('file_offer', onFileOffer);
      socket.off('file_answer', onFileAnswer);
      socket.off('file_ice_candidate', onFileIceCandidate);
      socket.off('file_cancel', onFileCancel);
      socket.off('file_transfer_complete', onFileTransferComplete);
    };
  }, [meLower, target, me, addMessage, cacheMessages, scrollToBottom, setContacts, setOnlineUsers, updateContactPreview, setAllPrivacy]);

  useEffect(() => {
    if (!me) return;
    const socket = getSocket();
    socket.emit('join', me);
    socket.emit('request_privacy_sync');
    loadAuth();
    loadChats();
    const params = new URLSearchParams(window.location.search);
    const joinParam = params.get('join');
    if (joinParam) {
      const roomId = joinParam.startsWith('room_') ? joinParam : `room_${joinParam}`;
      setPreviewRoomId(roomId);
    }
  }, [me, loadChats, isUnlocked, loadAuth]);

  useEffect(() => {
    const total = Object.values(unreadCounts).reduce((sum, c) => sum + c, 0);
    try { navigator.setAppBadge?.(total); } catch {}
  }, [unreadCounts]);

  useEffect(() => {
    const onPop = () => {
      if (window.innerWidth > 768) return;
      const state = window.history.state;
      if (!state?.chatOpen && target) {
        setTarget(null);
        prevTargetRef.current = null;
        setShowScrollBtn(false);
        setShowProfileModal(false);
        setProfileData(null);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [target]);

  useHotkeys({
    send_message: handleSend,
    search_chats: () => {
      if (showSearchBar) setShowSearchBar(false);
      requestAnimationFrame(() => searchInputRef.current?.focus());
    },
    search_messages: () => setShowSearchBar(prev => !prev),
    edit_last: () => {
      if (!messageText.trim()) {
        const myLast = [...messagesRef.current].reverse().find(m => (m.sender || '').toLowerCase() === meLower);
        if (myLast?.text) {
          textareaRef.current?.focus();
          setEditingMsgId(myLast.id || null);
          setEditingMsgText(myLast.text);
          setMessageText(myLast.text);
          setCharCount(myLast.text.length);
        }
      }
    },
    next_result: () => setCurrentSearchIndex(prev => Math.min(prev + 1, chatSearchResults.length - 1)),
    prev_result: () => setCurrentSearchIndex(prev => Math.max(prev - 1, 0)),
    scroll_bottom: () => scrollToBottom(),
    reply_last: () => {
      const otherMsg = [...messagesRef.current].reverse().find(m => (m.sender || '').toLowerCase() !== meLower);
      if (otherMsg?.text) {
        textareaRef.current?.focus();
        setReplyText(otherMsg.text.slice(0, 200));
        setReplyMsgId(otherMsg.id || null);
      }
    },
  });

  useEffect(() => {
    const file = getSharedFile();
    if (!file) return;
    if (!target) {
      showToast(t('Выберите чат для отправки файла'));
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setShowFileLimit(true);
      return;
    }
    if (file.type.startsWith('image/') && file.size < 20 * 1024 * 1024) {
      setMediaEditorFile(file);
      setShowMediaEditor(true);
    } else {
      setPreviewFile(file);
      setShowFilePreview(true);
    }
  }, [target, showToast, t]);

  const refreshChatHeader = useCallback((username: string) => {
    if (username.toLowerCase() === meLower) {
      setChatName(t('Избранное'));
      setChatAvatar('');
      setChatVerified(false);
      setChatStatus(t('сохранённые сообщения'));
      setChatStatusColor('#888');
      return;
    }
    const contact = contacts.find(c => c.username.toLowerCase() === username.toLowerCase());
    if (!contact) return;
    setChatName(contact.displayName || contact.username);
    setChatAvatar(contact.avatar || '');
    setChatVerified(!!contact.isVerified);
    if (username === '4send_system' || username === '4send_help') {
      setChatName(username === '4send_system' ? t('Системные уведомления') : t('Поддержка 4SEND'));
      setChatAvatar('/ico.png');
      setChatVerified(true);
      setChatStatus(t('системный бот'));
      setChatStatusColor('#888');
    } else if (contact.isRoom) {
      if (contact.memberCount !== undefined) {
        setChatStatus(contact.roomType === 'channel'
          ? `${contact.memberCount} ${t('подписчиков')}`
          : `${contact.memberCount} ${t('участников')}`);
      } else {
        setChatStatus(contact.roomType === 'channel' ? t('Канал') : t('Группа'));
      }
      setChatStatusColor('#888');
    } else if (onlineUsers.has(username.toLowerCase()) || contact.isOnline) {
      setChatStatus(t('в сети'));
      setChatStatusColor('#4caf50');
    } else if (contact.last_seen) {
      const lastDate = new Date(contact.last_seen);
      if (!isNaN(lastDate.getTime())) {
        const isToday = lastDate.toDateString() === new Date().toDateString();
        const timeStr = lastDate.toLocaleTimeString(globalLocale(), { hour: '2-digit', minute: '2-digit' });
        setChatStatus(isToday ? `${t('был(а)')} ${t('в')} ${timeStr}` : `${t('был(а)')} ${lastDate.toLocaleDateString(globalLocale(), { day: 'numeric', month: 'long' })} ${t('в')} ${timeStr}`);
      } else {
        setChatStatus(t('был(а) недавно'));
      }
      setChatStatusColor('#888');
    } else {
      setChatStatus(t('был(а) недавно'));
      setChatStatusColor('#888');
    }
  }, [contacts, onlineUsers, t, meLower]);

  useEffect(() => {
    if (!target) return;
    const contact = contacts.find(c => c.username.toLowerCase() === target.toLowerCase());
    if (contact) {
      refreshChatHeader(target);
    }
  }, [target, contacts, refreshChatHeader]);

  useEffect(() => {
    if (!showConfetti) return;
    const t = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(t);
  }, [showConfetti]);

  useEffect(() => {
    if (scheduledMessages.length === 0 || !me) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    scheduledMessages.forEach(sched => {
      const chat = sched.chat;
      if (!chat) return;
      const sendAt = sched.sendAt instanceof Date ? sched.sendAt : new Date(sched.sendAt);
      const delay = sendAt.getTime() - Date.now();
      const doSend = async () => {
        const socket = getSocket();
        const e2eeFields = chat.startsWith(SECRET_PREFIX) ? await prepareOutgoing(sched.text, chat) : {};
        socket.emit('chat_message', { sender: me, receiver: stripSecret(chat), text: e2eeFields.is_encrypted ? '' : sched.text, timestamp: new Date().toISOString(), ...e2eeFields });
        setScheduledMessages(prev => prev.filter(m => m.id !== sched.id));
        loadChats();
      };
      if (delay <= 0) {
        doSend();
      } else {
        const timer = setTimeout(doSend, delay);
        timers.push(timer);
      }
    });
    return () => timers.forEach(t => clearTimeout(t));
  }, [scheduledMessages, me, loadChats]);

  useEffect(() => {
    try { localStorage.setItem('4send_scheduled', JSON.stringify(scheduledMessages)); } catch {}
  }, [scheduledMessages]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('4send_scheduled');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setScheduledMessages(parsed
          .filter((m: { id?: string; text?: string; sendAt?: string; chat?: string }) => m && m.id && m.text && m.sendAt && m.chat)
          .map((m: { id: string; text: string; sendAt: string; chat: string }) => ({ id: m.id, text: m.text, sendAt: new Date(m.sendAt), chat: m.chat })));
      }
    } catch {}
  }, []);

  const searchMessages = useMessageSearch(messages);

  useEffect(() => {
    if (!chatSearchQuery.trim()) {
      setChatSearchResults([]);
      setCurrentSearchIndex(0);
      return;
    }
    const matched = searchMessages(chatSearchQuery);
    setChatSearchResults(matched);
    setCurrentSearchIndex(matched.length > 0 ? 0 : -1);
  }, [chatSearchQuery, searchMessages]);

  useEffect(() => {
    if (chatSearchResults.length === 0 || currentSearchIndex < 0) return;
    const msgId = chatSearchResults[currentSearchIndex];
    if (!msgId) return;
    const el = msgContainerRef.current?.querySelector(`[data-msg-id="${msgId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [chatSearchResults, currentSearchIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const isModalOpen = document.querySelector('[class*="overlay"]');
        if (isModalOpen) return;
        if (contextMenu) { closeContextMenu(); return; }
        if (chatContextMenu) { closeChatContextMenu(); return; }
        if (target) {
          setTarget(null);
          prevTargetRef.current = null;
          setShowScrollBtn(false);
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [target, setTarget, contextMenu, chatContextMenu, closeContextMenu, closeChatContextMenu]);

  const handleScrollToReply = useCallback((replyId: string) => {
    const el = msgContainerRef.current?.querySelector(`[data-msg-id="${replyId}"]`) || document.getElementById(`msg-${replyId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setHighlightedMsgId(replyId);
    if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = window.setTimeout(() => setHighlightedMsgId(null), 1200);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!target) return;
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0]!;
      if (file.size > 25 * 1024 * 1024) {
        setShowFileLimit(true);
        return;
      }
      if (file.type.startsWith('image/') && file.size < 20 * 1024 * 1024) {
        setMediaEditorFile(file);
        setShowMediaEditor(true);
      } else {
        setPreviewFile(file);
        setShowFilePreview(true);
      }
    }
  }, [target]);

  const handleRetry = useCallback((messageId: string) => {
    const entry = messageRetryQueue.get(messageId);
    if (!entry) return;
    const socket = getSocket();
    const msgData = entry.message;
    messageRetryQueue.retry(messageId, () => {
      return new Promise<void>(async (resolve, reject) => {
        const e2eeFields = msgData.receiver ? await prepareOutgoing(msgData.text || '', msgData.receiver) : {};
        const emitData = { ...msgData, ...e2eeFields };
        if (e2eeFields.is_encrypted) emitData.text = '';
        socket.emit('chat_message', emitData, (response: unknown) => {
          if (response && typeof response === 'object' && (response as { error?: string }).error) {
            reject(new Error((response as { error: string }).error));
          } else {
            resolve();
          }
        });
        setTimeout(() => resolve(), 2000);
      });
    }).then(success => {
      if (success) {
        setFailedMessages(prev => {
          const next = { ...prev };
          delete next[messageId];
          return next;
        });
      }
    });
  }, []);

  const handleRemoveFailed = useCallback((messageId: string) => {
    messageRetryQueue.dequeue(messageId);
    setFailedMessages(prev => {
      const next = { ...prev };
      delete next[messageId];
      return next;
    });
  }, []);

  const handleToggleArchive = useCallback(async () => {
    if (viewingArchive) {
      setViewingArchive(false);
      loadChats();
      return;
    }
    const cached = localStorage.getItem('4send_archive_has_password');
    if (cached === '1') {
      setShowArchiveUnlock(true);
      return;
    }
    try {
      const res = await api.get<{ hasPassword: boolean }>('/api/archive/password/status');
      if (res.hasPassword) {
        localStorage.setItem('4send_archive_has_password', '1');
        setShowArchiveUnlock(true);
      } else {
        localStorage.removeItem('4send_archive_has_password');
        setViewingArchive(true);
        loadChats();
      }
    } catch {
      setViewingArchive(true);
      loadChats();
    }
  }, [viewingArchive, loadChats]);

  const handleArchiveUnlockSuccess = useCallback(() => {
    setShowArchiveUnlock(false);
    setViewingArchive(true);
    loadChats();
  }, [loadChats]);

  const renderDateSeparator = (ts: Date | string): string | null => {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return null;
    const label = d.toDateString() === new Date().toDateString()
      ? t('Сегодня')
      : d.toLocaleDateString([], { day: 'numeric', month: 'long' });
    return label;
  };

  const getInitial = (name: string) => name?.charAt(0)?.toUpperCase() || '?';

  return (
    <div
      className={styles.mainApp}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <SettingsDrawer isOpen={showDrawer} onClose={() => setShowDrawer(false)} onOpenSettings={() => { setShowSettingsModal(true); }} onOpenSecurity={() => setShowSecurityModal(true)} onOpenChatSettings={() => setShowChatSettingsModal(true)} onOpenQR={() => setShowQRModal(true)} onToggleArchive={handleToggleArchive} viewingArchive={viewingArchive} onOpenLogout={() => setShowLogout(true)} onOpenHelpChat={() => { setShowDrawer(false); handleSelectChat('4send_help'); }} />

      <div className={`${styles.sidebar} ${chatSelected ? styles.sidebarHidden : ''}`}>
        {showSearchBar && chatSelected ? (
          <>
            <div className={styles.sidebarHeader}>
              <div className={styles.sidebarHeaderLeft}>
                <button className={styles.controlBtn} onClick={() => { setShowSearchBar(false); setChatSearchQuery(''); }}>
                  <ArrowBack />
                </button>
                <span className={styles.sidebarTitle} style={{ fontSize: 16, fontWeight: 600, background: 'none', WebkitTextFillColor: 'var(--accent-solid)' }}>{t('Поиск в чате')}</span>
              </div>
            </div>
            <div className={styles.searchWrapper}>
              <div className={`${styles.searchPlaceholder} ${searchFocused || chatSearchQuery ? styles.searchFocused : ''}`}>
                <Search />
                <span className={searchFocused || chatSearchQuery ? styles.searchTextHidden : ''}>{t('Поиск')}</span>
              </div>
              <input
                className={styles.searchInput}
                value={chatSearchQuery}
                onChange={e => setChatSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                autoFocus
              />
            </div>
            <ChatSearchPanel
              messages={messages}
              chatName={chatName || target || ''}
              chatAvatar={chatAvatar}
              query={chatSearchQuery}
              results={chatSearchResults}
              currentIndex={currentSearchIndex}
              onSelectResult={(i) => setCurrentSearchIndex(i)}
              onClose={() => { setShowSearchBar(false); setChatSearchQuery(''); }}
              onJumpTo={(msgId) => {
                const el = msgContainerRef.current?.querySelector(`[data-id="${msgId}"]`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
            />
          </>
        ) : (
          <>
            <div className={styles.sidebarHeader}>
              <div className={styles.sidebarHeaderLeft}>
                <button className={styles.controlBtn} onClick={() => setShowDrawer(true)}>
                  <Menu />
                </button>
                <span className={styles.sidebarTitle} onClick={() => { setTarget(null); prevTargetRef.current = null; setShowScrollBtn(false); }}>4SEND</span>
              </div>
              <button className={styles.controlBtn} title={t('Создать группу/канал')} onClick={() => setShowCreateGroup(true)}>
                <Plus />
              </button>
            </div>

            <div className={styles.searchWrapper}>
              <div className={`${styles.searchPlaceholder} ${searchFocused ? styles.searchFocused : ''}`}>
                <Search />
                <span className={searchFocused ? styles.searchTextHidden : ''}>{t('Поиск')}</span>
              </div>
              <input
                ref={searchInputRef}
                className={styles.searchInput}
                value={searchQuery}
                onChange={e => handleSearchInput(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => !searchQuery && setSearchFocused(false)}
              />
            </div>

            {isFoldersEnabled() && (
              <FolderBar
                activeFolderId={activeFolderId}
                onSelectFolder={setActiveFolderId}
                onEdit={() => setShowFolderEdit(true)}
              />
            )}

            <div className={styles.contactsList}>
              <ContactList
                e2eeSessions={e2eeSessions}
                onSelectChat={handleSelectChat}
                viewingArchive={viewingArchive}
                searchQuery={searchQuery}
                isSearchResults={isServerSearchResults}
                contextMenuUsername={chatContextMenu?.username}
                activeFolderId={activeFolderId}
                key={folderVersion}
                onChatContextMenu={(e, username) => {
                  e.preventDefault();
                  const contact = contacts.find(c => c.username.toLowerCase() === username.toLowerCase());
                   setChatContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    username,
                    isPinned: !!contact?.is_pinned,
                    isMuted: !!contact?.is_muted,
                    isArchived: !!contact?.is_archived,
                    isBlocked: !!contact?.i_blocked_him,
                  });
                }}
                onChatLongPress={(username, x, y) => {
                  const contact = contacts.find(c => c.username.toLowerCase() === username.toLowerCase());
                  setChatContextMenu({
                    x,
                    y,
                    username,
                    isPinned: !!contact?.is_pinned,
                    isMuted: !!contact?.is_muted,
                    isArchived: !!contact?.is_archived,
                    isBlocked: !!contact?.i_blocked_him,
                  });
                }}
              />
            </div>
          </>
        )}
      </div>

      <div className={styles.chatWindow}>
        {chatSelected ? (
          <>
            <div className={styles.topBarArea}>
              <ChatHeader
                target={target}
                me={me || ''}
                chatName={chatName}
                chatAvatar={chatAvatar}
                chatVerified={chatVerified}
                chatStatus={chatStatus}
                chatStatusColor={chatStatusColor}
                contacts={contacts}
                onlineUsers={onlineUsers}
                multiSelectMode={multiSelectMode}
                onBack={() => { if (window.innerWidth <= 768 && window.history.state?.chatOpen) { window.history.back(); } else { setTarget(null); prevTargetRef.current = null; setShowProfileModal(false); setProfileData(null); } }}
                onProfileOpen={() => {
                  if (target) {
                    const realTarget = stripSecret(target);
                    const isRoom = realTarget.startsWith('room_');
                    const c = contacts.find(x => x.username.toLowerCase() === realTarget.toLowerCase());
                    setProfileData({
                      username: realTarget,
                      displayName: c?.displayName || chatName,
                      avatar: c?.avatar || chatAvatar,
                      lastSeen: c?.last_seen ? new Date(c.last_seen).toISOString() : undefined,
                      isOnline: isRoom ? false : onlineUsers.has(realTarget.toLowerCase()),
                      isVerified: chatVerified,
                      isRoom,
                      roomType: isRoom ? (c?.roomType || 'group') : undefined,
                      roomDescription: isRoom ? roomDescription : undefined,
                    });
                    setShowProfileModal(true);
                  }
                }}
                onSearchToggle={() => { setShowSearchBar(!showSearchBar); if (showSearchBar) setChatSearchQuery(''); }}
                onCall={async (t, displayName, avatar) => { await startOutgoingCall(false, displayName, avatar); }}
                onVideoCall={async (t, displayName, avatar) => { await startOutgoingCall(true, displayName, avatar); }}
                onMenuOpen={() => setShowChatHeaderMenu(!showChatHeaderMenu)}
                getInitial={getInitial}
                styles={styles}
                hasE2EESession={!!target && target.startsWith(SECRET_PREFIX)}
              />
            <MultiSelectBar count={selectedMsgIds.size} onDelete={handleMultiDelete} onForward={handleMultiForward} onCancel={handleMultiSelectCancel} visible={multiSelectMode} />
          </div>

            <PinnedBar
              pinnedMessage={pinnedMessage}
              onScrollTo={handleScrollToReply}
              onUnpin={(msgId: string) => {
                const socket = getSocket();
                socket.emit('unpin_request', { messageId: msgId, chatId: stripSecret(target).toLowerCase() });
                setPinnedMessage(prev => {
                  const next = prev.filter(p => p.id !== msgId);
                  cachePin(target.toLowerCase(), next.length > 0 ? next : null);
                  return next;
                });
              }}
              styles={styles}
            />

            <div className={styles.messageContainer} ref={msgContainerRef}>
              <div className={styles.messagesContent} ref={messagesContentRef}>
              {isLoadingMore && (
                <div className={styles.loadMoreIndicator}>
                  <div className={styles.loadMoreSpinner} />
                  {t('Загрузка...')}
                </div>
              )}
              {messages.map((msg, i) => {
                const prevMsg = i > 0 ? messages[i - 1] : null;
                const prevDate = prevMsg ? new Date(prevMsg.timestamp).toDateString() : '';
                const curDate = new Date(msg.timestamp).toDateString();
                const showSep = curDate !== prevDate;
                const isCtxHighlighted = highlightedMsgId && (msg.id === highlightedMsgId || msg.tempId === highlightedMsgId);
                return (
                  <div key={msg.id || msg.tempId || i} id={`msg-${msg.id}`} data-msg-id={msg.id}>
                    <MessageBubble
                      message={msg}
                      showDateSeparator={showSep}
                      isHighlighted={!!isCtxHighlighted}
                      isSelected={selectedMsgIds.has(msg.id || msg.tempId || '')}
                      multiSelectActive={multiSelectMode}
                      isDeleting={deletingMsgIds.has(msg.id || msg.tempId || '')}
                      isSaved={!!(target && (target.toLowerCase() === (me || '').toLowerCase() || target === '4send_system' || target === '4send_help'))}
                      copyRestricted={copyRestricted}
                      onClick={multiSelectMode ? (m) => toggleMultiSelect(m.id || m.tempId || '') : undefined}
                      onContextMenu={handleContextMenu}
                      onLongPress={handleLongPress}
                      onDoubleClick={(m) => { handleDoubleClickMsg(m); }}
                      onReact={handleReact}
                      onOpenLightbox={(url) => setLightboxSrc(url)}
                      onScrollToReply={handleScrollToReply}
                      onReply={handleReply}
                    />
                  </div>
                );
              })}
              {Object.entries(uploadingMessages).map(([tempId, entry]) => (
                <div key={tempId}>
                  <UploadingBubble fileName={entry.fileName} completed={entry.completed} />
                </div>
              ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className={styles.chatHeaderHidden} />
            <div className={styles.messageContainer}>
              <div className={styles.emptyChat} data-anim-preserve>
                <div className={styles.emptyChatInner}>
                  <RoundedChatBubble className={styles.emptyChatIcon} />
                  <div className={styles.emptyChatTitle}>{t('Выберите чат')}</div>
                  <div className={styles.emptyChatSub}>{t('для начала общения')}</div>
                </div>
              </div>
            </div>
          </>
        )}

        {chatSelected && (
          <div className={`${styles.replyBar} ${(replyText && replyMsgId) ? '' : styles.hidden}`}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: 'var(--accent-solid)', fontWeight: 600, fontSize: 13 }}>{t('Ответ на:')}</div>
              <div className={styles.replyText}>{replyText}</div>
            </div>
            <button className={styles.replyClose} onClick={() => { setReplyText(null); setReplyMsgId(null); }}>✕</button>
          </div>
        )}

        {chatSelected && scheduledMessages.length > 0 && (
          <div
            onClick={() => setShowScheduledList(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, margin: '4px 12px 0', padding: '6px 10px',
              borderRadius: 12, cursor: 'pointer', background: 'rgba(167,79,255,0.12)',
              border: '1px solid rgba(167,79,255,0.3)', color: 'var(--accent-solid)', fontSize: 13, fontWeight: 600,
              width: 'fit-content', maxWidth: 'calc(100% - 24px)'
            }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style={{ flexShrink: 0 }}><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('Отложенные сообщения')} · {scheduledMessages.length}</span>
          </div>
        )}

        {chatSelected && (
          (target === '4send_system') ? (
            <div className={styles.bottomBar}>
              <div className={styles.inputArea} style={{ opacity: 0.5 }}>
                <div className={styles.textareaWrapper}>
                  <textarea
                    className={styles.messageTextarea}
                    placeholder={t('Системный бот')}
                    rows={1}
                    disabled
                  />
                </div>
              </div>
              <div className={styles.actionBtn} style={{ opacity: 0.5, pointerEvents: 'none' }}>
                <button className={`${styles.micSendBtn} ${styles.micMode}`}>
                  <div className={styles.micIcon}><Mic /></div>
                </button>
              </div>
            </div>
          ) : isChatBlocked ? (
            <div className={styles.bottomBar}>
              <div className={styles.inputArea} style={{ opacity: 0.5 }}>
                <div className={styles.textareaWrapper}>
                  <textarea
                    className={styles.messageTextarea}
                    placeholder={t('Отправка сообщений ограничена')}
                    rows={1}
                    disabled
                  />
                </div>
              </div>
              <div className={styles.actionBtn} style={{ opacity: 0.5, pointerEvents: 'none' }}>
                <button className={`${styles.micSendBtn} ${styles.micMode}`}>
                  <div className={styles.micIcon}><Mic /></div>
                </button>
              </div>
            </div>
          ) : (
          <div className={styles.bottomBar}>
            <input type="file" ref={fileInputRef} hidden onChange={handleFileChange} />

            <div className={`${styles.inputArea} ${editingMsgId ? styles.editing : ''}`}>
              <button className={styles.fileBtn} onClick={handleAttachClick} style={{ display: (target && target.startsWith(SECRET_PREFIX)) ? 'none' : undefined }}>
                <Attach />
              </button>

              <div className={styles.textareaWrapper}>
                <textarea
                  ref={textareaRef}
                  className={styles.messageTextarea}
                  placeholder={editingMsgId ? t('Редактировать...') : t('Написать...')}
                  rows={1}
                  value={messageText}
                  onChange={handleTextChange}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  enterKeyHint="send"
                />
                <div className={`${styles.charCounter} ${charCount > 500 ? styles.visible : ''} ${charCount >= 1000 ? styles.danger : charCount > 800 ? styles.warning : ''}`}>
                  {charCount}/1000
                </div>
                {mentionQuery !== null && filteredMembers.length > 0 && (
                  <div ref={mentionListRef} className={styles.mentionList}>
                    {filteredMembers.map((m, i) => (
                      <div
                        key={m.username}
                        className={`${styles.mentionItem} ${i === mentionIndex ? styles.mentionActive : ''}`}
                        onMouseEnter={() => setMentionIndex(i)}
                        onMouseDown={(e) => { e.preventDefault(); applyMention(m.username); }}
                      >
                        {m.avatar ? <img src={m.avatar} alt="" className={styles.mentionAvatar} /> : <div className={styles.mentionAvatarPlaceholder}>{m.displayName?.charAt(0)?.toUpperCase() || m.username.charAt(0).toUpperCase()}</div>}
                        <span className={styles.mentionName}>{m.displayName || m.username}</span>
                        <span className={styles.mentionUser}>@{m.username}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button ref={emojiBtnRef} className={`${styles.emojiBtn} ${showEmojiPanel ? styles.emojiBtnActive : ''}`} onClick={() => { if (showEmojiPanel) { setEmojiClosing(true); } else { setEmojiSourceRect(emojiBtnRef.current?.getBoundingClientRect() || null); setShowEmojiPanel(true); setEmojiClosing(false); } }}>
                <Emoji />
              </button>
              {!(target || '').startsWith(SECRET_PREFIX) && (
                <button className={styles.aiBtn} onClick={() => setShowAiRewriteModal(true)}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                    <path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z"/>
                  </svg>
                </button>
              )}
            </div>

            <div className={styles.actionBtn}>
              <button
                className={`${styles.micSendBtn} ${messageText.trim() ? styles.sendMode : styles.micMode} ${isRecording ? styles.recordingActive : ''}`}
                onClick={undefined}
                onContextMenu={(e) => {
                  if (!messageText.trim()) return;
                  e.preventDefault();
                  const rect = e.currentTarget.getBoundingClientRect();
                  setSendOptionsPos({ bottom: window.innerHeight - rect.top + 12, right: 12 });
                  setShowSendOptions(true);
                }}
                onPointerDown={(e) => {
                  if (!messageText.trim()) {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
                    longPressTriggeredRef.current = false;
                    if (!isRecording) {
                      longPressTimerRef.current = setTimeout(() => {
                        longPressTriggeredRef.current = true;
                        setIsRecording(true);
                        setIsRecordingLocked(false);
                      }, 300);
                    }
                  } else {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
                    longPressTriggeredRef.current = false;
                    longPressTimerRef.current = setTimeout(() => {
                      longPressTriggeredRef.current = true;
                      const rect = e.currentTarget.getBoundingClientRect();
                      setSendOptionsPos({ bottom: window.innerHeight - rect.top + 12, right: 12 });
                      setShowSendOptions(true);
                    }, 500);
                  }
                }}
                onPointerMove={(e) => {
                  if (!pointerDownPosRef.current) return;
                  if (messageText.trim()) {
                    const dx = Math.abs(e.clientX - pointerDownPosRef.current.x);
                    const dy = Math.abs(e.clientY - pointerDownPosRef.current.y);
                    if (dx > 5 || dy > 5) {
                      if (longPressTimerRef.current) {
                        clearTimeout(longPressTimerRef.current);
                        longPressTimerRef.current = null;
                      }
                    }
                    return;
                  }
                  const dy = pointerDownPosRef.current.y - e.clientY;
                  if (dy > 30 && !isRecording) {
                    if (longPressTimerRef.current) {
                      clearTimeout(longPressTimerRef.current);
                      longPressTimerRef.current = null;
                    }
                    longPressTriggeredRef.current = true;
                    setIsRecording(true);
                    setIsRecordingLocked(false);
                  }
                  if (isRecording && !isRecordingLocked && dy > 50) {
                    setIsRecordingLocked(true);
                  }
                }}
                onPointerUp={() => {
                  if (longPressTimerRef.current) {
                    clearTimeout(longPressTimerRef.current);
                    longPressTimerRef.current = null;
                  }
                  if (messageText.trim()) {
                    if (!longPressTriggeredRef.current) {
                      handleSend();
                    }
                    pointerDownPosRef.current = null;
                    return;
                  }
                  if (!longPressTriggeredRef.current && !isRecording) {
                    const nextMode = recordingMode === 'audio' ? 'video' : 'audio';
                    if (nextMode === 'video') {
                      try {
                        navigator.mediaDevices.enumerateDevices().then(devices => {
                          const hasCam = devices.some(d => d.kind === 'videoinput');
                          if (!hasCam) {
                            showToast(t('Камера не найдена'), true);
                          } else {
                            setRecordingMode('video');
                          }
                        });
                      } catch {
                        showToast(t('Ошибка доступа к камере'), true);
                      }
                    } else {
                      setRecordingMode('audio');
                    }
                  }
                  pointerDownPosRef.current = null;
                }}
                onPointerLeave={() => {
                  if (longPressTimerRef.current) {
                    clearTimeout(longPressTimerRef.current);
                    longPressTimerRef.current = null;
                  }
                  pointerDownPosRef.current = null;
                }}
              >
                <div className={styles.micIcon}>
                  {recordingMode === 'audio' ? <Mic /> : (
                    <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ fill: 'transparent', transition: '0.2s' }}>
                      <rect x="4" y="4" width="16" height="16" rx="5" ry="5" />
                      <circle cx="12" cy="12" r="4" />
                    </svg>
                  )}
                </div>
                <div className={styles.sendIcon}>
                  <Send />
                </div>
              </button>
            </div>
          </div>
          )
        )}

        {chatSelected && Object.keys(failedMessages).length > 0 && (
          <div style={{ padding: '0 12px 8px' }}>
            {Object.entries(failedMessages).map(([id, msg]) => (
              <SendFailureIndicator
                key={id}
                messageId={id}
                onRetry={handleRetry}
                onRemove={handleRemoveFailed}
              />
            ))}
          </div>
        )}

        <div className={`${styles.dropZone} ${isDragging ? styles.active : ''}`}>
          <div className={styles.dropZoneContent}>
            <div className={styles.dropZoneIcon}>📂</div>
            <div className={styles.dropZoneTitle}>{t('Отпустите, чтобы отправить')}</div>
            <div className={styles.dropZoneSub}>{t('Картинки, музыка или документы')}</div>
          </div>
        </div>
      </div>

      {contextMenu && (
        <div className={`${styles.contextMenu} ${ctxMenuClosing ? styles.contextMenuClosing : ''}`} style={{ top: Math.min(contextMenu.y, window.innerHeight - 300), left: Math.min(contextMenu.x, window.innerWidth - 240), maxHeight: window.innerHeight - Math.min(contextMenu.y, window.innerHeight - 300) - 20 }}>
          <div className={styles.ctxReactions}>
            {['👍', '❤️', '😆', '😮', '😡'].map(emoji => (
              <button key={emoji} className={styles.ctxReactionBtn} onClick={() => {
                const socket = getSocket();
                const msgId = contextMenu.msg.id || contextMenu.msg.tempId || '';
                socket.emit('set_reaction', { msgId, emoji, receiver: contextMenu.msg.receiver || contextMenu.msg.sender });
                handleReact(msgId, emoji);
                const msgEl = document.querySelector(`[data-id="${msgId}"]`) as HTMLElement;
                playReactionParticles(msgEl, emoji, false);
                closeContextMenu();
              }}>{emoji}</button>
            ))}
          </div>
          <div className={styles.ctxMenuItem} onClick={handleReply}>
            <Forward className={styles.ctxMenuIcon} />
            {t('Ответить')}
          </div>
          {!copyRestricted && (
            <div className={styles.ctxMenuItem} onClick={handleCopyText}>
              <Copy className={styles.ctxMenuIcon} />
              {t('Копировать')}
            </div>
          )}
          {!copyRestricted && (
            <div className={styles.ctxMenuItem} onClick={handleForward}>
              <svg viewBox="0 0 24 24" className={styles.ctxMenuIcon}><path d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z" /></svg>
              {t('Переслать')}
            </div>
          )}
          {contextMenu.msg.fileUrl && (
            <div className={styles.ctxMenuItem} onClick={handleDownloadFile}>
              <svg viewBox="0 0 24 24" className={styles.ctxMenuIcon}><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" /></svg>
              {t('Скачать')}
            </div>
          )}
          {isStickerMsg() && (
            <div className={styles.ctxMenuItem} onClick={handleSaveSticker}>
              <svg viewBox="0 0 24 24" className={styles.ctxMenuIcon}><path d="M12 2L2 22h20L12 2zm0 3.83L18.17 19H5.83L12 5.83z" /></svg>
              {t('Сохранить в Стикеры')}
            </div>
          )}
          {isGifMsg() && (
            <div className={styles.ctxMenuItem} onClick={handleSaveGif}>
              <svg viewBox="0 0 24 24" className={styles.ctxMenuIcon}><path d="M19 19H5V5h14v14zM5 3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2H5zm6.5 10h-2v-2h2v2zm0-4h-2V7h2v2zm4 4h-2v-2h2v2zm0-4h-2V7h2v2z" /></svg>
              {t('Сохранить в GIF')}
            </div>
          )}
          {!copyRestricted && (
            <div className={styles.ctxMenuItem} onClick={handleSaveToFavorites}>
              <svg viewBox="0 0 24 24" className={styles.ctxMenuIcon}><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" /></svg>
              {t('В избранное')}
            </div>
          )}
          <div className={styles.ctxDivider} />
          {contextMenu.msg.id && (
            <>
              {pinnedMessage.some(p => p.id === contextMenu.msg.id) ? (
                <div className={styles.ctxMenuItem} onClick={() => {
                  const socket = getSocket();
                  const msgId = contextMenu.msg.id;
                  socket.emit('unpin_request', { messageId: msgId, chatId: stripSecret(target || '').toLowerCase() });
                  setPinnedMessage(prev => {
                    const next = prev.filter(p => p.id !== msgId);
                    cachePin((target || '').toLowerCase(), next.length > 0 ? next : null);
                    return next;
                  });
                  closeContextMenu();
                }}>
                  <svg viewBox="0 0 24 24" className={styles.ctxMenuIcon}><path d="M16 5h.99L17 3H7v2h1v7l-2 2v2h5v6l1 1 1-1v-6h5v-2l-2-2V5z" /></svg>
                  {t('Открепить')}
                </div>
              ) : (
                <div className={styles.ctxMenuItem} onClick={handlePin}>
                  <svg viewBox="0 0 24 24" className={styles.ctxMenuIcon}><path d="M16 5h.99L17 3H7v2h1v7l-2 2v2h5v6l1 1 1-1v-6h5v-2l-2-2V5z" /></svg>
                  {t('Закрепить')}
                </div>
              )}
            </>
          )}
          {!copyRestricted && (
            <div className={styles.ctxMenuItem} onClick={handleStartMultiSelect}>
              <svg viewBox="0 0 24 24" className={styles.ctxMenuIcon}><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" /></svg>
              {t('Выбрать')}
            </div>
          )}
          {(contextMenu.msg.sender || '').toLowerCase() === (me || '').toLowerCase() && (
            <>
              <div className={styles.ctxDivider} />
              {!/^📂\s/.test(contextMenu.msg.text || '') && !contextMenu.msg.isAudio && !contextMenu.msg.isVideoNote && (
                <div className={styles.ctxMenuItem} onClick={handleEdit}>
                  <svg viewBox="0 0 24 24" className={styles.ctxMenuIcon}><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" /></svg>
                  {t('Изменить')}
                </div>
              )}
              <div className={`${styles.ctxMenuItem} ${styles.ctxMenuDanger}`} onClick={handleDelete}>
                <svg viewBox="0 0 24 24" className={`${styles.ctxMenuIcon} ${styles.ctxMenuDangerIcon}`}><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
                {t('Удалить')}
              </div>
            </>
          )}
        </div>
      )}

      <div className={`${styles.scrollDownWrapper} ${showScrollBtn ? styles.visible : ''}`}>
        <button className={styles.scrollDownBtn} onClick={() => scrollToBottom()}>
          <svg viewBox="0 0 24 24">
            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
          </svg>
        </button>
      </div>

      {showEmojiPanel && chatSelected && (
        <Suspense fallback={null}>
          <EmojiPanel sourceRect={emojiSourceRect} closing={emojiClosing} onSelect={handleEmojiSelect} onClose={() => { setShowEmojiPanel(false); setEmojiClosing(false); }} />
        </Suspense>
      )}

      {showSettingsModal && (
        <SettingsModal onClose={() => setShowSettingsModal(false)} />
      )}

      {deleteChatTarget && (
        <DeleteChatModal
          chatName={deleteChatTarget.name}
          isSecret={deleteChatTarget.isSecret}
          onConfirm={confirmDeleteChat}
          onCancel={() => setDeleteChatTarget(null)}
        />
      )}

      <ForwardModal
        isOpen={showForwardModal}
        onClose={() => { setShowForwardModal(false); setForwardMsg(null); }}
        contacts={contacts}
        me={me || ''}
        onConfirm={confirmForward}
      />

      {chatContextMenu && (() => {
        const isSaved = chatContextMenu.username.toLowerCase() === meLower;
        const isSystem = chatContextMenu.username === '4send_system' || chatContextMenu.username === '4send_help';
        const ctxOrder = menuItems?.chat_ctx || ['pin', 'folder', 'archive', 'mute', 'block', 'delete_chat'];
        const currentFolder = getFolderForChat(chatContextMenu.username);
        const allFolders = getFolders();

        const handleFolderClick = () => setChatCtxFolderMenu(true);

        const handleFolderSelect = (folderId: string | null) => {
          if (folderId) {
            addChatToFolder(chatContextMenu.username, folderId);
          } else {
            removeChatFromFolder(chatContextMenu.username);
          }
          setFolderVersion(v => v + 1);
          closeChatContextMenu();
        };

        const ctxItems: Record<string, React.ReactNode> = {
          pin: <div key="pin" className={styles.ctxMenuItem} onClick={() => handleChatContextAction('pin', chatContextMenu.username)}>
            <svg viewBox="0 0 24 24" style={{ width: 18, fill: 'var(--accent-solid)' }}><path d="M16 5h.99L17 3H7v2h1v7l-2 2v2h5v6l1 1 1-1v-6h5v-2l-2-2V5z" /></svg>
            <span>{chatContextMenu.isPinned ? t('Открепить') : t('Закрепить')}</span>
          </div>,
          folder: !isSaved && isFoldersEnabled() ? <div key="folder" className={styles.ctxMenuItem} onClick={e => { e.stopPropagation(); handleFolderClick(); }}>
            <svg viewBox="0 0 24 24" style={{ width: 18, fill: 'var(--accent-solid)' }}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
            <span style={{ flex: 1 }}>{t('Папка')}</span>
            {currentFolder && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#888', fontSize: 13, background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: 6 }}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d={FOLDER_ICONS[currentFolder.icon] || ''} /></svg>
                {currentFolder.name}
              </span>
            )}
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
          </div> : null,
          archive: !isSaved ? <div key="archive" className={styles.ctxMenuItem} onClick={() => handleChatContextAction('archive', chatContextMenu.username)}>
            <svg viewBox="0 0 24 24" style={{ width: 18, fill: 'var(--accent-solid)' }}><path d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5L6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12.14l.82 1H5.12z" /></svg>
            <span>{chatContextMenu.isArchived ? t('Из архива') : t('Архивировать')}</span>
          </div> : null,
          mute: !isSaved ? <div key="mute" className={styles.ctxMenuItem} onClick={() => handleChatContextAction('mute', chatContextMenu.username)}>
            <svg viewBox="0 0 24 24" style={{ width: 18, fill: 'var(--accent-solid)' }}>
              {chatContextMenu.isMuted ? (
                <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
              ) : (
                <><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" /><path d="M4.41 2.86L3 4.27l16.73 16.73 1.41-1.41L4.41 2.86z" /></>
              )}
            </svg>
            <span>{chatContextMenu.isMuted ? t('Включить уведомления') : t('Выключить уведомления')}</span>
          </div> : null,
          block: !isSaved && !isSystem ? <div key="block" className={`${styles.ctxMenuItem} ${chatContextMenu.isBlocked ? '' : styles.ctxMenuDanger}`} onClick={() => handleChatContextAction('block', chatContextMenu.username)}>
            {chatContextMenu.isBlocked ? (
              <svg viewBox="0 0 24 24" style={{ width: 18, fill: '#4caf50' }}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
            ) : (
              <svg viewBox="0 0 24 24" style={{ width: 18, fill: '#ff4d4d' }}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1C19.37 8.45 20 10.15 20 12c0 4.42-3.58 8-8 8z" /></svg>
            )}
            <span>{chatContextMenu.isBlocked ? t('Разблокировать') : t('Заблокировать')}</span>
          </div> : null,
          delete_chat: !isSaved ? <div key="delete_chat" className={`${styles.ctxMenuItem} ${styles.ctxMenuDanger}`} onClick={() => handleChatContextAction('delete', chatContextMenu.username)}>
            <svg viewBox="0 0 24 24" style={{ width: 18, fill: '#ff4d4d' }}><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
            <span>{t('Удалить чат')}</span>
          </div> : null,
        };

        if (chatCtxFolderMenu) {
          const folderItems: React.ReactNode[] = [
            <div key="back" className={styles.ctxMenuItem} onClick={e => { e.stopPropagation(); setChatCtxFolderMenu(false); }}>
              <svg viewBox="0 0 24 24" style={{ width: 18, fill: 'var(--accent-solid)' }}><polyline points="15 18 9 12 15 6" /></svg>
              <span>{t('Назад')}</span>
            </div>,
            <div key="sep" style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 6px' }} />,
          ];
          if (allFolders.length === 0) {
            folderItems.push(
              <div key="empty" style={{ padding: '10px 14px', fontSize: 13, color: '#666', textAlign: 'center' }}>
                {t('Нет папок')}
              </div>
            );
          } else {
            if (currentFolder) {
              folderItems.push(
                <div key="remove" className={styles.ctxMenuItem} onClick={e => { e.stopPropagation(); handleFolderSelect(null); }}>
                  <svg viewBox="0 0 24 24" style={{ width: 18, fill: 'var(--accent-solid)' }}><path d="M12 5v14M5 12h14" /></svg>
                  <span>{t('Убрать из папки')}</span>
                </div>,
              );
            }
            for (const f of allFolders) {
              const isActive = currentFolder?.id === f.id;
              folderItems.push(
                <div key={f.id} className={styles.ctxMenuItem} style={{ color: isActive ? 'var(--accent-solid)' : undefined, background: isActive ? 'rgba(var(--accent-rgb), 0.08)' : undefined }} onClick={e => { e.stopPropagation(); handleFolderSelect(f.id); }}>
                  <span style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d={FOLDER_ICONS[f.icon] || FOLDER_ICONS[Object.keys(FOLDER_ICONS)[0]]} /></svg>
                  </span>
                  <span style={{ flex: 1 }}>{f.name}</span>
                  {isActive && (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--accent-solid)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  )}
                </div>,
              );
            }
          }
          return (
            <div className={`${styles.contextMenu} ${chatCtxMenuClosing ? styles.contextMenuClosing : ''}`} style={{ top: Math.min(chatContextMenu.y, window.innerHeight - 280), left: Math.min(chatContextMenu.x, window.innerWidth - 225), maxHeight: window.innerHeight - Math.min(chatContextMenu.y, window.innerHeight - 280) - 20, zIndex: 10001 }}>
              {folderItems}
            </div>
          );
        }

        let renderedDivider = false;
        const dividerEl = <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 6px' }} />;
        const rendered = ctxOrder.flatMap(id => {
          if ((id === 'block' || id === 'delete_chat') && !renderedDivider && ctxItems[id]) {
            renderedDivider = true;
            return [dividerEl, ctxItems[id]];
          }
          return ctxItems[id] ? [ctxItems[id]] : [];
        });
        return (
        <div className={`${styles.contextMenu} ${chatCtxMenuClosing ? styles.contextMenuClosing : ''}`} style={{ top: Math.min(chatContextMenu.y, window.innerHeight - 220), left: Math.min(chatContextMenu.x, window.innerWidth - 225), maxHeight: window.innerHeight - Math.min(chatContextMenu.y, window.innerHeight - 220) - 20, zIndex: 10001 }}>
          {rendered}
        </div>
        );
      })()}

      {showChatSettingsModal && (
        <ChatSettingsModal isOpen={showChatSettingsModal} onClose={() => setShowChatSettingsModal(false)} onOpenSubModal={(name) => { setShowChatSettingsModal(false); setActiveSubModal(name); }} />
      )}
      {activeSubModal === 'customization' && <CustomizationModal isOpen onClose={() => setActiveSubModal(null)} />}
      {activeSubModal === 'hotkeys' && <HotkeysModal isOpen onClose={() => setActiveSubModal(null)} />}
      {activeSubModal === 'sound' && <SoundSettingsModal isOpen onClose={() => setActiveSubModal(null)} />}
      {activeSubModal === 'notifRepeat' && <NotificationRepeatModal isOpen onClose={() => setActiveSubModal(null)} />}
      {activeSubModal === 'quickReaction' && <QuickReactionModal isOpen onClose={() => setActiveSubModal(null)} />}
      {activeSubModal === 'videoMessages' && <VideoMessageSettingsModal isOpen onClose={() => setActiveSubModal(null)} />}
      {activeSubModal === 'language' && <LanguageModal isOpen onClose={() => setActiveSubModal(null)} />}
      {showSecurityModal && (
        <SecurityModal isOpen={showSecurityModal} onClose={() => setShowSecurityModal(false)} onOpenSubModal={(name) => { setShowSecurityModal(false); if (name === 'deleteAccount') { setShowDeleteAccount(true); } else { setActiveSubModal(name); } }} />
      )}
      {activeSubModal === 'password' && <PasswordModal isOpen onClose={() => setActiveSubModal(null)} />}
      {activeSubModal === 'twoFactor' && <TwoFactorModal isOpen onClose={() => setActiveSubModal(null)} />}
      {activeSubModal === 'panicPassword' && <PanicPasswordModal isOpen onClose={() => setActiveSubModal(null)} />}
      {activeSubModal === 'autoLock' && <AutoLockModal isOpen onClose={() => setActiveSubModal(null)} />}
      {activeSubModal === 'encryption' && <EncryptionModal isOpen onClose={() => setActiveSubModal(null)} />}
      {activeSubModal === 'activeSessions' && <ActiveSessionsModal isOpen onClose={() => setActiveSubModal(null)} onBack={() => { setActiveSubModal(null); setShowSecurityModal(true); }} />}
      {activeSubModal === 'autoDelete' && <AutoDeleteModal isOpen onClose={() => setActiveSubModal(null)} />}
      {activeSubModal === 'autoLogout' && <AutoLogoutModal isOpen onClose={() => setActiveSubModal(null)} />}
      {activeSubModal === 'privacy' && (
        <PrivacySettingsModal isOpen onClose={() => setActiveSubModal(null)} onSelectOption={(key, title) => { setActiveSubModal(null); setPrivacyOptionKey(key); setPrivacyOptionTitle(title); }} />
      )}
      {privacyOptionKey && (
        <PrivacyOptionModal isOpen onClose={() => { setPrivacyOptionKey(null); setPrivacyOptionTitle(''); }} optionKey={privacyOptionKey} optionTitle={privacyOptionTitle} onSelectExceptions={(key) => { setPrivacyOptionKey(null); setPrivacyOptionTitle(''); setPrivacyExceptionsKey(key); }} />
      )}
      {privacyExceptionsKey && (
        <PrivacyExceptionsModal isOpen onClose={() => setPrivacyExceptionsKey(null)} optionKey={privacyExceptionsKey} />
      )}
      {activeSubModal === 'dataStorage' && <DataStorageModal isOpen onClose={() => setActiveSubModal(null)} />}
      {activeSubModal === 'archive' && <ArchivePasswordModal isOpen onClose={() => setActiveSubModal(null)} mode="setup" />}
      {activeSubModal === 'exportData' && <ExportDataModal isOpen onClose={() => setActiveSubModal(null)} />}
      {activeSubModal === 'reportBug' && <ReportBugModal isOpen onClose={() => setActiveSubModal(null)} />}
      {activeSubModal === 'faq' && <FaqModal isOpen onClose={() => setActiveSubModal(null)} onContactSupport={() => { setActiveSubModal(null); handleSelectChat('4send_help'); }} />}
      {activeSubModal === 'about' && <AboutModal isOpen onClose={() => setActiveSubModal(null)} />}
      <ArchiveUnlockModal isOpen={showArchiveUnlock} onClose={() => setShowArchiveUnlock(false)} onSuccess={handleArchiveUnlockSuccess} />
      {showQRModal && (
        <QRModal
          isOpen
          onClose={() => setShowQRModal(false)}
          onScanResult={(text) => {
            try {
              const url = new URL(text);
              const join = url.searchParams.get('join');
              if (join) {
                if (join.startsWith('room_')) {
                  setPreviewRoomId(join);
                } else {
                  handleSelectChat(join);
                }
                return;
              }
            } catch {}
            const trimmed = text.trim().replace(/^@/, '');
            if (/^[a-z0-9_]+$/i.test(trimmed) && trimmed !== meLower) {
              handleSelectChat(trimmed);
            }
          }}
        />
      )}
      <ChatHeaderMenu
        isOpen={showChatHeaderMenu}
        onClose={() => setShowChatHeaderMenu(false)}
        target={target || ''}
        me={me || ''}
        meLower={meLower}
        isMuted={contacts.find(c => c.username.toLowerCase() === (target || '').toLowerCase())?.is_muted || false}
        isBlocked={isChatBlocked}
        autoDeleteTimer={contacts.find(c => c.username.toLowerCase() === (target || '').toLowerCase())?.autoDeleteTimer || 0}
        isSystemBot={target === '4send_system' || target === '4send_help'}
        onMuteToggle={() => setContacts(prev => updateContact(prev, target || '', c => ({ ...c, is_muted: !c.is_muted })))}
        onBlockChange={(blocked) => { setIsChatBlocked(blocked); setContacts(prev => updateContact(prev, target || '', c => ({ ...c, i_blocked_him: blocked }))); }}
        onDeleteChat={() => setDeleteChatTarget({ username: target || '', name: chatName || target || '' })}
        onSearch={() => setShowSearchBar(true)}
        onE2EESecret={target?.startsWith(SECRET_PREFIX) ? undefined : () => setShowSecretChatModal(true)}
        onStats={() => setShowChatStats(true)}
        onAutoDelete={() => setShowChatAutoDelete(true)}
        onProfile={() => { setProfileData({ username: target || '', displayName: chatName, avatar: chatAvatar, isOnline: onlineUsers.has((target || '').toLowerCase()), isVerified: chatVerified }); setShowProfileModal(true); }}
        onMembers={() => setShowRoomSettings(true)}
        onClearHistory={() => { setMessages([]); clearCachedMessages(target || ''); }}
        showToast={showToast}
      />
      <VoiceRecorder isActive={isRecording} mode={recordingMode} locked={isRecordingLocked} onLockChange={setIsRecordingLocked} onCancel={() => { setIsRecording(false); setIsRecordingLocked(false); }} onSend={async (blob, mode) => {
        setIsRecording(false);
        setIsRecordingLocked(false);
        if (!target) return;
        const isVideo = mode === 'video';
        const ext = isVideo ? (blob.type.includes('mp4') ? 'mp4' : 'webm') : 'webm';
        const fileName = isVideo ? `video_${Date.now()}.${ext}` : 'voice.webm';
        const displayName = isVideo ? t('Видеосообщение') : t('Голосовое сообщение');
        const tempId = 'upload_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        setUploadingMessages(prev => ({ ...prev, [tempId]: { fileName: displayName, tempId } }));
        scrollToBottom();
        const formData = new FormData();
        formData.append('file', blob, fileName);
        formData.append('sender', me || '');
        formData.append('receiver', stripSecret(target));
        try {
          const res = await api.upload('/upload', formData) as { url?: string; error?: string };
          if (res.url) {
            const socket = getSocket();
            const e2eeFields = await prepareOutgoing('', stripSecret(target));
            socket.emit('chat_message', {
              sender: me, receiver: stripSecret(target), text: '', fileUrl: res.url, isAudio: !isVideo, isVideoNote: isVideo, fileName, timestamp: new Date().toISOString(),
              ...(timerSeconds > 0 && { expires_at: new Date(Date.now() + timerSeconds * 1000).toISOString() }),
              tempId,
              ...e2eeFields,
            });
            setTimerSeconds(0);
          } else {
            setUploadingMessages(prev => { const n = { ...prev }; delete n[tempId]; return n; });
            showToast(res.error || t('Ошибка загрузки'), true);
          }
        } catch {
          setUploadingMessages(prev => { const n = { ...prev }; delete n[tempId]; return n; });
          showToast(t('Ошибка загрузки'), true);
        }
      }} />
      {showSendOptions && sendOptionsPos && !showSendTimerMenu && !showSendScheduleMenu && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 19999 }} onClick={() => { if (!sendOptionsClosing) { setSendOptionsClosing(true); setTimeout(() => { setSendOptionsClosing(false); setShowSendOptions(false); }, 200); } }} />
          <style>{`[style*="z-index: 20000"]::-webkit-scrollbar { display: none; }`}</style>
          <div
            className={`${sendOptionsClosing ? styles.menuClosing : ''}`}
            style={{
              position: 'fixed', zIndex: 20000, width: 'max-content', minWidth: '220px', maxWidth: '90vw',
              background: 'rgba(25,25,30,0.85)', backdropFilter: 'blur(25px) saturate(180%)',
              WebkitBackdropFilter: 'blur(25px) saturate(180%)',
              borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 15px 40px rgba(0,0,0,0.6)', padding: '6px',
              display: 'flex', flexDirection: 'column',
              transformOrigin: 'bottom right',
              transform: 'translateZ(0)', willChange: 'transform, opacity',
              overflow: 'hidden', scrollbarWidth: 'none', msOverflowStyle: 'none',
              animation: sendOptionsClosing ? 'none' : `menuPopUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)`,
              bottom: `${sendOptionsPos.bottom}px`, right: `${sendOptionsPos.right}px`, top: 'auto', left: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={styles.sendOption}
              onClick={() => {
                setSendOptionsClosing(true);
                setTimeout(() => {
                  setSendOptionsClosing(false);
                  setShowSendOptions(false);
                  setShowSendTimerMenu(true);
                }, 200);
              }}
            >
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm0 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/></svg>
              <span>{t('Исчезающее сообщение')}</span>
            </div>
            <div
              className={styles.sendOption}
              onClick={() => {
                setSendOptionsClosing(true);
                setTimeout(() => {
                  setSendOptionsClosing(false);
                  setShowSendOptions(false);
                  setShowSendScheduleMenu(true);
                }, 200);
              }}
            >
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
              <span>{t('Запланировать сообщение')}</span>
            </div>
            {scheduledMessages.length > 0 && (
              <div
                className={styles.sendOption}
                onClick={() => { setShowSendOptions(false); setShowScheduledList(true); }}
              >
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-.5 15H11v-6h.5v6zm5-2H11v-1.5h5.5V15z"/></svg>
                <span>{t('Отложенные сообщения')} ({scheduledMessages.length})</span>
              </div>
            )}
          </div>
        </>
      )}
      {showSendTimerMenu && sendOptionsPos && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 19999 }} onClick={() => { if (!timerMenuClosing) { setTimerMenuClosing(true); setTimeout(() => { setTimerMenuClosing(false); setShowSendTimerMenu(false); }, 200); } }} />
          <div
            className={timerMenuClosing ? styles.menuClosing : ''}
            style={{
              position: 'fixed', zIndex: 20000, width: 'max-content', minWidth: '200px', maxWidth: '90vw',
              background: 'rgba(25,25,30,0.85)', backdropFilter: 'blur(25px) saturate(180%)',
              WebkitBackdropFilter: 'blur(25px) saturate(180%)',
              borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 15px 40px rgba(0,0,0,0.6)', padding: '6px',
              display: 'flex', flexDirection: 'column',
              transformOrigin: 'bottom right',
              transform: 'translateZ(0)', willChange: 'transform, opacity',
              overflow: 'hidden', scrollbarWidth: 'none', msOverflowStyle: 'none',
              animation: timerMenuClosing ? 'none' : `menuPopUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)`,
              bottom: `${sendOptionsPos.bottom}px`, right: `${sendOptionsPos.right}px`, top: 'auto', left: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.sendSubOption} onClick={() => { setTimerSeconds(0); setShowSendTimerMenu(false); showToast(t('Таймер отключён')); }}>
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm0 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/></svg>
              <span>{t('Выключить')}</span>
            </div>
            <div className={styles.sendSubOption} onClick={() => { setTimerSeconds(1); setShowSendTimerMenu(false); showToast(t('Сообщение исчезнет через 1 минуту')); }}>
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/><path d="M12.5 7H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
              <span>{t('1 минута')}</span>
            </div>
            <div className={styles.sendSubOption} onClick={() => { setTimerSeconds(3600); setShowSendTimerMenu(false); showToast(t('Сообщение исчезнет через 1 час')); }}>
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/><path d="M12.5 13H11v6l5.2 3.1.8-1.2-4.5-2.7V7z"/></svg>
              <span>{t('1 час')}</span>
            </div>
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '4px 8px' }} />
            <div style={{ padding: '8px', display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input
                type="number" min="1" placeholder={t('мин')}
                id="custom-timer-val"
                style={{
                  flex: 1, minWidth: 0, background: 'rgba(0,0,0,0.2)',
                  border: '1px solid rgba(167,79,255,0.3)', borderRadius: '10px',
                  color: '#fff', padding: '8px 6px', textAlign: 'center',
                  fontSize: '14px', outline: 'none', boxSizing: 'border-box'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = parseInt((e.target as HTMLInputElement).value);
                    if (val > 0) { setTimerSeconds(val * 60); setShowSendTimerMenu(false); showToast(t('Сообщение исчезнет через {n} мин', { n: val })); }
                  }
                }}
              />
              <button
                style={{
                  flexShrink: 0, background: '#a74fff', color: '#fff', border: 'none',
                  borderRadius: '10px', padding: '8px 14px', fontWeight: 700,
                  cursor: 'pointer', transition: '0.2s'
                }}
                onClick={() => {
                  const el = document.getElementById('custom-timer-val') as HTMLInputElement;
                  const val = parseInt(el?.value);
                  if (val > 0) { setTimerSeconds(val * 60); setShowSendTimerMenu(false); showToast(t('Сообщение исчезнет через {n} мин', { n: val })); }
                }}
              >OK</button>
            </div>
          </div>
        </>
      )}
      {showSendScheduleMenu && sendOptionsPos && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 19999 }} onClick={() => { if (!scheduleMenuClosing) { setScheduleMenuClosing(true); setTimeout(() => { setScheduleMenuClosing(false); setShowSendScheduleMenu(false); }, 200); } }} />
          <div
            className={scheduleMenuClosing ? styles.menuClosing : ''}
            style={{
              position: 'fixed', zIndex: 20000, width: 'max-content', minWidth: '200px', maxWidth: '90vw',
              background: 'rgba(25,25,30,0.85)', backdropFilter: 'blur(25px) saturate(180%)',
              WebkitBackdropFilter: 'blur(25px) saturate(180%)',
              borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 15px 40px rgba(0,0,0,0.6)', padding: '6px',
              display: 'flex', flexDirection: 'column',
              transformOrigin: 'bottom right',
              transform: 'translateZ(0)', willChange: 'transform, opacity',
              overflow: 'hidden', scrollbarWidth: 'none', msOverflowStyle: 'none',
              animation: scheduleMenuClosing ? 'none' : `menuPopUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)`,
              bottom: `${sendOptionsPos.bottom}px`, right: `${sendOptionsPos.right}px`, top: 'auto', left: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '8px', color: '#aaa', fontSize: '12px', textAlign: 'center', fontWeight: 'bold' }}>{t('Отправить через:')}</div>
            <div className={styles.sendSubOption} onClick={() => { scheduleMessage(10); }}>{t('10 минут')}</div>
            <div className={styles.sendSubOption} onClick={() => { scheduleMessage(30); }}>{t('30 минут')}</div>
            <div className={styles.sendSubOption} onClick={() => { scheduleMessage(60); }}>{t('1 час')}</div>
            <div className={styles.sendSubOption} onClick={() => { scheduleMessage(120); }}>{t('2 часа')}</div>
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '4px 8px' }} />
            <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ color: '#aaa', fontSize: '11px', fontWeight: 'bold' }}>{t('Своя дата и время:')}</div>
              <input
                type="datetime-local" id="custom-schedule-time"
                min={new Date().toISOString().slice(0, 16)}
                style={{
                  background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(167,79,255,0.3)',
                  borderRadius: '10px', color: '#fff', padding: '8px', fontSize: '13px',
                  outline: 'none', width: '100%', boxSizing: 'border-box', colorScheme: 'dark'
                }}
              />
              <button
                style={{
                  background: '#a74fff', color: '#fff', border: 'none', borderRadius: '10px',
                  padding: '8px', fontWeight: 700, cursor: 'pointer', transition: '0.2s'
                }}
                onClick={scheduleCustom}
              >{t('УСТАНОВИТЬ')}</button>
            </div>
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '4px 8px' }} />
            <div className={styles.sendSubOption} style={{ color: '#ff4d4d' }} onClick={() => { setShowSendScheduleMenu(false); if (target && messageText.trim()) { showToast(t('Отправка по расписанию отменена')); } }}>{t('Отменить')}</div>
          </div>
        </>
      )}
      {showAttachMenu && attachMenuPos && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 19999 }} onClick={() => { if (!attachMenuClosing) { setAttachMenuClosing(true); setTimeout(() => { setAttachMenuClosing(false); setShowAttachMenu(false); }, 200); } }} />
          <style>{`[style*="z-index: 20000"]::-webkit-scrollbar { display: none; }`}</style>
          <div
            className={`${attachMenuClosing ? styles.menuClosing : ''}`}
            style={{
              position: 'fixed', zIndex: 20000, width: 'max-content', minWidth: '220px', maxWidth: '90vw',
              background: 'rgba(25,25,30,0.85)', backdropFilter: 'blur(25px) saturate(180%)',
              WebkitBackdropFilter: 'blur(25px) saturate(180%)',
              borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 15px 40px rgba(0,0,0,0.6)', padding: '6px',
              display: 'flex', flexDirection: 'column',
              transformOrigin: 'bottom left',
              transform: 'translateZ(0)', willChange: 'transform, opacity',
              overflow: 'hidden', scrollbarWidth: 'none', msOverflowStyle: 'none',
              animation: attachMenuClosing ? 'none' : `menuPopUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)`,
              bottom: `${attachMenuPos.bottom}px`, left: `${attachMenuPos.left}px`, top: 'auto', right: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={styles.sendOption}
              onClick={() => {
                setAttachMenuClosing(true);
                setTimeout(() => {
                  setAttachMenuClosing(false);
                  setShowAttachMenu(false);
                  setP2pMode(false);
                  fileInputRef.current?.click();
                }, 200);
              }}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 20, height: 20 }}>
                <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4s1.79-4 4-4h.71C7.37 7.69 9.48 6 12 6c3.04 0 5.5 2.46 5.5 5.5v.5H19c1.66 0 3 1.34 3 3s-1.34 3-3 3z"/>
              </svg>
              <span>{t('Отправить через сервер')} (≤25MB)</span>
            </div>
            {(() => {
              const sys = ['4send_help', '4send_system'];
              const isSys = target && sys.includes(target.toLowerCase());
              return target?.toLowerCase() !== meLower && !contacts.find(c => c.username.toLowerCase() === target?.toLowerCase())?.isRoom && !isSys;
            })() && (
              <div
                className={styles.sendOption}
                onClick={() => {
                  setAttachMenuClosing(true);
                  setTimeout(() => {
                    setAttachMenuClosing(false);
                    setShowAttachMenu(false);
                    setShowP2PInfoModal(true);
                  }, 200);
                }}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 20, height: 20 }}>
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                </svg>
                <span>{t('Отправить через клиент')}</span>
              </div>
            )}
          </div>
        </>
      )}
      {showScheduleMenu && <ScheduleMenu isOpen={showScheduleMenu} onClose={() => setShowScheduleMenu(false)} onSelect={(minutes) => {
        setScheduledMinutes(minutes);
        setShowScheduleMenu(false);
        if (minutes > 0 && target && messageText.trim()) {
          const id = 'sched_' + Date.now();
          const sendAt = new Date(Date.now() + minutes * 60 * 1000);
          setScheduledMessages(prev => [...prev, { id, text: messageText.trim(), sendAt, chat: target }]);
      showToast(t('Сообщение запланировано на {time}', { time: sendAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }));
          setMessageText('');
          setCharCount(0);
          if (textareaRef.current) textareaRef.current.style.height = 'auto';
        }
      }} />}
      {showScheduledList && <ScheduleMessagesList isOpen={showScheduledList} onClose={() => setShowScheduledList(false)} messages={scheduledMessages} onCancel={(id) => setScheduledMessages(prev => prev.filter(m => m.id !== id))} />}
      {showChatAutoDelete && target && <ChatAutoDeleteModal isOpen={showChatAutoDelete} onClose={() => setShowChatAutoDelete(false)} target={target} currentTimer={contacts.find(c => c.username.toLowerCase() === target.toLowerCase())?.autoDeleteTimer || 0} onSave={(seconds) => { setContacts(prev => updateContact(prev, target, c => ({ ...c, autoDeleteTimer: seconds }))); showToast(seconds === 0 ? t('Автоудаление отключено') : t('Автоудаление установлено'), 'success'); }} />}
      {showChatStats && target && <ChatStatsModal isOpen={showChatStats} onClose={() => setShowChatStats(false)} target={target} preloadedData={chatStatsData} />}
      {showSecretChatModal && target && (
        <SecretChatModal
          isOpen={showSecretChatModal}
          onClose={() => setShowSecretChatModal(false)}
          contactDisplayName={chatName}
          hasE2EESession={hasE2EESession(target)}
          onStartSecret={() => { initiateE2EE(target); }}
        />
      )}
      {showCreateGroup && <CreateGroupModal isOpen={showCreateGroup} onClose={() => setShowCreateGroup(false)} onCreated={() => { setShowCreateGroup(false); }} />}
      {previewRoomId && (
        <RoomPreviewModal
          roomId={previewRoomId}
          onClose={() => setPreviewRoomId(null)}
          onJoined={(id) => { setPreviewRoomId(null); handleSelectChat(id); }}
        />
      )}
      {lightboxSrc && <Lightbox isOpen={!!lightboxSrc} onClose={() => setLightboxSrc(null)} src={lightboxSrc} noDownload={copyRestricted} />}
      {showLogout && <LogoutModal isOpen={showLogout} onClose={() => setShowLogout(false)} />}

      {showTimerMenu && <TimerMenu isOpen={showTimerMenu} onClose={() => setShowTimerMenu(false)} onSelect={(secs) => { setTimerSeconds(secs); setShowTimerMenu(false); showToast(secs === 0 ? t('Таймер отключён') : secs < 60 ? t('Сообщение исчезнет через {n} сек', { n: secs }) : secs < 3600 ? t('Сообщение исчезнет через {n} мин', { n: secs / 60 }) : t('Сообщение исчезнет через {n} час', { n: secs / 3600 })); }} />}
      
      <PinConfirmModal
        isOpen={showPinConfirm}
        onClose={() => { setShowPinConfirm(false); setPinTargetMsg(null); }}
        onPin={handlePinConfirm}
        messageText={pinTargetMsg?.text}
      />
      <FilePreviewModal
        isOpen={showFilePreview}
        onClose={() => { setShowFilePreview(false); setPreviewFile(null); }}
        file={previewFile}
        onSend={handleSendFromPreview}
      />
      <FileLimitModal isOpen={showFileLimit} onClose={() => setShowFileLimit(false)} />
      <P2PInfoModal
        isOpen={showP2PInfoModal}
        onClose={() => setShowP2PInfoModal(false)}
        onAgree={() => { setP2pMode(true); fileInputRef.current?.click(); }}
      />
      {screenshotFlash && <div className={styles.screenshotFlash} />}
      {(isIdleLocked || isAppLocked) && (
        <PinLockScreen isOpen onClose={() => setIsIdleLocked(false)} />
      )}
      <Confetti isOpen={showConfetti} />
      {showFingerprintModal && (
        <FingerprintModal
          contactUsername={showFingerprintModal}
          contactDisplayName={chatName}
          onClose={() => setShowFingerprintModal(null)}
        />
      )}
      <FolderEditModal
        isOpen={showFolderEdit}
        onClose={() => setShowFolderEdit(false)}
        onChanged={() => { setActiveFolderId(prev => prev); setFolderVersion(v => v + 1); }}
      />
      {showProfileModal && profileData && (
        <ProfileModal key={profileData.username} username={profileData.username} displayName={profileData.displayName} avatar={profileData.avatar} bio={profileData.bio} lastSeen={profileData.lastSeen} isOnline={profileData.isOnline} isVerified={profileData.isVerified} isBlocked={isChatBlocked} isRoom={profileData.isRoom} roomType={profileData.roomType} roomDescription={profileData.roomDescription} onClose={() => { setShowProfileModal(false); setProfileData(null); }} onDeleteChat={() => setDeleteChatTarget({ username: target || '', name: chatName || target || '' })} onPrivacyChange={(type, state) => { if (type === 'copy') setCopyRestricted(state); }} onGoToMessage={(msgId) => { setShowProfileModal(false); setProfileData(null); setTimeout(() => handleScrollToReply(msgId), 50); }} onEditProfile={() => setShowSettingsModal(true)} onRoomSettings={() => { setShowProfileModal(false); setProfileData(null); setShowRoomSettings(true); }} />
      )}
      {showRoomSettings && target && (
        <RoomSettingsModal isOpen={showRoomSettings} onClose={() => setShowRoomSettings(false)} roomId={target} roomName={chatName} roomAvatar={chatAvatar} roomDescription={roomDescription} roomType={profileData?.roomType || 'group'} isPublic={roomIsPublic} publicLink={roomPublicLink} members={groupMembers.length > 0 ? groupMembers : [me || '']} memberDetails={groupMemberDetails} isAdmin={isGroupAdmin} currentUser={me || ''} />
      )}
      {showMediaEditor && (
        <MediaEditor isOpen={showMediaEditor} onClose={() => { setShowMediaEditor(false); setMediaEditorFile(null); }} file={mediaEditorFile} onSend={(blob, caption) => { const origName = mediaEditorFile?.name; setShowMediaEditor(false); setMediaEditorFile(null); const mimeExt = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg'); const finalName = origName && origName.includes('.') ? origName : `photo_${Date.now()}.${mimeExt}`; handleSendFromPreview(new File([blob], finalName, { type: blob.type }), caption); }} />
      )}
      {showDeleteAccount && (
        <DeleteAccountModal isOpen={showDeleteAccount} onClose={() => setShowDeleteAccount(false)} />
      )}
      {typingUser && (
        <TypingIndicator username={typingUser} />
      )}
      {callState && (
        <CallOverlay
          type={callState.type}
          peer={callState.peer}
          peerDisplay={callState.peerDisplay}
          peerAvatar={callState.peerAvatar}
          withVideo={callState.withVideo}
          signals={callState.signals}
          preloadedStream={preloadedStreamRef.current}
          onAccept={acceptCall}
          onClose={closeCall}
        />
      )}
      {showAiRewriteModal && (
        <AiRewriteModal
          isOpen={showAiRewriteModal}
          onClose={() => setShowAiRewriteModal(false)}
          messageText={messageText}
          onApply={(text) => { setMessageText(text); setShowAiRewriteModal(false); }}
        />
      )}
      {(p2p.state.status !== 'idle' || showP2PTransfer) && (
        <P2PTransferOverlay
          state={p2p.state}
          onCancel={() => p2p.cancel()}
          onDownload={p2p.download}
          onClose={() => { setShowP2PTransfer(false); p2p.reset(); }}
          onAccept={() => { p2p.acceptIncomingOffer(); }}
          onDecline={() => p2p.decline()}
        />
      )}
    </div>
  );
}
