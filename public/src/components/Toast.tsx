import { useEffect, useState } from 'react';
import { useUI } from '../context/UIContext';
import styles from './Toast.module.css';

export default function Toast() {
  const { toasts, hideToast } = useUI();

  if (!toasts.length) return null;

  return (
    <div className={styles.container}>
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onHide={() => hideToast(toast.id)} />
      ))}
    </div>
  );
}

interface ItemProps {
  toast: { id: string; text: string; type: 'info' | 'success' | 'error' };
  onHide: () => void;
}

function ToastItem({ toast, onHide }: ItemProps) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const total = 3000;
    const startLeave = total - 300;
    const t1 = setTimeout(() => setLeaving(true), startLeave);
    return () => clearTimeout(t1);
  }, []);

  const typeClass =
    toast.type === 'error' ? styles.error
      : toast.type === 'success' ? styles.success
        : styles.info;

  const Icon = toast.type === 'error'
    ? <svg viewBox="0 0 24 24" className={styles.icon}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>
    : toast.type === 'success'
      ? <svg viewBox="0 0 24 24" className={styles.icon}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" /></svg>
      : <svg viewBox="0 0 24 24" className={styles.icon}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" /></svg>;

  return (
    <div
      className={`${styles.toast} ${typeClass} ${leaving ? styles.leaving : ''}`}
      onClick={onHide}
    >
      {Icon}
      <span>{toast.text}</span>
    </div>
  );
}
