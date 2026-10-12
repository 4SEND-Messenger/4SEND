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
          <img src="/ico.png" alt={APP_NAME} className={styles.logo} />
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