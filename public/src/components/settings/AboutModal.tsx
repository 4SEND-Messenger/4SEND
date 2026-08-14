import { useI18n } from '../../hooks/useI18n';
import { APP_NAME, APP_VERSION } from '../../constants/version';
import ModalShell from './ModalShell';
import styles from './AboutModal.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const LICENSES = [
  { name: 'React', license: 'MIT' },
  { name: 'Vite', license: 'MIT' },
  { name: 'libsodium-wrappers', license: 'ISC' },
  { name: 'express', license: 'MIT' },
  { name: 'socket.io', license: 'MIT' },
  { name: 'idb', license: 'Apache-2.0' },
];

export default function AboutModal({ isOpen, onClose }: Props) {
  const { t } = useI18n();
  const year = new Date().getFullYear();

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title="О приложении" maxWidth="400px">
      <div className={styles.wrapper}>
        <div className={styles.hero}>
          <div className={styles.logo}>
            <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
          </div>
          <div className={styles.name}>{APP_NAME}</div>
          <div className={styles.version}>{t('Версия')} {APP_VERSION}</div>
        </div>

        <div className={styles.links}>
          <a href="/terms.html" target="_blank" rel="noreferrer" className={styles.link}>{t('Наши условия')}</a>
          <a href="/privacy.html" target="_blank" rel="noreferrer" className={styles.link}>{t('Наша политика')}</a>
          <a href="/changelog.html" target="_blank" rel="noreferrer" className={styles.link}>{t('История версий')}</a>
        </div>

        <div className={styles.sectionTitle}>{t('Лицензии')}</div>
        <div className={styles.licenses}>
          {LICENSES.map(lic => (
            <div key={lic.name} className={styles.licenseRow}>
              <span className={styles.licenseName}>{lic.name}</span>
              <span className={styles.licenseType}>{lic.license}</span>
            </div>
          ))}
        </div>

        <div className={styles.copyright}>
          © {year} {APP_NAME} {t('Все права защищены')}.
        </div>
      </div>
    </ModalShell>
  );
}