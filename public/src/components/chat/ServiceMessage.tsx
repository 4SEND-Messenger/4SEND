import { useI18n } from '../../hooks/useI18n';
import styles from './ServiceMessage.module.css';
import type { Message } from '../../types/message';

interface Props {
  message: Message;
}

const SYSTEM_PATTERNS: Array<{ re: RegExp; build: (m: RegExpMatchArray, t: (k: string) => string) => string }> = [
  {
    re: /^(.+?)\s+закрепил\(а\)\s+«(.+?)»$/,
    build: (m, t) => `${m[1]} ${t('закрепил(а)')} «${m[2]}»`,
  },
  {
    re: /^(.+?)\s+открепил\(а\)\s+сообщение$/,
    build: (m, t) => `${m[1]} ${t('открепил(а) сообщение')}`,
  },
  {
    re: /^(.+?)\s+переслал\(а\)\s+сообщение$/,
    build: (m, t) => `${m[1]} ${t('переслал(а) сообщение')}`,
  },
  {
    re: /^(.+?)\s+включил\(а\)\s+запрет копирования$/,
    build: (m, t) => `${m[1]} ${t('включил(а) запрет копирования')}`,
  },
  {
    re: /^(.+?)\s+выключил\(а\)\s+запрет копирования$/,
    build: (m, t) => `${m[1]} ${t('выключил(а) запрет копирования')}`,
  },
  {
    re: /^(.+?)\s+включил\(а\)\s+уведомления о скриншотах$/,
    build: (m, t) => `${m[1]} ${t('включил(а) уведомления о скриншотах')}`,
  },
  {
    re: /^(.+?)\s+выключил\(а\)\s+уведомления о скриншотах$/,
    build: (m, t) => `${m[1]} ${t('выключил(а) уведомления о скриншотах')}`,
  },
];

export const translateServiceText = (text: string, t: (k: string) => string): string => {
  for (const p of SYSTEM_PATTERNS) {
    const m = text.match(p.re);
    if (m) return p.build(m, t);
  }
  return text;
};

export default function ServiceMessage({ message }: Props) {
  const { t } = useI18n();
  const text = translateServiceText(message.text || '', t);
  return (
    <div className={styles.wrapper}>
      <div className={styles.pill} data-id={message.id || message.tempId}>
        {text}
      </div>
    </div>
  );
}
