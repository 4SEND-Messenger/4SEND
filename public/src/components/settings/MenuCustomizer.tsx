import { useState, useRef } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { useI18n } from '../../hooks/useI18n';
import styles from './MenuCustomizer.module.css';

const MENU_ITEM_LABELS: Record<string, string> = {
  pin: 'Закрепить',
  archive: 'Архивировать',
  mute: 'Уведомления',
  block: 'Заблокировать',
  delete_chat: 'Удалить чат',
  search: 'Поиск в чате',
  autoDelete: 'Автоудаление',
  stats: 'Статистика',
  profile: 'Профиль',
  members: 'Участники',
  reply: 'Ответить',
  copy: 'Копировать',
  forward: 'Переслать',
  save: 'В избранное',
  pin_msg: 'Закрепить',
  select: 'Выбрать',
  edit: 'Изменить',
  delete_msg: 'Удалить',
};

const MENU_TITLES: Record<string, string> = {
  chat_ctx: 'Контекстное меню чата',
  chat_header: 'Меню шапки чата',
  msg_ctx: 'Контекстное меню сообщения',
};

const ALL_ITEMS: Record<string, string[]> = {
  chat_ctx: ['pin', 'archive', 'mute', 'block', 'delete_chat'],
  chat_header: ['search', 'mute', 'block', 'autoDelete', 'stats', 'profile', 'members', 'delete_chat'],
  msg_ctx: ['reply', 'copy', 'forward', 'save', 'pin_msg', 'select', 'edit', 'delete_msg'],
};

const ALL_MENUS = ['chat_ctx', 'chat_header', 'msg_ctx'];

export default function MenuCustomizer() {
  const { t } = useI18n();
  const { menuItems, setMenuOrder } = useSettings();
  const [dragMenu, setDragMenu] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const dragOverIdxRef = useRef<number | null>(null);

  const handleDragStart = (menu: string, idx: number) => {
    setDragMenu(menu);
    setDragIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    dragOverIdxRef.current = idx;
  };

  const handleDrop = (menu: string, idx: number) => {
    if (dragMenu !== menu || dragIdx === null || dragIdx === idx) return;
    const items = [...(menuItems[menu] ?? [])];
    const [moved] = items.splice(dragIdx, 1);
    items.splice(idx, 0, moved);
    setMenuOrder(menu, items);
    setDragMenu(null);
    setDragIdx(null);
    dragOverIdxRef.current = null;
  };

  const toggleItem = (menu: string, id: string) => {
    const items = menuItems[menu] ?? [];
    const idx = items.indexOf(id);
    if (idx >= 0) {
      setMenuOrder(menu, items.filter(i => i !== id));
    } else {
      setMenuOrder(menu, [...items, id]);
    }
  };

  return (
    <div className={styles.grid}>
      {ALL_MENUS.map(menu => {
        const allDefined = ALL_ITEMS[menu];
        const order = (menuItems[menu] ?? []).filter(id => allDefined!.includes(id));
        const visible = order.filter(id => id !== undefined);
        const hidden = allDefined.filter(id => !visible.includes(id));
        return (
          <div key={menu} className={styles.menuCol}>
            <div className={styles.menuTitle}>{t(MENU_TITLES[menu])}</div>
            <div className={styles.menuList}>
              {visible.map((id, idx) => (
                <div
                  key={id}
                  className={`${styles.menuRow} ${dragMenu === menu && dragIdx === idx ? styles.dragging : ''}`}
                  draggable
                  onDragStart={() => handleDragStart(menu, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={() => handleDrop(menu, idx)}
                  onDragEnd={() => { setDragMenu(null); setDragIdx(null); }}
                >
                  <span className={styles.dragHandle}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="#666">
                      <path d="M3 15h18v-2H3v2zm0 4h18v-2H3v2zm0-8h18V9H3v2zm0-6v2h18V5H3z" />
                    </svg>
                  </span>
                  <span className={styles.itemLabel}>{t(MENU_ITEM_LABELS[id] || id)}</span>
                  <div className={`${styles.toggleBtn} ${styles.toggleOn}`} onClick={() => toggleItem(menu, id)}>
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="#fff"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" /></svg>
                  </div>
                </div>
              ))}
              {hidden.map(id => (
                <div key={id} className={`${styles.menuRow} ${styles.menuRowHidden}`}>
                  <span className={styles.dragHandle} style={{ opacity: 0.2 }}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="#666">
                      <path d="M3 15h18v-2H3v2zm0 4h18v-2H3v2zm0-8h18V9H3v2zm0-6v2h18V5H3z" />
                    </svg>
                  </span>
                  <span className={styles.itemLabel} style={{ color: '#555' }}>{t(MENU_ITEM_LABELS[id] || id)}</span>
                  <div className={styles.toggleBtn} onClick={() => toggleItem(menu, id)}>
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="#fff"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" /></svg>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
