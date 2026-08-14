import { createElement, Fragment, type ReactNode, type MouseEvent as ReactMouseEvent } from 'react';
import { extractFirstUrl } from './format';

const URL_REGEX = /(https?:\/\/[^\s]+)/g;
const MENTION_REGEX = /@([a-zA-Z0-9_]{4,})/g;

const isSafeUrl = (url: string): boolean => {
  const lower = url.toLowerCase();
  return !lower.startsWith('javascript:') &&
    !lower.startsWith('data:') &&
    !lower.startsWith('vbscript:');
};

export const formatMessageText = (text: string): ReactNode => {
  const safeText = typeof text === 'string' ? text : '';
  const parts = safeText.split(URL_REGEX);

  const nodes: ReactNode[] = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (!p) continue;
    if (i % 2 === 1) {
      const safeUrl = isSafeUrl(p) ? p : '#';
      nodes.push(
        createElement(
          'a',
          {
            key: `u${i}`,
            href: safeUrl,
            target: '_blank',
            rel: 'noopener noreferrer',
            style: { color: '#50a2e9', textDecoration: 'none' },
            onClick: (e: ReactMouseEvent) => e.stopPropagation(),
          },
          p,
        ),
      );
      continue;
    }

    const textParts = p.split(MENTION_REGEX);
    if (textParts.length === 1) {
      nodes.push(textParts[0]);
      continue;
    }

    const mentionNodes: ReactNode[] = [];
    for (let j = 0; j < textParts.length; j++) {
      if (j % 2 === 1) {
        mentionNodes.push(
          createElement(
            'span',
            {
              key: `m${i}-${j}`,
              style: { color: '#a74fff', cursor: 'pointer', fontWeight: 'bold' },
              onClick: (e: ReactMouseEvent) => e.stopPropagation(),
            },
            `@${textParts[j]}`,
          ),
        );
      } else if (textParts[j]) {
        mentionNodes.push(textParts[j]);
      }
    }
    nodes.push(createElement(Fragment, { key: `f${i}` }, ...mentionNodes));
  }
  return createElement(Fragment, null, ...nodes);
};

export { extractFirstUrl };
