import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { Message } from '../types/message';

interface ChatMessagesContextType {
  messages: Message[];
  setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
  addMessage: (msg: Message) => void;
  isChatLoading: boolean;
  setIsChatLoading: (loading: boolean) => void;
  allLoaded: boolean;
  setAllLoaded: (loaded: boolean) => void;
  editingMsgId: string | null;
  setEditingMsgId: (id: string | null) => void;
  editingMsgText: string;
  setEditingMsgText: (text: string) => void;
  replyText: string | null;
  setReplyText: (text: string | null) => void;
  replyMsgId: string | null;
  setReplyMsgId: (id: string | null) => void;
  pendingSchedules: Array<{ id: string; executeAt: number; previewText: string; taskFn: () => void }>;
  addScheduledTask: (task: { id: string; executeAt: number; previewText: string; taskFn: () => void }) => void;
  removeScheduledTask: (id: string) => void;
  currentRoomType: 'group' | 'channel' | null;
  setCurrentRoomType: (type: 'group' | 'channel' | null) => void;
}

const ChatMessagesContext = createContext<ChatMessagesContextType | null>(null);

export const ChatMessagesProvider = ({ children }: { children: ReactNode }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [allLoaded, setAllLoaded] = useState(false);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingMsgText, setEditingMsgText] = useState('');
  const [replyText, setReplyText] = useState<string | null>(null);
  const [replyMsgId, setReplyMsgId] = useState<string | null>(null);
  const [pendingSchedules, setPendingSchedules] = useState<Array<{ id: string; executeAt: number; previewText: string; taskFn: () => void }>>([]);
  const [currentRoomType, setCurrentRoomType] = useState<'group' | 'channel' | null>(null);

  const addMessage = useCallback((msg: Message) => {
    setMessages(prev => {
      if (prev.some(m => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
  }, []);

  const addScheduledTask = useCallback((task: { id: string; executeAt: number; previewText: string; taskFn: () => void }) => {
    setPendingSchedules(prev => [...prev, task]);
  }, []);

  const removeScheduledTask = useCallback((id: string) => {
    setPendingSchedules(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ChatMessagesContext.Provider value={{
      messages, setMessages, addMessage,
      isChatLoading, setIsChatLoading,
      allLoaded, setAllLoaded,
      editingMsgId, setEditingMsgId,
      editingMsgText, setEditingMsgText,
      replyText, setReplyText,
      replyMsgId, setReplyMsgId,
      pendingSchedules, addScheduledTask, removeScheduledTask,
      currentRoomType, setCurrentRoomType
    }}>
      {children}
    </ChatMessagesContext.Provider>
  );
};

export const useChatMessages = (): ChatMessagesContextType => {
  const context = useContext(ChatMessagesContext);
  if (!context) throw new Error('useChatMessages must be used within ChatProvider');
  return context;
};
