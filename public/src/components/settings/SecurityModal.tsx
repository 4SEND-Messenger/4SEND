import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../../hooks/useI18n';
import styles from './SecurityModal.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOpenSubModal: (name: string) => void;
}

const hubItems = [
  {
    sectionKey: 'ПРИВАТНОСТЬ',
    items: [
      {
        name: 'privacy',
        labelKey: 'Настройки приватности',
        descKey: 'Управление настройками приватности',
        icon: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
        color: '#007aff',
        gradient: 'linear-gradient(135deg,#007aff,#0051d5)',
        shadow: '0 4px 12px rgba(0,122,255,0.3)',
        danger: false,
      },
    ],
  },
  {
    sectionKey: 'БЕЗОПАСНОСТЬ',
    items: [
      {
        name: 'password',
        labelKey: 'Изменить пароль',
        descKey: 'Обновление пароля аккаунта',
        icon: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z',
        color: '#34c759',
        gradient: 'linear-gradient(135deg,#34c759,#28a745)',
        shadow: '0 4px 12px rgba(52,199,89,0.3)',
        danger: false,
      },
      {
        name: 'twoFactor',
        labelKey: 'Двухфакторная аутентификация',
        descKey: 'Дополнительный пароль при входе',
        icon: 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z',
        color: '#e91e63',
        gradient: 'linear-gradient(135deg,#e91e63,#c2185b)',
        shadow: '0 4px 12px rgba(233,30,99,0.3)',
        danger: false,
      },
      {
        name: 'panicPassword',
        labelKey: 'Тревожный пароль',
        descKey: 'Удаление аккаунта при входе',
        icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z',
        color: '#ff3b30',
        gradient: 'linear-gradient(135deg,#ff3b30,#d32f2f)',
        shadow: '0 4px 12px rgba(255,59,48,0.3)',
        danger: true,
      },
      {
        name: 'autoLock',
        labelKey: 'Автоблокировка',
        descKey: 'Блокировка мессенджера при неактивности',
        icon: 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z',
        color: '#af52de',
        gradient: 'linear-gradient(135deg,#af52de,#8e24aa)',
        shadow: '0 4px 12px rgba(175,82,222,0.3)',
        danger: false,
      },
      {
        name: 'encryption',
        labelKey: 'Шифрование базы данных',
        descKey: 'Шифрование сообщений и ключей на устройстве',
        icon: 'M12 2L4 6v5c0 5.55 3.4 10.75 8 12 4.6-1.25 8-6.45 8-12V6L12 2zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z',
        fillRule: 'evenodd',
        color: '#007aff',
        gradient: 'linear-gradient(135deg,#007aff,#0051d5)',
        shadow: '0 4px 12px rgba(0,122,255,0.3)',
        danger: false,
      },
      {
        name: 'activeSessions',
        labelKey: 'Активные сеансы',
        descKey: 'Управление устройствами',
        icon: 'M4 6h18V4H4c-1.1 0-2 .9-2 2v11H0v3h14v-3H4V6zm19 2h-6c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V9c0-.55-.45-1-1-1zm-1 9h-4v-7h4v7z',
        color: '#00c6ff',
        gradient: 'linear-gradient(135deg,#00c6ff,#0072ff)',
        shadow: '0 4px 12px rgba(0,198,255,0.3)',
        danger: false,
      },
    ],
  },
  {
    sectionKey: 'АККАУНТ',
    items: [
      {
        name: 'autoDelete',
        labelKey: 'Автоудаление',
        descKey: 'Автоматическое удаление аккаунта',
        icon: 'M15 4V3H9v1H4v2h1v13c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V6h1V4h-5zm2 15H7V6h10v13zM9 8h2v9H9zm4 0h2v9h-2z',
        color: '#ff9500',
        gradient: 'linear-gradient(135deg,#ff9500,#ff6b00)',
        shadow: '0 4px 12px rgba(255,149,0,0.3)',
        danger: false,
      },
      {
        name: 'autoLogout',
        labelKey: 'Автовыход',
        descKey: 'Завершение сеансов при неактивности',
        icon: 'M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z',
        color: '#007aff',
        gradient: 'linear-gradient(135deg,#007aff,#0051d5)',
        shadow: '0 4px 12px rgba(0,122,255,0.3)',
        danger: false,
      },
      {
        name: 'deleteAccount',
        labelKey: 'Удалить аккаунт',
        descKey: 'Безвозвратное удаление данных',
        icon: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
        color: '#ff3b30',
        gradient: 'linear-gradient(135deg,#ff3b30,#d32f2f)',
        shadow: '0 4px 12px rgba(255,59,48,0.3)',
        danger: true,
      },
    ],
  },
];

export default function SecurityModal({ isOpen, onClose, onOpenSubModal }: Props) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(isOpen);
  const [closing, setClosing] = useState(false);
  const [entered, setEntered] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      setClosing(false);
      setEntered(false);
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setEntered(true);
        });
      });
      return () => cancelAnimationFrame(raf);
    }
    return undefined;
  }, [isOpen]);

  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => {
      setVisible(false);
      setClosing(false);
      setEntered(false);
      onClose();
    }, 400);
    return () => clearTimeout(timer);
  }, [closing, onClose]);

  const handleClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
  }, [closing]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [handleClose]);

  if (!visible) return null;

  return (
    <div
      className={`${styles.overlay} ${entered && !closing ? styles.open : ''} ${closing ? styles.closing : ''}`}
      onClick={handleClose}
    >
      <div
        ref={contentRef}
        className={styles.modal}
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 className={styles.title}>{t('Приватность')}</h2>
        </div>

        <div className={styles.scrollContent}>
          {hubItems.map((section) => (
            <div key={section.sectionKey}>
              <div className={styles.sectionHeader}>{t(section.sectionKey)}</div>
              <div className={styles.sectionGroup}>
                {section.items.map((item) => (
                  <button
                    key={item.name}
                    className={`${styles.hubItem} ${item.danger ? styles.dangerHover : ''}`}
                    onClick={() => onOpenSubModal(item.name)}
                  >
                    <div
                      className={styles.iconBox}
                      style={{ background: item.gradient, boxShadow: item.shadow }}
                    >
                      <svg viewBox="0 0 24 24">
                        <path d={item.icon} fillRule={(item as any).fillRule || undefined} />
                      </svg>
                    </div>
                    <div className={styles.textBlock}>
                      <span className={`${styles.itemLabel} ${item.danger ? styles.dangerText : ''}`}>
                        {t(item.labelKey)}
                      </span>
                      <span className={styles.itemDesc}>{t(item.descKey)}</span>
                    </div>
                    <span className={`${styles.arrow} ${item.danger ? styles.danger : ''}`}>›</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
