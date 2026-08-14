import { useMemo, useCallback, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useChat } from '../../context/ChatContext';
import { useAuthContext } from '../../context/AuthContext';
import { useI18n } from '../../hooks/useI18n';
import ContactItem from './ContactItem';
import styles from './ContactList.module.css';

function parseDate(ts: Date | string | undefined): number {
  if (!ts || String(ts) === 'null') return 0;
  let d = new Date(ts);
  if (isNaN(d.getTime())) d = new Date(String(ts).replace(' ', 'T'));
  if (isNaN(d.getTime())) d = new Date(String(ts).replace(' ', 'T') + 'Z');
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

import { getFolders } from '../../utils/folders';

interface Props {
  onSelectChat: (username: string) => void;
  onChatContextMenu?: (e: React.MouseEvent, username: string) => void;
  onChatLongPress?: (username: string, x: number, y: number) => void;
  viewingArchive?: boolean;
  searchQuery?: string;
  isSearchResults?: boolean;
  contextMenuUsername?: string | null;
  e2eeSessions?: Set<string>;
  activeFolderId?: string | null;
}

const ITEM_HEIGHT = 72;

export default function ContactList({ onSelectChat, onChatContextMenu, onChatLongPress, viewingArchive = false, searchQuery = '',   isSearchResults = false, contextMenuUsername, e2eeSessions, activeFolderId }: Props) {
  const { contacts } = useChat();
  const { me } = useAuthContext();
  const { t } = useI18n();
  const dragUsernameRef = useRef<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const isSearching = !!searchQuery.trim();

  const getPinnedOrder = (): string[] => {
    try {
      const stored = localStorage.getItem('4send_pinned_order');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  };

  const [pinnedOrder, setPinnedOrder] = useState<string[]>(getPinnedOrder);

  const sortedChats = useMemo(() => {
    const filtered = contacts.filter(c =>
      viewingArchive ? c.is_archived : !c.is_archived
    );

    const folderChats = activeFolderId && !isSearching && !viewingArchive
      ? (() => {
          const folders = getFolders();
          const folder = folders.find(f => f.id === activeFolderId);
          if (!folder) return filtered;
          const usernames = new Set(folder.chatUsernames.map(u => u.toLowerCase()));
          return filtered.filter(c => usernames.has(c.username.toLowerCase()));
        })()
      : filtered;

    const uniqueChats = new Map<string, typeof folderChats[0]>();
    folderChats.forEach(chat => {
      const existing = uniqueChats.get(chat.username);
      if (!existing) {
        uniqueChats.set(chat.username, chat);
      } else {
        if (parseDate(chat.timestamp) > parseDate(existing.timestamp)) {
          uniqueChats.set(chat.username, chat);
        }
      }
    });

    const chats = Array.from(uniqueChats.values());
    chats.sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0);
      if (a.is_pinned && b.is_pinned) {
        const idxA = pinnedOrder.indexOf(a.username);
        const idxB = pinnedOrder.indexOf(b.username);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
      }
      const tA = parseDate(a.timestamp);
      const tB = parseDate(b.timestamp);
      if (tB !== tA) return tB - tA;
      return a.username.localeCompare(b.username);
    });

    const result: typeof chats = [];
    for (const c of chats) {
      result.push(c);
      if (e2eeSessions && e2eeSessions.has(c.username.toLowerCase())) {
        result.push({
          ...c,
          username: `secret::${c.username}`,
          displayName: c.displayName || c.username,
          lastText: t('Секретное сообщение'),
          isSecret: true,
          is_pinned: false,
        });
      }
    }
    return result;
  }, [contacts, viewingArchive, pinnedOrder, e2eeSessions, isSearching, activeFolderId]);

  const virtualizer = useVirtualizer({
    count: sortedChats.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 8,
  });

  const handleDragStart = useCallback((e: React.DragEvent, username: string) => {
    dragUsernameRef.current = username;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', username);
  }, []);

  const handleDragEnd = useCallback(() => {
    dragUsernameRef.current = null;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, targetUsername: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.stopPropagation();
    const dragged = dragUsernameRef.current;
    if (!dragged || dragged === targetUsername) return;
    const el = e.currentTarget as HTMLElement | null;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const insertBelow = (e.clientY - rect.top) / rect.height > 0.5;
    setPinnedOrder(prev => {
      let next = [...prev];
      const draggedIdx = next.indexOf(dragged);
      if (draggedIdx !== -1) next = next.filter(u => u !== dragged);
      const targetIdx = next.indexOf(targetUsername);
      if (targetIdx === -1) return prev;
      const insertAt = insertBelow ? targetIdx + 1 : targetIdx;
      next.splice(insertAt, 0, dragged);
      localStorage.setItem('4send_pinned_order', JSON.stringify(next));
      return next;
    });
  }, []);

  if (sortedChats.length === 0) {
    return (
      <div className={styles.contactList}>
        {isSearching ? (
          <div className={styles.emptyState} data-anim-preserve>
            <div className={styles.emptyIcon}>
              <svg className={styles.searchEmptySvg} viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
            <div className={styles.emptyTitle}>{t('Ничего не найдено')}</div>
            <div className={styles.emptySub}>{t('Попробуйте другой запрос')}</div>
          </div>
        ) : (
          <div className={styles.emptyState} data-anim-preserve>
            {viewingArchive ? (
              <>
                <div className={styles.emptyIcon}>
                  <svg className={styles.archiveEmptyIcon} viewBox="0 0 24 24">
                    <path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" />
                  </svg>
                </div>
                <div className={styles.archiveEmptyTitle}>{t('В архиве никого нет')}</div>
              </>
            ) : (
              <>
                <div className={styles.emptyIcon}>
                  <div className={styles.pulse} />
                  <svg className={styles.chatSvg} viewBox="0 0 24 24">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                    <line x1="9" y1="9" x2="15" y2="9" />
                    <line x1="9" y1="13" x2="13" y2="13" />
                  </svg>
                </div>
                <div className={styles.emptyTitle}>{t('У вас пока нет чатов')}</div>
                <div className={styles.emptySub}>{t('Воспользуйтесь поиском, чтобы найти друзей и начать общение')}</div>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div ref={scrollContainerRef} className={styles.contactList} style={{ overflow: 'auto' }}>
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map(virtualRow => {
          const chat = sortedChats[virtualRow.index];
          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
              draggable={!!chat.is_pinned}
              data-pinned={chat.is_pinned ? 'true' : 'false'}
              data-username={chat.username}
              onDragStart={chat.is_pinned ? (e) => handleDragStart(e, chat.username) : undefined}
              onDragEnd={chat.is_pinned ? handleDragEnd : undefined}
              onDragOver={chat.is_pinned ? (e) => handleDragOver(e, chat.username) : undefined}
            >
              <ContactItem
                chat={chat}
                onClick={onSelectChat}
                onContextMenu={onChatContextMenu}
                onLongPress={onChatLongPress}
                isContextMenuActive={!!contextMenuUsername && contextMenuUsername.toLowerCase() === chat.username.toLowerCase()}
                isSearchResult={isSearchResults}
                e2eeSessions={e2eeSessions}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
