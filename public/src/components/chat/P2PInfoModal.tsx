import { useState, useCallback, useEffect, useRef } from 'react';
import { useI18n } from '../../hooks/useI18n';
import styles from './P2PInfoModal.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAgree: () => void;
}

function P2PInfoModal({ isOpen, onClose, onAgree }: Props) {
  const { t } = useI18n();
  const [closing, setClosing] = useState(false);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const rafRef = useRef<number>(0);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const animateClose = useCallback(() => {
    setClosing(true);
    timerRef.current = setTimeout(() => {
      onCloseRef.current();
    }, 300);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') animateClose();
  }, [animateClose]);

  useEffect(() => {
    if (!isOpen) return;
    setClosing(false);
    setOpen(false);
    rafRef.current = requestAnimationFrame(() => setOpen(true));
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className={`${styles.overlay}${open ? ` ${styles.overlayOpen}` : ''}${closing ? ` ${styles.closing}` : ''}`}
      onClick={e => { if (e.target === e.currentTarget) animateClose(); }}
    >
      <div className={`${styles.modal}${open ? ` ${styles.modalOpen}` : ''}${closing ? ` ${styles.modalClosing}` : ''}`}>
        <div className={styles.modalBgGlow} />
        <div className={styles.modalContent}>
          <div className={`${styles.iconWrap}${open ? ` ${styles.iconWrapPulse}` : ''}`}>
            <svg viewBox="0 0 24 24" className={styles.icon}>
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
            </svg>
          </div>
          <h3 className={styles.title}>{t('P2P-передача файла')}</h3>
          <p className={styles.subtitle}>{t('Как это работает и чем отличается от обычной загрузки')}</p>

          <div className={styles.comparison}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.cardLabel}>
                  <svg viewBox="0 0 24 24" style={{ width: 14, height: 14 }} className={styles.serverLabelIcon}>
                    <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
                  </svg>
                  {t('Через сервер')}
                </div>
                <span className={`${styles.cardTag} ${styles.tagServer}`}>≤25MB</span>
              </div>
              <div className={styles.diagramWrap}>
                <svg viewBox="0 0 200 44" className={styles.diagram}>
                  <line x1="31" y1="22" x2="80" y2="22" className={styles.pathGlow} />
                  <line x1="120" y1="22" x2="169" y2="22" className={styles.pathGlow} />
                  <line x1="31" y1="22" x2="80" y2="22" className={styles.pathLine} />
                  <line x1="120" y1="22" x2="169" y2="22" className={styles.pathLine} />
                  <line x1="31" y1="22" x2="80" y2="22" className={styles.pathLineDraw} style={{ strokeDasharray: 49, strokeDashoffset: 49 }} />
                  <line x1="120" y1="22" x2="169" y2="22" className={styles.pathLineDraw} style={{ strokeDasharray: 49, strokeDashoffset: 49 }} />
                  <circle cx="22" cy="22" r="9" className={styles.nodeCircleActive} />
                  <svg x="15" y="15" width="14" height="14" viewBox="0 0 24 24" className={styles.nodeIcon}>
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                  <rect x="80" y="12" width="40" height="20" rx="5" className={`${styles.serverRect} ${styles.serverRectPulse}`} />
                  <svg x="94" y="16" width="12" height="12" viewBox="0 0 24 24" className={styles.serverIcon}>
                    <path d="M20 13H4c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h16c.55 0 1-.45 1-1v-6c0-.55-.45-1-1-1zm0 5H4v-2h16v2zm0-11H4c-.55 0-1 .45-1 1v2c0 .55.45 1 1 1h16c.55 0 1-.45 1-1V8c0-.55-.45-1-1-1zm0 4H4V8h16v2z"/>
                  </svg>
                  <circle cx="178" cy="22" r="9" className={styles.nodeCircleActive} />
                  <svg x="171" y="15" width="14" height="14" viewBox="0 0 24 24" className={styles.nodeIcon}>
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                  <circle cx="31" cy="22" r="2.5" className={`${styles.dot} ${styles.dotServer1}`} />
                  <circle cx="31" cy="22" r="2.5" className={`${styles.dot} ${styles.dotServer2}`} />
                  <circle cx="120" cy="22" r="2.5" className={`${styles.dot} ${styles.dotServer3}`} />
                  <circle cx="120" cy="22" r="2.5" className={`${styles.dot} ${styles.dotServer4}`} />
                </svg>
              </div>
              <div className={styles.cardInfo}>
                <div className={styles.cardInfoItem}>
                  <svg viewBox="0 0 24 24" className={styles.cardInfoIcon}>
                    <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
                  </svg>
                  {t('файл на сервере')}
                </div>
                <div className={styles.cardInfoItem}>
                  <svg viewBox="0 0 24 24" className={styles.cardInfoIcon}>
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                  {t('лимит 25 МБ')}
                </div>
              </div>
            </div>

            <div className={`${styles.card} ${styles.cardP2p}`}>
              <div className={styles.cardP2pGlow} />
              <div className={styles.cardHeader}>
                <div className={styles.cardLabel}>
                  <svg viewBox="0 0 24 24" style={{ width: 14, height: 14 }} className={styles.p2pLabelIcon}>
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                  </svg>
                  {t('P2P напрямую')}
                </div>
                <span className={`${styles.cardTag} ${styles.tagP2p}`}>{t('без лимита')}</span>
              </div>
              <div className={styles.diagramWrap}>
                <svg viewBox="0 0 200 44" className={styles.diagram}>
                  <line x1="31" y1="22" x2="169" y2="22" className={styles.pathGlow} />
                  <line x1="31" y1="22" x2="169" y2="22" className={styles.pathLine} />
                  <line x1="31" y1="22" x2="169" y2="22" className={styles.pathLineDrawP2p} style={{ strokeDasharray: 138, strokeDashoffset: 138 }} />
                  <circle cx="22" cy="22" r="9" className={styles.nodeCircleActive} />
                  <svg x="15" y="15" width="14" height="14" viewBox="0 0 24 24" className={styles.nodeIcon}>
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                  <svg x="91" y="13" width="16" height="16" viewBox="0 0 24 24" className={styles.p2pLabelIcon}>
                    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
                  </svg>
                  <circle cx="178" cy="22" r="9" className={styles.nodeCircleActive} />
                  <svg x="171" y="15" width="14" height="14" viewBox="0 0 24 24" className={styles.nodeIcon}>
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                  <circle cx="31" cy="22" r="2.5" className={`${styles.dot} ${styles.dotP2p1}`} />
                  <circle cx="31" cy="22" r="2.5" className={`${styles.dot} ${styles.dotP2p2}`} />
                  <circle cx="169" cy="22" r="2.5" className={`${styles.dot} ${styles.dotP2p3}`} />
                  <circle cx="169" cy="22" r="2.5" className={`${styles.dot} ${styles.dotP2p4}`} />
                  <circle cx="100" cy="22" r="5" className={styles.dotP2pGlow} />
                </svg>
              </div>
              <div className={styles.cardInfo}>
                <div className={styles.cardInfoItem}>
                  <svg viewBox="0 0 24 24" className={styles.cardInfoIcon}>
                    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
                  </svg>
                  {t('шифрование')}
                </div>
                <div className={styles.cardInfoItem}>
                  <svg viewBox="0 0 24 24" style={{ width: 12, height: 12 }} className={styles.greenIcon}>
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                  {t('без ограничений')}
                </div>
              </div>
            </div>
          </div>

          <div className={styles.divider} />

          <div className={styles.bottomColumns}>
          <div className={styles.advantages}>
            <div className={styles.advTitle}>{t('Когда выбирать P2P:')}</div>
            <div className={styles.advList}>
              <div className={styles.advItem}>
                <svg viewBox="0 0 24 24" className={styles.advItemIcon}>
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <span>{t('Файлы больше 25 МБ (видео, архивы, ISO)')}</span>
              </div>
              <div className={styles.advItem}>
                <svg viewBox="0 0 24 24" className={styles.advItemIcon}>
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <span>{t('Конфиденциальные данные - файл не сохраняется на сервере')}</span>
              </div>
              <div className={styles.advItem}>
                <svg viewBox="0 0 24 24" className={styles.advItemIcon}>
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <span>{t('Оба собеседника онлайн с хорошим интернетом')}</span>
              </div>
              <div className={styles.advItem}>
                <svg viewBox="0 0 24 24" className={styles.advItemIcon}>
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <span>{t('Скорость передачи зависит только от интернета собеседников')}</span>
              </div>
            </div>
          </div>

          <div className={styles.nuances}>
            <div className={styles.nuanceTitle}>{t('Нюансы')}</div>
            <div className={styles.nuanceList}>
              <div className={styles.nuanceItem}>
                <svg viewBox="0 0 24 24" className={styles.nuanceIcon}>
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <span>{t('Оба собеседника должны быть онлайн всё время передачи - при отключении передача прервётся')}</span>
              </div>
              <div className={styles.nuanceItem}>
                <svg viewBox="0 0 24 24" className={styles.nuanceIcon}>
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <span>{t('При неудаче прямого соединения WebRTC использует TURN-сервер (данные шифруются, но скорость может быть ниже)')}</span>
              </div>
              <div className={styles.nuanceItem}>
                <svg viewBox="0 0 24 24" className={styles.nuanceIcon}>
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <span>{t('Вкладка браузера должна оставаться открытой на время передачи')}</span>
              </div>
              <div className={styles.nuanceItem}>
                <svg viewBox="0 0 24 24" className={styles.nuanceIcon}>
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <span>{t('Размер ограничен доступной памятью браузера (обычно до 2 ГБ)')}</span>
              </div>
              <div className={styles.nuanceItem}>
                <svg viewBox="0 0 24 24" className={styles.nuanceIcon}>
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <span>{t('Файл не дублируется на сервере - убедитесь, что собеседник его скачал')}</span>
              </div>
            </div>
          </div>
          </div>

          <button className={styles.btn} onClick={() => { animateClose(); setTimeout(onAgree, 300); }}>
            {t('Понятно, я согласен')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default P2PInfoModal;
