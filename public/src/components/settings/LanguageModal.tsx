import { useCallback } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { useI18n, SUPPORTED_LANGS, LANG_NAMES, type AppLang } from '../../hooks/useI18n';
import ModalShell from './ModalShell';
import styles from './SubModalOptions.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function LanguageModal({ isOpen, onClose }: Props) {
  const { language, setLanguage } = useSettings();
  const { switchLanguage, t } = useI18n();

  const handleSelect = useCallback((lang: AppLang) => {
    setLanguage(lang);
    switchLanguage(lang);
  }, [setLanguage, switchLanguage]);

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title={t('Язык')}>
      <div className={styles.options}>
        {SUPPORTED_LANGS.map(key => {
          const active = language === key;
          return (
            <div
              key={key}
              className={`${styles.option} ${active ? styles.selected : ''}`}
              style={active ? { background: 'rgba(175,82,222,0.15)', borderColor: '#af52de' } : undefined}
              onClick={() => handleSelect(key)}
            >
              <span>{LANG_NAMES[key]}</span>
              {active && (
                <div className={styles.checkCircle} style={{ background: '#af52de' }}>
                  <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: '#fff' }}>
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ModalShell>
  );
}