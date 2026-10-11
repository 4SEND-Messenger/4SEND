import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../../hooks/useI18n';
import { isFoldersEnabled, setFoldersEnabled } from '../../utils/folders';
import styles from './ChatSettingsModal.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOpenSubModal: (name: string) => void;
}

const menuItems = [
  {
    name: 'customization',
    gradient: 'linear-gradient(135deg,#B8A7F0,#8B7BD6)',
    iconPath: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
    titleKey: 'Кастомизация',
    subtitleKey: 'Кастомизация интерфейса мессенджера',
  },
  {
    name: 'hotkeys',
    gradient: 'linear-gradient(135deg,#667eea,#764ba2)',
    iconSvg: <svg viewBox="0 0 16 16" fill="currentColor" width="20" height="20"><path d="M0 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6zm13 .25v.5c0 .138.112.25.25.25h.5a.25.25 0 0 0 .25-.25v-.5a.25.25 0 0 0-.25-.25h-.5a.25.25 0 0 0-.25.25zM2.25 8a.25.25 0 0 0-.25.25v.5c0 .138.112.25.25.25h.5A.25.25 0 0 0 3 8.75v-.5A.25.25 0 0 0 2.75 8h-.5zM4 8.25v.5c0 .138.112.25.25.25h.5A.25.25 0 0 0 5 8.75v-.5A.25.25 0 0 0 4.75 8h-.5a.25.25 0 0 0-.25.25zM6.25 8a.25.25 0 0 0-.25.25v.5c0 .138.112.25.25.25h.5A.25.25 0 0 0 7 8.75v-.5A.25.25 0 0 0 6.75 8h-.5zM8 8.25v.5c0 .138.112.25.25.25h.5A.25.25 0 0 0 9 8.75v-.5A.25.25 0 0 0 8.75 8h-.5a.25.25 0 0 0-.25.25zM13.25 8a.25.25 0 0 0-.25.25v.5c0 .138.112.25.25.25h.5a.25.25 0 0 0 .25-.25v-.5a.25.25 0 0 0-.25-.25h-.5zm0 2a.25.25 0 0 0-.25.25v.5c0 .138.112.25.25.25h.5a.25.25 0 0 0 .25-.25v-.5a.25.25 0 0 0-.25-.25h-.5zm-3-2a.25.25 0 0 0-.25.25v.5c0 .138.112.25.25.25h1.5a.25.25 0 0 0 .25-.25v-.5a.25.25 0 0 0-.25-.25h-1.5zm.75 2.25v.5c0 .138.112.25.25.25h.5a.25.25 0 0 0 .25-.25v-.5a.25.25 0 0 0-.25-.25h-.5a.25.25 0 0 0-.25.25zM11.25 6a.25.25 0 0 0-.25.25v.5c0 .138.112.25.25.25h.5a.25.25 0 0 0 .25-.25v-.5a.25.25 0 0 0-.25-.25h-.5zM9 6.25v.5c0 .138.112.25.25.25h.5a.25.25 0 0 0 .25-.25v-.5A.25.25 0 0 0 9.75 6h-.5a.25.25 0 0 0-.25.25zM7.25 6a.25.25 0 0 0-.25.25v.5c0 .138.112.25.25.25h.5A.25.25 0 0 0 8 6.75v-.5A.25.25 0 0 0 7.75 6h-.5zM5 6.25v.5c0 .138.112.25.25.25h.5A.25.25 0 0 0 6 6.75v-.5A.25.25 0 0 0 5.75 6h-.5a.25.25 0 0 0-.25.25zM2.25 6a.25.25 0 0 0-.25.25v.5c0 .138.112.25.25.25h1.5A.25.25 0 0 0 4 6.75v-.5A.25.25 0 0 0 3.75 6h-1.5zM2 10.25v.5c0 .138.112.25.25.25h.5a.25.25 0 0 0 .25-.25v-.5a.25.25 0 0 0-.25-.25h-.5a.25.25 0 0 0-.25.25zM4.25 10a.25.25 0 0 0-.25.25v.5c0 .138.112.25.25.25h5.5a.25.25 0 0 0 .25-.25v-.5a.25.25 0 0 0-.25-.25h-5.5z"/></svg>,
    titleKey: 'Горячие клавиши',
    subtitleKey: 'Настройка сочетаний клавиш',
  },
  {
    name: 'sound',
    gradient: 'linear-gradient(135deg,#34c759,#28a745)',
    iconPath: 'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z',
    titleKey: 'Настройки звука',
    subtitleKey: 'Громкость уведомлений и звуковых эффектов',
  },
  {
    name: 'notifRepeat',
    gradient: 'linear-gradient(135deg,#e91e63,#c2185b)',
    iconPath: 'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z',
    titleKey: 'Повтор уведомлений',
    subtitleKey: 'Напоминания о непрочитанных',
  },
  {
    name: 'quickReaction',
    gradient: 'linear-gradient(135deg,#ff9500,#ff6b00)',
    iconPath: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z',
    titleKey: 'Быстрая реакция',
    subtitleKey: 'Выбор эмодзи для реакции по двойному нажатию',
  },
  {
    name: 'videoMessages',
    gradient: 'linear-gradient(135deg,#ff375f,#ff2d55)',
    iconPath: 'M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4zM14 14v2H5V7h9v4h2v3z',
    titleKey: 'Настройки видеосообщений',
    subtitleKey: 'Камера, качество, звук затвора и таймеры',
  },
  {
    name: 'archive',
    gradient: 'linear-gradient(135deg,#00c6ff,#0072ff)',
    iconPath: 'M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5L6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12.14l.82 1H5.12z',
    titleKey: 'Настройки архива',
    subtitleKey: 'Установка пароля на архив чатов',
  },
  {
    name: 'dataStorage',
    gradient: 'linear-gradient(135deg,#34aadc,#007aff)',
    iconSvg: (
      <svg viewBox="0 0 16 16" fill="currentColor">
        <path d="M4.318 2.687C5.234 2.271 6.536 2 8 2s2.766.27 3.682.687C12.644 3.125 13 3.627 13 4c0 .374-.356.875-1.318 1.313C10.766 5.729 9.464 6 8 6s-2.766-.27-3.682-.687C3.356 4.875 3 4.373 3 4c0-.374.356-.875 1.318-1.313M13 5.698V7c0 .374-.356.875-1.318 1.313C10.766 8.729 9.464 9 8 9s-2.766-.27-3.682-.687C3.356 7.875 3 7.373 3 7V5.698c.271.202.58.378.904.525C4.978 6.711 6.427 7 8 7s3.022-.289 4.096-.777A5 5 0 0 0 13 5.698M14 4c0-1.007-.875-1.755-1.904-2.223C11.022 1.289 9.573 1 8 1s-3.022.289-4.096.777C2.875 2.245 2 2.993 2 4v9c0 1.007.875 1.755 1.904 2.223C4.978 15.71 6.427 16 8 16s3.022-.289 4.096-.777C13.125 14.755 14 14.007 14 13zm-1 4.698V10c0 .374-.356.875-1.318 1.313C10.766 11.729 9.464 12 8 12s-2.766-.27-3.682-.687C3.356 10.875 3 10.373 3 10V8.698c.271.202.58.378.904.525C4.978 9.71 6.427 10 8 10s3.022-.289 4.096-.777A5 5 0 0 0 13 8.698m0 3V13c0 .374-.356.875-1.318 1.313C10.766 14.729 9.464 15 8 15s-2.766-.27-3.682-.687C3.356 13.875 3 13.373 3 13v-1.302c.271.202.58.378.904.525C4.978 12.71 6.427 13 8 13s3.022-.289 4.096-.777c.324-.147.633-.323.904-.525"/>
      </svg>
    ),
    titleKey: 'Данные и память',
    subtitleKey: 'Управление кэшем и автоматическая очистка',
  },
  {
    name: 'exportData',
    gradient: 'linear-gradient(135deg,#30d158,#28a745)',
    iconPath: 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z',
    titleKey: 'Экспорт данных',
    subtitleKey: 'Выгрузить историю чатов и информацию',
  },
  {
    name: 'language',
    gradient: 'linear-gradient(135deg,#af52de,#8e24aa)',
    iconPath: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm6.93 6h-2.95c-.32-1.25-.78-2.45-1.38-3.56 1.84.63 3.37 1.91 4.33 3.56zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2s.06 1.34.14 2H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56-1.84-.63-3.37-1.9-4.33-3.56zm2.95-8H5.08c.96-1.66 2.49-2.93 4.33-3.56C8.81 5.55 8.35 6.75 8.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66c-.09-.66-.16-1.32-.16-2s.07-1.35.16-2h4.68c.09.65.16 1.32.16 2s-.07 1.34-.16 2zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95c-.96 1.65-2.49 2.93-4.33 3.56zM16.36 14c.08-.66.14-1.32.14-2s-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z',
    titleKey: 'Язык',
    subtitleKey: 'Выбор языка интерфейса',
  },
  {
    name: 'reportBug',
    gradient: 'linear-gradient(135deg,#ff5a5f,#d93848)',
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
        <path d="M12 2L2 19h20L12 2zm-1 6h2v6h-2V8zm0 8h2v2h-2v-2z" />
      </svg>
    ),
    titleKey: 'Сообщить об ошибке',
    subtitleKey: 'Отправить отчёт об ошибке',
  },
  {
    name: 'faq',
    gradient: 'linear-gradient(135deg,#00c6ff,#3a86ff)',
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
        <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 16h-2v-2h2v2zm1.8-6.6c-.35.35-.8.62-1.3.86V13h-3v-1.5c0-.55.45-1 1-1s1 .45 1 1h1.5c0-1.38-1.12-2.5-2.5-2.5s-2.5 1.12-2.5 2.5c0 .7.29 1.33.75 1.78-.55.47-1.75 1.5-1.75 2.72h3c0-1 1-1.5 1.4-1.8.3-.2.6-.5.6-.9 0-.55.45-1 1-1s1 .45 1 1c0 .3-.13.56-.3.74z" />
      </svg>
    ),
    titleKey: 'FAQ / Центр помощи',
    subtitleKey: 'База знаний для пользователей',
  },
  {
    name: 'about',
    gradient: 'linear-gradient(135deg,#8e8e93,#636366)',
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
        <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
      </svg>
    ),
    titleKey: 'О приложении',
    subtitleKey: 'Версия, лицензии и политика конфиденциальности',
  },
];

const sections = [
  {
    titleKey: 'ОФОРМЛЕНИЕ',
    items: ['customization', 'language'],
  },
  {
    titleKey: 'УПРАВЛЕНИЕ',
    items: ['hotkeys', 'archive', 'quickReaction', 'videoMessages', 'dataStorage', 'exportData'],
  },
  {
    titleKey: 'УВЕДОМЛЕНИЯ',
    items: ['sound', 'notifRepeat'],
  },
];

export default function ChatSettingsModal({ isOpen, onClose, onOpenSubModal }: Props) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(isOpen);
  const [closing, setClosing] = useState(false);
  const [entered, setEntered] = useState(false);
  const [foldersOn, setFoldersOn] = useState(() => isFoldersEnabled());

  const toggleFolders = useCallback(() => {
    setFoldersOn(prev => {
      const next = !prev;
      setFoldersEnabled(next);
      return next;
    });
  }, []);

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

  const handleItemClick = useCallback((name: string) => {
    if (closing) return;
    setClosing(true);
    setTimeout(() => {
      setVisible(false);
      setClosing(false);
      onOpenSubModal(name);
    }, 400);
  }, [closing, onOpenSubModal]);

  const itemMap = new Map(menuItems.map(i => [i.name, i]));

  if (!visible) return null;

  return (
    <div
      className={`${styles.overlay} ${entered && !closing ? styles.open : ''} ${closing ? styles.closing : ''}`}
      onClick={handleClose}
    >
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>{t('Чаты')}</h2>
        </div>

        <div className={styles.scrollContent}>
          {sections.map(section => (
            <div key={section.titleKey}>
              <div className={styles.sectionHeader}>{t(section.titleKey)}</div>
              <div className={styles.sectionGroup}>
                {section.items.map(name => {
                  const item = itemMap.get(name)!;
                  return (
                    <button
                      key={item.name}
                      className={styles.hubItem}
                      onClick={() => handleItemClick(item.name)}
                    >
                      <div
                        className={styles.iconBox}
                        style={{ background: item.gradient }}
                      >
                        {'iconSvg' in item ? (item as any).iconSvg : (
                          <svg viewBox="0 0 24 24">
                            <path d={item.iconPath} />
                          </svg>
                        )}
                      </div>
                      <div className={styles.textBlock}>
                        <span className={styles.itemLabel}>{t(item.titleKey)}</span>
                        <span className={styles.itemDesc}>{t(item.subtitleKey)}</span>
                      </div>
                      <span className={styles.arrow}>›</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className={styles.sectionHeader}>{t('ДОПОЛНИТЕЛЬНО')}</div>
          <div className={styles.sectionGroup}>
            <div className={styles.hubItem} style={{ cursor: 'pointer' }} onClick={toggleFolders}>
              <div className={styles.iconBox} style={{ background: 'linear-gradient(135deg,#a74fff,#8b3dff)' }}>
                <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div className={styles.textBlock}>
                <span className={styles.itemLabel}>{t('Папки с чатами')}</span>
                <span className={styles.itemDesc}>{t('Группировка чатов по папкам')}</span>
              </div>
              <div className={`${styles.toggle} ${foldersOn ? styles.toggleOn : ''}`} onClick={e => { e.stopPropagation(); toggleFolders(); }}>
                <div className={styles.toggleKnob} />
              </div>
            </div>
          </div>

          <div className={styles.sectionHeader}>{t('ПОМОЩЬ')}</div>
          <div className={styles.sectionGroup}>
            {['reportBug', 'faq', 'about'].map(name => {
              const item = itemMap.get(name)!;
              return (
                <button
                  key={item.name}
                  className={styles.hubItem}
                  onClick={() => handleItemClick(item.name)}
                >
                  <div className={styles.iconBox} style={{ background: item.gradient }}>
                    {'iconSvg' in item ? (item as any).iconSvg : (
                      <svg viewBox="0 0 24 24">
                        <path d={item.iconPath} />
                      </svg>
                    )}
                  </div>
                  <div className={styles.textBlock}>
                    <span className={styles.itemLabel}>{t(item.titleKey)}</span>
                    <span className={styles.itemDesc}>{t(item.subtitleKey)}</span>
                  </div>
                  <span className={styles.arrow}>›</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
