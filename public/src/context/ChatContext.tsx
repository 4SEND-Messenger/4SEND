import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { ContactItem } from '../types/user';

interface ChatContextType {
  target: string | null;
  setTarget: (target: string | null) => void;
  contacts: ContactItem[];
  setContacts: (contacts: ContactItem[] | ((prev: ContactItem[]) => ContactItem[])) => void;
  updateContactPreview: (username: string, data: Partial<ContactItem>) => void;
  unreadCounts: Record<string, number>;
  drafts: Record<string, string>;
  setDraft: (target: string, text: string) => void;
  onlineUsers: Set<string>;
  setOnlineUsers: (users: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  viewingArchive: boolean;
  setViewingArchive: (v: boolean) => void;
  showDrawer: boolean;
  setShowDrawer: (v: boolean) => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const [target, setTarget] = useState<string | null>(null);
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [unreadCounts] = useState<Record<string, number>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [viewingArchive, setViewingArchive] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);

  const setDraft = useCallback((target: string, text: string) => {
    setDrafts(prev => ({ ...prev, [target]: text }));
  }, []);

  const updateContactPreview = useCallback((username: string, data: Partial<ContactItem>) => {
    setContacts(prev => prev.map(c =>
      c.username.toLowerCase() === username.toLowerCase()
        ? { ...c, ...data }
        : c
    ));
  }, []);

  return (
    <ChatContext.Provider value={{
      target, setTarget,
      contacts, setContacts, updateContactPreview,
      unreadCounts,
      drafts, setDraft,
      onlineUsers, setOnlineUsers,
      viewingArchive, setViewingArchive,
      showDrawer, setShowDrawer
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = (): ChatContextType => {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used within ChatProvider');
  return context;
};
