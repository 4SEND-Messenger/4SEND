import { useEffect, useState } from 'react';
import { Lock } from '../../utils/svg';
import { e2ee } from '../../utils/e2ee';
import { getIdentity } from '../../utils/e2ee/storage';
import { getIdentityPublicKeyBase64 } from '../../utils/e2ee/identity';
import styles from './FingerprintModal.module.css';

interface Props {
  contactUsername: string;
  contactDisplayName?: string;
  onClose: () => void;
}

function colorClass(i: number): string {
  const colors = [styles.color0, styles.color1, styles.color2, styles.color3];
  return colors[i % colors.length]!;
}

export default function FingerprintModal({ contactUsername, contactDisplayName, onClose }: Props) {
  const [fingerprint, setFingerprint] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const identity = await getIdentity();
        if (identity) {
          const fp = await e2ee.getFingerprint(await getIdentityPublicKeyBase64());
          setFingerprint(fp);
        }
      } catch {}
    })();
  }, [contactUsername]);

  const handleCopy = () => {
    navigator.clipboard.writeText(fingerprint.replace(/\s/g, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const groups = fingerprint.split(' ');

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.card} onClick={e => e.stopPropagation()}>
        <div className={styles.lockIcon}><Lock /></div>
        <div className={styles.title}>End-to-End Encrypted</div>
        <div className={styles.contactName}>{contactDisplayName || contactUsername}</div>

        <div className={styles.divider} />

        <div className={styles.fingerprintLabel}>Fingerprint</div>
        <div className={styles.fingerprint} onClick={handleCopy} title="Click to copy">
          {groups.map((g, i) => (
            <span key={i} className={colorClass(Math.floor(i / 2))}>{g}{i < groups.length - 1 ? '\u00A0' : ''}</span>
          ))}
        </div>
        <div className={styles.hint}>{copied ? 'Copied!' : 'Tap to copy'}</div>

        <button className={styles.closeBtn} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
