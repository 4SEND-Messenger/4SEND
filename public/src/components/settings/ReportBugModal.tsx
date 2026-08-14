import { useState, useCallback } from 'react';
import { useI18n } from '../../hooks/useI18n';
import { api } from '../../services/api';
import { useUI } from '../../context/UIContext';
import { APP_VERSION } from '../../constants/version';
import ModalShell from './ModalShell';
import styles from './ReportBugModal.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES = [
  { value: 'bug', label: 'Ошибка в работе приложения', desc: 'Приложение работает неправильно', icon: <path d="M12 2L2 19h20L12 2zm-1 6h2v6h-2V8zm0 8h2v2h-2v-2z" /> },
  { value: 'account', label: 'Проблема с аккаунтом', desc: 'Вход, доступ и безопасность', icon: <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-3.31 0-8 1.67-8 5v1h16v-1c0-3.33-4.69-5-8-5z" /> },
  { value: 'suggestion', label: 'Предложение по улучшению', desc: 'Идея или фича-реквест', icon: <path d="M12 2a7 7 0 0 0-4 12.74V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.26A7 7 0 0 0 12 2zm-1 16v4a1 1 0 0 0 2 0v-4h-2z" /> },
];

export default function ReportBugModal({ isOpen, onClose }: Props) {
  const { t } = useI18n();
  const { showToast } = useUI();
  const [category, setCategory] = useState('bug');
  const [description, setDescription] = useState('');
  const [contact, setContact] = useState('');
  const [sending, setSending] = useState(false);

  const canSend = description.trim().length >= 5 && !sending;

  const handleSubmit = useCallback(async () => {
    if (!canSend) return;
    setSending(true);
    try {
      await api.post('/api/reports', {
        category,
        description: description.trim(),
        contact: contact.trim(),
        appVersion: APP_VERSION,
      });
      showToast(t('Спасибо! Отчёт отправлен.'), 'success');
      setDescription('');
      setContact('');
      setCategory('bug');
    } catch {
      showToast(t('Не удалось отправить отчёт. Попробуйте позже.'), 'error');
    } finally {
      setSending(false);
    }
  }, [canSend, category, description, contact, showToast, t]);

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title="Сообщить об ошибке" maxWidth="400px">
      <div className={styles.wrapper}>
        <div className={styles.categoryLabel}>{t('Тип обращения')}</div>
        <div className={styles.categories}>
          {CATEGORIES.map(cat => {
            const active = category === cat.value;
            return (
              <button
                key={cat.value}
                className={`${styles.category} ${active ? styles.categoryActive : ''}`}
                onClick={() => setCategory(cat.value)}
              >
                <div className={styles.categoryIcon}>
                  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                    {cat.icon}
                  </svg>
                </div>
                <div className={styles.categoryText}>
                  <span className={styles.categoryTitle}>{t(cat.label)}</span>
                  <span className={styles.categoryDesc}>{t(cat.desc)}</span>
                </div>
                <div className={`${styles.radio} ${active ? styles.radioOn : ''}`}>
                  {active && <div className={styles.radioDot} />}
                </div>
              </button>
            );
          })}
        </div>

        <textarea
          className={styles.textarea}
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder={t('Опишите проблему...')}
          maxLength={4000}
          rows={5}
        />

        <input
          className={styles.input}
          value={contact}
          onChange={e => setContact(e.target.value)}
          placeholder={t('Контакт для связи (необязательно)')}
          maxLength={500}
        />

        <button
          className={`${styles.submit} ${canSend ? styles.submitActive : ''}`}
          onClick={handleSubmit}
          disabled={!canSend}
        >
          {sending ? t('Отправка...') : t('Отправить отчёт')}
        </button>
      </div>
    </ModalShell>
  );
}