import { useState } from 'react';
import { useI18n } from '../../hooks/useI18n';
import ModalShell from './ModalShell';
import styles from './FaqModal.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onContactSupport: () => void;
}

const FAQ_ITEMS = [
  { q: 'Что такое E2EE и как включить шифрование?', a: 'Сквозное шифрование (E2EE) защищает базу данных, которая хранится на устройстве. Чтобы включить его, откройте настройки безопасности и задайте ключ из 3 букв и 3 цифр. Данные шифруются алгоритмами Argon2id и XChaCha20. Ключ нужно вводить при каждом запуске приложения.' },
  { q: 'Как создать папку для чатов?', a: 'Папки группируют чаты в отдельных разделах списка. Откройте контекстное меню чата, выберите пункт «Папка» и укажите название. Папки хранятся локально на устройстве.' },
  { q: 'Как экспортировать историю чатов?', a: 'Экспорт выгружает историю чатов и данные аккаунта в файлы HTML и JSON. Раздел «Экспорт данных» находится в настройках, после экспорта файлы сохраняются на устройство.' },
  { q: 'Что такое секретный чат?', a: 'Секретный чат защищён сквозным шифрованием (E2EE). Сообщения расшифровываются только на вашем устройстве, поэтому их могут прочитать только вы и ваш собеседник.' },
  { q: 'Как работает таймер автоудаления сообщений?', a: 'Сообщения в чате автоматически удаляются через заданный интервал времени. Таймер можно настроить в контекстном меню чата.' },
  { q: 'Есть ли лимит на размер файла?', a: 'Максимальный размер вложений зависит от типа файла и ограничен настройками сервера.' },
  { q: 'Как восстановить доступ к аккаунту?', a: 'Восстановление доступа к аккаунту выполняется по данным аккаунта. Если вы забыли ключ шифрования базы данных, восстановить данные невозможно, так как без ключа расшифровать их нельзя.' },
  { q: 'Как очистить кэш и освободить память?', a: 'Откройте раздел «Данные и память» в настройках. В нём доступны очистка кэша и автоматическая очистка вложений.' },
  { q: 'Как отключить уведомления?', a: 'Звук уведомлений настраивается в разделе «Настройки звука», а повтор уведомлений в разделе «Повтор уведомлений».' },
  { q: 'Как удалить аккаунт?', a: 'Удаление аккаунта необратимо и не может быть отменено. Восстановить удалённые данные невозможно.' },
];

export default function FaqModal({ isOpen, onClose, onContactSupport }: Props) {
  const { t } = useI18n();
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title="FAQ / Центр помощи" maxWidth="400px">
      <div className={styles.list}>
        {FAQ_ITEMS.map((item, idx) => {
          const open = openIdx === idx;
          return (
            <div key={idx} className={`${styles.item} ${open ? styles.itemOpen : ''}`}>
              <button className={styles.itemHead} onClick={() => setOpenIdx(open ? null : idx)}>
                <span className={styles.itemQ}>{t(item.q)}</span>
                <svg className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {open && <div className={styles.itemA}>{t(item.a)}</div>}
            </div>
          );
        })}
      </div>
      <button className={styles.supportBtn} onClick={onContactSupport}>
        {t('Связаться с поддержкой')}
      </button>
    </ModalShell>
  );
}