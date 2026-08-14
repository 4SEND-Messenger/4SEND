import { useCallback } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { useI18n } from '../../hooks/useI18n';
import ModalShell from './ModalShell';
import styles from './PrivacySettingsModal.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectOption: (key: string, title: string) => void;
}

const SECTIONS = [
  {
    titleKey: 'ПРОФИЛЬ',
    items: [
      { key: 'avatar', label: 'Фотография профиля' },
      { key: 'bio', label: 'О себе' },
      { key: 'status', label: 'Время последнего захода' },
    ],
  },
  {
    titleKey: 'СВЯЗЬ',
    items: [
      { key: 'messages', label: 'Личные сообщения' },
      { key: 'calls', label: 'Звонки' },
      { key: 'voice_video', label: 'Голосовые/видеосообщения' },
      { key: 'forwards', label: 'Пересылка сообщения' },
    ],
  },
  {
    titleKey: 'ПОИСК',
    items: [
      { key: 'search', label: 'Кто может меня найти' },
    ],
  },
];

const VALUE_LABELS: Record<string, string> = {
  all: 'Все',
  selected: 'Избранные',
  none: 'Никто',
};

export default function PrivacySettingsModal({ isOpen, onClose, onSelectOption }: Props) {
  const { t } = useI18n();
  const { privacyState } = useSettings();

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title={t('Настройки приватности')}>
      {SECTIONS.map((section) => (
        <div key={section.titleKey}>
          <div className={styles.sectionHeader}>{t(section.titleKey)}</div>
          <div className={styles.sectionGroup}>
            {section.items.map((item) => {
              const current = privacyState[item.key] || 'all';
              return (
                <button key={item.key} className={styles.row}
                  onClick={() => onSelectOption(item.key, t(item.label))}>
                  <span className={styles.rowLabel}>{t(item.label)}</span>
                  <div className={styles.rowRight}>
                    <span className={styles.rowValue}>{t(VALUE_LABELS[current] || 'all')}</span>
                    <span className={styles.rowArrow}>›</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </ModalShell>
  );
}
