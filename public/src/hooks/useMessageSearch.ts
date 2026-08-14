import { useMemo, useCallback } from 'react';
import FlexSearch from 'flexsearch';
import type { Message } from '../types/message';

function toDoc(msg: Message): Record<string, string> {
  const text = typeof msg.text === 'string' ? msg.text : '';
  return { id: msg.id, text };
}

export function useMessageSearch(messages: Message[]) {
  const index = useMemo(() => {
    const doc = new FlexSearch.Document({
      document: {
        id: 'id',
        index: ['text'],
      },
      tokenize: 'forward',
    });

    for (const msg of messages) {
      if (msg.id) {
        doc.add(toDoc(msg));
      }
    }

    return doc;
  }, [messages]);

  const search = useCallback((query: string): string[] => {
    if (!query.trim()) return [];
    try {
      const raw = index.search(query);
      if (!Array.isArray(raw)) return [];
      const ids: string[] = [];
      const seen = new Set<string>();
      for (const group of raw as unknown as Array<{ field?: string; result: Array<string | number> }>) {
        if (!group.result) continue;
        for (const id of group.result) {
          if (id != null && !seen.has(String(id))) {
            seen.add(String(id));
            ids.push(String(id));
          }
        }
      }
      return ids;
    } catch {
      return [];
    }
  }, [index]);

  return search;
}
