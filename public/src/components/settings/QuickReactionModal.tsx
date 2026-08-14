import { useCallback } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { useI18n } from '../../hooks/useI18n';
import ModalShell from './ModalShell';
import styles from './QuickReactionModal.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const emojis = ['👍', '❤️', '😂', '😮', '😡', '🔥', '👏', '🎉', '💘', '😜', '🙈', '😔'];

export default function QuickReactionModal({ isOpen, onClose }: Props) {
  const { quickReaction, setQuickReaction } = useSettings();
  const { t } = useI18n();

  const handleSelect = useCallback((emoji: string) => {
    setQuickReaction(emoji);
  }, [setQuickReaction]);

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title={t('Быстрая реакция')}>
      <div className={styles.subtitle}>{t('Выберите реакцию для двойного клика')}</div>
      <div className={styles.grid}>
        {emojis.map((emoji, i) => (
          <div
            key={i}
            className={`${styles.emojiItem} ${quickReaction === emoji ? styles.selected : ''}`}
            onClick={() => handleSelect(emoji)}
          >
            <span className={styles.emoji}>{emoji}</span>
            {quickReaction === emoji && (
              <div className={styles.checkBadge}>
                <svg viewBox="0 0 24 24" width="12" height="12" fill="#fff">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>
    </ModalShell>
  );
}
