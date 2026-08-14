import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../../hooks/useI18n';
import type { Message } from '../../types/message';
import styles from './ChatSearchPanel.module.css';

interface Props {
  messages: Message[];
  chatName: string;
  chatAvatar?: string;
  query: string;
  results: string[];
  currentIndex: number;
  onSelectResult: (index: number) => void;
  onClose?: () => void;
  onJumpTo?: (msgId: string) => void;
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, i) =>
    i % 2 === 1
      ? <mark key={i} className={styles.highlight}>{part}</mark>
      : part
  );
}

export default function ChatSearchPanel({ messages, chatName, chatAvatar, query, results, currentIndex, onSelectResult, onClose, onJumpTo }: Props) {
  const { t } = useI18n();

  const formatDate = useCallback((ts: Date | string) => {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { day: 'numeric', month: 'long' }) + ', ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);

  const initial = (chatName || '?').charAt(0).toUpperCase();

  const matchedMessages = results
    .map(id => messages.find(m => m.id === id))
    .filter((m): m is Message => !!m && !m.isService);

  return (
    <div className={styles.panel}>
      <div className={styles.filterRow}>
        <div className={styles.chatFilter} onClick={onClose}>
          {chatAvatar ? (
            <img src={chatAvatar} alt="" className={styles.filterAvatar} />
          ) : chatName === t('Избранное') ? (
            <div className={styles.filterAvatarPlaceholder} style={{ background: 'var(--accent, #a74fff)', color: 'var(--on-accent, #fff)' }}>
              <svg viewBox="0 0 24 24" style={{ width: '60%', height: '60%', fill: 'currentColor' }}>
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
              </svg>
            </div>
          ) : (
            <div className={styles.filterAvatarPlaceholder}>{initial}</div>
          )}
          <span className={styles.filterName}>{chatName}</span>
          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" className={styles.filterArrow}>
            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
          </svg>
        </div>
      </div>

      {query.trim() && results.length > 0 && (
        <div className={styles.results}>
          {matchedMessages.map((msg, i) => (
            <div
              key={msg.id || i}
              className={`${styles.resultItem} ${i === currentIndex ? styles.active : ''}`}
              onClick={() => { onSelectResult(i); onJumpTo?.(msg.id); }}
            >
              <div className={styles.resultTop}>
                <span className={styles.resultSender}>{msg.displayName || msg.sender || t('Вы')}</span>
                <span className={styles.resultTime}>{formatDate(msg.timestamp)}</span>
              </div>
              <div className={styles.resultText}>
                {highlightText(msg.text || '', query)}
              </div>
            </div>
          ))}
        </div>
      )}

      {query.trim() && results.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyText}>{t('Ничего не найдено')}</div>
        </div>
      )}

      {!query.trim() && (
        <div className={styles.emptyState}>
          <svg className={styles.emptyIcon} viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <div className={styles.emptyText}>{t('Поиск по сообщениям')}</div>
        </div>
      )}
    </div>
  );
}
