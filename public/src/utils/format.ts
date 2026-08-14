import { globalLocale } from '../services/storage';
import { translate } from '../hooks/useI18n';

export const formatChatDate = (dateStr: string): string => {
  const date = new Date(dateStr.replace(' ', 'T'));
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const checkDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (checkDate.getTime() === today.getTime()) return translate('Сегодня');
  if (checkDate.getTime() === yesterday.getTime()) return translate('Вчера');
  return date.toLocaleDateString(globalLocale(), { day: 'numeric', month: 'long' });
};

export const pluralize = (count: number, forms: [string, string, string]): string => {
  if (count % 10 === 1 && count % 100 !== 11) return `${count} ${forms[0]}`;
  if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20))
    return `${count} ${forms[1]}`;
  return `${count} ${forms[2]}`;
};

export const extractFirstUrl = (text: string): string | null => {
  const safeText = typeof text === 'string' ? text : '';
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const match = safeText.match(urlRegex);
  return match ? match[0] : null;
};