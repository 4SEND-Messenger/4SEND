import { useCallback, useRef } from 'react';
import { useChat } from '../context/ChatContext';
import { useAuthContext } from '../context/AuthContext';
import { api } from '../services/api';
import { idbSet, idbGet } from '../services/storage';
import type { ContactItem } from '../types/user';

const CONCURRENCY = 3;

async function batchSettled<T>(tasks: (() => Promise<T>)[]): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let idx = 0;
  async function next() {
    while (idx < tasks.length) {
      const i = idx++;
      try { results[i] = { status: 'fulfilled', value: await tasks[i]() }; }
      catch (e) { results[i] = { status: 'rejected', reason: e }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, () => next()));
  return results;
}

export const useChats = () => {
  const { contacts, setContacts } = useChat();
  const { me } = useAuthContext();
  const isLoadingRef = useRef(false);
  const loadedOnceRef = useRef(false);

  const loadChats = useCallback(async () => {
    if (isLoadingRef.current || !me) return;
    isLoadingRef.current = true;

    const cacheKey = `4send_chats_cache_${me}`;

    try {
      const cached = await idbGet<ContactItem[]>(cacheKey);
      if (cached && Array.isArray(cached) && !loadedOnceRef.current) {
        loadedOnceRef.current = true;
        setContacts(cached);
      }
    } catch {}

    try {
      const chats = await api.get<ContactItem[]>(`/chats-extended/${me}?t=${Date.now()}`);
      if (Array.isArray(chats)) {
        setContacts(chats);
        try { await idbSet(cacheKey, chats); } catch {}

        const usersToFetch = chats
          .filter(c => !c.isRoom && c.username !== me && c.username !== '4send_system' && c.username !== '4send_help')
          .map(c => c.username.toLowerCase());

        if (usersToFetch.length > 0) {
          const statuses = await batchSettled(
            usersToFetch.map(u =>
              () => api.get<{ last_seen?: string; isOnline?: boolean }>(`/api/status/${encodeURIComponent(u)}?me=${encodeURIComponent(me)}`)
            )
          );
          setContacts((prev: ContactItem[]) => prev.map((c: ContactItem) => {
            const idx = usersToFetch.indexOf(c.username.toLowerCase());
            if (idx >= 0) {
              const result = statuses[idx];
              if (result && result.status === 'fulfilled' && result.value) {
                return { ...c, last_seen: result.value.last_seen, isOnline: result.value.isOnline };
              }
            }
            return c;
          }));
        }

        const roomsToFetch = chats.filter(c => c.isRoom);
        if (roomsToFetch.length > 0) {
          const roomData = await batchSettled(
            roomsToFetch.map(r =>
              () => api.get<{ members?: string[]; type?: string; name?: string }>(`/api/room/${encodeURIComponent(r.username)}`)
            )
          );
          setContacts((prev: ContactItem[]) => {
            const updated: ContactItem[] = prev.map((c: ContactItem) => {
              const room = roomsToFetch.find(r => r.username === c.username);
              if (!room) return c;
              const idx = roomsToFetch.indexOf(room);
              const result = roomData[idx];
              if (result && result.status === 'fulfilled' && result.value) {
                const roomType: 'group' | 'channel' = result.value.type === 'channel' ? 'channel' : 'group';
                return { ...c, memberCount: result.value.members?.length || 0, roomType, displayName: result.value.name || c.displayName };
              }
              return c;
            });
            try { idbSet(cacheKey, updated); } catch {}
            return updated;
          });
        }
      }
    } catch {}

    isLoadingRef.current = false;
  }, [me, setContacts]);

  const updateContactPreview = useCallback((username: string, data: Partial<ContactItem>) => {
    setContacts((prev: ContactItem[]) => prev.map((c: ContactItem) =>
      c.username.toLowerCase() === username.toLowerCase()
        ? { ...c, ...data }
        : c
    ));
  }, [setContacts]);

  return { contacts, loadChats, updateContactPreview };
};
