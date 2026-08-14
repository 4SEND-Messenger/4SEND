import { useRef, useCallback } from 'react';
import { useI18n } from '../hooks/useI18n';
import ModalShell from './settings/ModalShell';
import styles from './DeleteChatModal.module.css';

interface Props {
  chatName: string;
  isSecret?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteChatModal({ chatName, isSecret, onConfirm, onCancel }: Props) {
  const { t } = useI18n();
  const closeRef = useRef<(() => void) | null>(null);
  const actionRef = useRef<(() => void) | null>(null);

  const resolvedName =
    chatName === '4send_system' || chatName === 'Системные уведомления'
      ? t('Системные уведомления')
      : chatName === '4send_help' || chatName === 'Поддержка 4SEND'
        ? t('Поддержка 4SEND')
        : chatName;

  const handleCancel = useCallback(() => {
    actionRef.current = onCancel;
    closeRef.current?.();
  }, [onCancel]);

  const handleConfirm = useCallback(() => {
    actionRef.current = onConfirm;
    closeRef.current?.();
  }, [onConfirm]);

  return (
    <ModalShell isOpen={true} onClose={() => actionRef.current?.()} showClose={false} closeRef={closeRef}>
      <div className={styles.content}>
        <div className={styles.iconWrap}>
          <div className={styles.iconCircle}>
            <svg viewBox="0 0 24 24">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
            </svg>
          </div>
        </div>
        <h2 className={styles.title}>{t('Удаление чата')}</h2>
        <p className={styles.desc}>
          {isSecret
            ? <>{t('Вы точно хотите удалить всю секретную переписку с')} {resolvedName}? {t('Это действие нельзя будет отменить.')}</>
            : <>{t('Вы точно хотите удалить всю переписку с')} {resolvedName}? {t('Это действие нельзя будет отменить.')}</>
          }
        </p>
      </div>
      <div className={styles.actions}>
        <button onClick={handleCancel} className={styles.cancelBtn}>
          {t('ОТМЕНА')}
        </button>
        <button onClick={handleConfirm} className={styles.deleteBtn}>
          {t('УДАЛИТЬ')}
        </button>
      </div>
    </ModalShell>
  );
}
