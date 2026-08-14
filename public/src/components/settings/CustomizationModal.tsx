import { useSettings } from '../../context/SettingsContext';
import { useI18n } from '../../hooks/useI18n';
import ModalShell from './ModalShell';
import MenuCustomizer from './MenuCustomizer';
import styles from './CustomizationModal.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const sizes = [
  { key: 'small' as const, label: 'Мелкий', px: 14 },
  { key: 'medium' as const, label: 'Средний', px: 16 },
  { key: 'large' as const, label: 'Крупный', px: 18 },
];

const fontOptions = [
  {
    key: 'ubuntu-noto' as const,
    label: 'По умолчанию',
    headingFont: '"Ubuntu", sans-serif',
    bodyFont: '"Noto Sans", sans-serif',
    heading: 'Ubuntu Bold',
    body: 'Noto Sans Regular',
  },
  {
    key: 'default' as const,
    label: 'Plus Jakarta Sans',
    headingFont: '"Plus Jakarta Sans", sans-serif',
    bodyFont: '"Plus Jakarta Sans", sans-serif',
    heading: 'Plus Jakarta Sans',
    body: 'Plus Jakarta Sans',
  },
  {
    key: 'gilroy-inter' as const,
    label: 'Gilroy + Inter',
    headingFont: '"Gilroy", sans-serif',
    bodyFont: '"Inter", sans-serif',
    heading: 'Gilroy Bold',
    body: 'Inter Regular',
  },
  {
    key: 'unbounded-onest' as const,
    label: 'Unbounded + Onest',
    headingFont: '"Unbounded", sans-serif',
    bodyFont: '"Onest", sans-serif',
    heading: 'Unbounded 700',
    body: 'Onest Regular',
  },
  {
    key: 'sf-display-text' as const,
    label: 'SF Pro Display + SF Pro Text',
    headingFont: '"SF Pro Display", sans-serif',
    bodyFont: '"SF Pro Text", sans-serif',
    heading: 'SF Pro Display Bold',
    body: 'SF Pro Text Regular',
  },
  {
    key: 'montserrat-roboto' as const,
    label: 'Montserrat + Roboto',
    headingFont: '"Montserrat", sans-serif',
    bodyFont: '"Roboto", sans-serif',
    heading: 'Montserrat Bold',
    body: 'Roboto Regular',
  },
  {
    key: 'manrope-inter' as const,
    label: 'Manrope + Inter',
    headingFont: '"Manrope", sans-serif',
    bodyFont: '"Inter", sans-serif',
    heading: 'Manrope Bold',
    body: 'Inter Regular',
  },
  {
    key: 'golos-onest' as const,
    label: 'Golos Text + Onest',
    headingFont: '"Golos Text", sans-serif',
    bodyFont: '"Onest", sans-serif',
    heading: 'Golos Text Bold',
    body: 'Onest Regular',
  },
  {
    key: 'rubik-geometria' as const,
    label: 'Rubik + Geometria',
    headingFont: '"Rubik", sans-serif',
    bodyFont: '"Geometria", sans-serif',
    heading: 'Rubik Bold',
    body: 'Geometria Regular',
  },
  {
    key: 'clash-satoshi' as const,
    label: 'Clash Display + Satoshi',
    headingFont: '"Clash Display", sans-serif',
    bodyFont: '"Satoshi", sans-serif',
    heading: 'Clash Display Bold',
    body: 'Satoshi Regular',
  },
];

const themeOptions = [
  {
    key: 'classic' as const,
    label: 'Черника & космос',
    accent: '#a74fff',
    bg: '#0a0a0c',
  },
  {
    key: 'lavender-graphite' as const,
    label: 'Лаванда & графит',
    accent: '#B8A7F0',
    bg: '#232329',
  },
  {
    key: 'oil-ink' as const,
    label: 'Масло & чернила',
    accent: '#F2D06B',
    bg: '#1E2530',
  },
  {
    key: 'mint-espresso' as const,
    label: 'Мята & эспрессо',
    accent: '#B9E5C8',
    bg: '#2B1A12',
  },
  {
    key: 'sage-slate' as const,
    label: 'Шалфей & тёмный слайт',
    accent: '#9CAF88',
    bg: '#2F3E46',
  },
  {
    key: 'dusty-rose' as const,
    label: 'Пыльная роза & черничный уголь',
    accent: '#CCA7A3',
    bg: '#1A1C29',
  },
  {
    key: 'eucalyptus-asphalt' as const,
    label: 'Туманный эвкалипт & мокрый асфальт',
    accent: '#A3B19B',
    bg: '#252627',
  },
  {
    key: 'oat-chocolate' as const,
    label: 'Овсяный крем & горький шоколад',
    accent: '#E6DFD3',
    bg: '#2B211B',
  },
  {
    key: 'polar-mint-ocean' as const,
    label: 'Полярная мята & ночной океан',
    accent: '#BFFCC6',
    bg: '#0D1B2A',
  },
  {
    key: 'ash-rose-marengo' as const,
    label: 'Пепел розы & маренго',
    accent: '#B59A9A',
    bg: '#20242C',
  },
  {
    key: 'olive-anthracite' as const,
    label: 'Спелая олива & антрацит',
    accent: '#8A9A86',
    bg: '#1C1E21',
  },
  {
    key: 'meltwater-monsoon' as const,
    label: 'Талая вода & глубокий муссон',
    accent: '#A9BCC6',
    bg: '#1E252B',
  },
  {
    key: 'wild-honey-obsidian' as const,
    label: 'Дикий мёд & обсидиан',
    accent: '#D0A36E',
    bg: '#191A1C',
  },
  {
    key: 'gray-sage-noir' as const,
    label: 'Серая шалфей & нуар',
    accent: '#B2C2B7',
    bg: '#15161A',
  },
  {
    key: 'jade-graphite' as const,
    label: 'Нефрит & матовый графит',
    accent: '#9DB3A4',
    bg: '#1F2221',
  },
  {
    key: 'terracotta-basalt' as const,
    label: 'Терракота & базальт',
    accent: '#C87D6B',
    bg: '#1A1615',
  },
  {
    key: 'cyan-abyss' as const,
    label: 'Циан & кибербездна',
    accent: '#5FD9D0',
    bg: '#0A0E12',
  },
  {
    key: 'crimson-twilight' as const,
    label: 'Багряный закат & сумрак',
    accent: '#C6686A',
    bg: '#161214',
  },
];

const bubbleRadiuses = [
  { key: 'none' as const, label: 'Острые', radius: 0 },
  { key: 'small' as const, label: 'Малый', radius: 10 },
  { key: 'medium' as const, label: 'Средний', radius: 18 },
  { key: 'large' as const, label: 'Крупный', radius: 28 },
  { key: 'full' as const, label: 'Пилюля', radius: 50 },
];

export default function CustomizationModal({ isOpen, onClose }: Props) {
  const { textSize, setTextSize, fontFamily, setFontFamily, theme, setTheme, bubbleRadius, setBubbleRadius, animationSpeed, setAnimationSpeed, showTime, setShowTime, showRead, setShowRead, showEdited, setShowEdited, showTimer, setShowTimer, statusIndicator, setStatusIndicator, avatarStyle, setAvatarStyle, chatBackground, setChatBackground, messageAlignment, setMessageAlignment, density, setDensity, scrollbarWidth, setScrollbarWidth, sidebarWidth, setSidebarWidth } = useSettings();
  const { t } = useI18n();

  const activeFont = fontOptions.find(f => f.key === fontFamily) || fontOptions[0];
  const activeTheme = themeOptions.find(th => th.key === theme) || themeOptions[0]!;

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title={t('Кастомизация')} maxWidth="900px">
      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t('Размер текста')}</div>
        <div className={styles.sectionDesc}>{t('Изменяет размер шрифта во всём интерфейсе')}</div>
        <div className={styles.optionsRow}>
          {sizes.map(s => {
            const active = textSize === s.key;
            return (
              <div
                key={s.key}
                className={`${styles.card} ${active ? styles.cardActive : ''}`}
                onClick={() => setTextSize(s.key)}
              >
                <div className={styles.sampleWrap} style={{ fontSize: s.px }}>
                  <div className={styles.sampleHeading}>Aa</div>
                  <div className={styles.sampleBody}>{t('Пример текста')}</div>
                </div>
                <div className={styles.cardLabel}>{t(s.label)}</div>
                {active && (
                  <span className={styles.cardCheck}>
                    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12l4 4L18 6" />
                    </svg>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t('Шрифт')}</div>
        <div className={styles.sectionDesc}>{t('Выберите гарнитуру для заголовков и основного текста')}</div>
        <div className={styles.optionsColumn}>
          {fontOptions.map(f => {
            const active = fontFamily === f.key;
            return (
              <div
                key={f.key}
                className={`${styles.fontCard} ${active ? styles.fontCardActive : ''}`}
                onClick={() => setFontFamily(f.key)}
              >
                <div className={styles.fontPreview}>
                  <span className={styles.fontHeading} style={{ fontFamily: f.headingFont }}>
                    {f.heading}
                  </span>
                  <span className={styles.fontBody} style={{ fontFamily: f.bodyFont }}>
                    {f.body}
                  </span>
                </div>
                <div className={styles.fontLabel}>{t(f.label)}</div>
                {active && (
                  <span className={styles.cardCheck}>
                    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12l4 4L18 6" />
                    </svg>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t('Форма баблов')}</div>
        <div className={styles.sectionDesc}>{t('Скругление углов сообщений и звонков')}</div>
        <div className={styles.optionsRow}>
          {bubbleRadiuses.map(r => {
            const active = bubbleRadius === r.key;
            return (
              <div
                key={r.key}
                className={`${styles.cardBubble} ${active ? styles.cardActive : ''}`}
                onClick={() => setBubbleRadius(r.key)}
              >
                <div className={styles.bubblePreview}>
                  <div className={styles.bubbleSample} style={{ borderRadius: r.radius || 4 }} />
                </div>
                <div className={styles.cardLabel}>{t(r.label)}</div>
                {active && (
                  <span className={styles.cardCheck}>
                    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12l4 4L18 6" />
                    </svg>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t('Скрытие элементов')}</div>
        <div className={styles.sectionDesc}>{t('Показывать или скрывать отдельные элементы внутри сообщений')}</div>
        <div className={styles.toggleGrid}>
          {[
            { key: 'showTime', label: 'Время', val: showTime, set: setShowTime },
            { key: 'showRead', label: 'Галочки прочтения', val: showRead, set: setShowRead },
            { key: 'showEdited', label: 'Надпись «ред.»', val: showEdited, set: setShowEdited },
            { key: 'showTimer', label: 'Таймер автоудаления', val: showTimer, set: setShowTimer },
          ].map(item => (
            <div key={item.key} className={styles.toggleRow} onClick={() => item.set(!item.val)}>
              <span className={styles.toggleLabel}>{t(item.label)}</span>
              <div className={`${styles.toggleTrack} ${item.val ? styles.toggleOn : ''}`}>
                <div className={styles.toggleThumb} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t('Выравнивание сообщений')}</div>
        <div className={styles.sectionDesc}>{t('Стандартное (свои справа) или все сообщения слева')}</div>
        <div className={styles.optionsRow}>
          {[
            { key: 'default' as const, label: 'Стандартное' },
            { key: 'allLeft' as const, label: 'Все слева' },
          ].map(al => {
            const active = messageAlignment === al.key;
            return (
              <div
                key={al.key}
                className={`${styles.card} ${active ? styles.cardActive : ''}`}
                onClick={() => setMessageAlignment(al.key)}
              >
                <div className={styles.cardLabel} style={{ marginTop: 0, padding: '14px 0' }}>{t(al.label)}</div>
                {active && (
                  <span className={styles.cardCheck}>
                    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12l4 4L18 6" />
                    </svg>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t('Плотность')}</div>
        <div className={styles.sectionDesc}>{t('Расстояние между элементами: отступы в списках, шапке и сообщениях')}</div>
        <div className={styles.optionsRow}>
          {[
            { key: 'compact' as const, label: 'Компактно' },
            { key: 'normal' as const, label: 'Обычно' },
            { key: 'comfortable' as const, label: 'Комфортно' },
          ].map(d => {
            const active = density === d.key;
            return (
              <div
                key={d.key}
                className={`${styles.card} ${active ? styles.cardActive : ''}`}
                onClick={() => setDensity(d.key)}
              >
                <div className={styles.cardLabel} style={{ marginTop: 0, padding: '14px 0' }}>{t(d.label)}</div>
                {active && (
                  <span className={styles.cardCheck}>
                    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12l4 4L18 6" />
                    </svg>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t('Стиль аватарок')}</div>
        <div className={styles.sectionDesc}>{t('Форма аватаров пользователей в списке чатов и шапке')}</div>
        <div className={styles.optionsRow}>
          {[
            { key: 'round' as const, label: 'Круглые' },
            { key: 'rounded' as const, label: 'Скруглённые' },
            { key: 'dodecagon' as const, label: 'Двенадцатиугольники' },
          ].map(a => {
            const active = avatarStyle === a.key;
            return (
              <div
                key={a.key}
                className={`${styles.card} ${active ? styles.cardActive : ''}`}
                onClick={() => setAvatarStyle(a.key)}
              >
                <div className={styles.cardLabel} style={{ marginTop: 0, padding: '14px 0' }}>{t(a.label)}</div>
                {active && (
                  <span className={styles.cardCheck}>
                    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12l4 4L18 6" />
                    </svg>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t('Индикаторы статуса')}</div>
        <div className={styles.sectionDesc}>{t('Как отображать онлайн-статус: ободок или точка')}</div>
        <div className={styles.optionsRow}>
          {[
            { key: 'ring' as const, label: 'Ободок аватара' },
            { key: 'dot' as const, label: 'Зелёная точка' },
          ].map(s => {
            const active = statusIndicator === s.key;
            return (
              <div
                key={s.key}
                className={`${styles.card} ${active ? styles.cardActive : ''}`}
                onClick={() => setStatusIndicator(s.key)}
              >
                <div className={styles.cardLabel} style={{ marginTop: 0, padding: '14px 0' }}>{t(s.label)}</div>
                {active && (
                  <span className={styles.cardCheck}>
                    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12l4 4L18 6" />
                    </svg>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t('Толщина скроллбара')}</div>
        <div className={styles.sectionDesc}>{t('Толщина полосы прокрутки в списке чатов и сообщениях')}</div>
        <div className={styles.optionsRow}>
          {[
            { key: 'thin' as const, label: 'Тонкий' },
            { key: 'normal' as const, label: 'Обычный' },
            { key: 'medium' as const, label: 'Средний' },
          ].map(s => {
            const active = scrollbarWidth === s.key;
            return (
              <div
                key={s.key}
                className={`${styles.card} ${active ? styles.cardActive : ''}`}
                onClick={() => setScrollbarWidth(s.key)}
              >
                <div className={styles.cardLabel} style={{ marginTop: 0, padding: '14px 0' }}>{t(s.label)}</div>
                {active && (
                  <span className={styles.cardCheck}>
                    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12l4 4L18 6" />
                    </svg>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t('Ширина боковой панели')}</div>
        <div className={styles.sectionDesc}>{t('Ширина списка чатов')}</div>
        <div className={styles.optionsRow}>
          {[
            { key: 'compact' as const, label: 'Компактная' },
            { key: 'normal' as const, label: 'Обычная' },
            { key: 'medium' as const, label: 'Средняя' },
            { key: 'large' as const, label: 'Большая' },
            { key: 'wide' as const, label: 'Широкая' },
          ].map(s => {
            const active = sidebarWidth === s.key;
            return (
              <div
                key={s.key}
                className={`${styles.card} ${active ? styles.cardActive : ''}`}
                onClick={() => setSidebarWidth(s.key)}
              >
                <div className={styles.cardLabel} style={{ marginTop: 0, padding: '14px 0' }}>{t(s.label)}</div>
                {active && (
                  <span className={styles.cardCheck}>
                    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12l4 4L18 6" />
                    </svg>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t('Контекстное меню')}</div>
        <div className={styles.sectionDesc}>{t('Отключайте пункты или перетаскивайте их для изменения порядка')}</div>
        <MenuCustomizer />
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t('Анимация интерфейса')}</div>
        <div className={styles.sectionDesc}>{t('Скорость анимаций открытия окон и переходов')}</div>
        <div className={styles.optionsRow}>
          {[
            { key: 'off' as const, label: 'Отключено' },
            { key: 'fast' as const, label: 'Быстро' },
            { key: 'normal' as const, label: 'Обычно' },
          ].map(a => {
            const active = animationSpeed === a.key;
            return (
              <div
                key={a.key}
                className={`${styles.card} ${active ? styles.cardActive : ''}`}
                onClick={() => setAnimationSpeed(a.key)}
              >
                <div className={styles.cardLabel} style={{ marginTop: 0, padding: '14px 0' }}>{t(a.label)}</div>
                {active && (
                  <span className={styles.cardCheck}>
                    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12l4 4L18 6" />
                    </svg>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t('Фон чата')}</div>
        <div className={styles.sectionDesc}>{t('Градиенты и обои в области сообщений')}</div>
        <div className={styles.optionsRow}>
          {[
            { key: 'default' as const, label: 'Стандартный', bg: '#0f0f13' },
            { key: 'dark' as const, label: 'Тёмный', bg: '#0f0f13' },
            { key: 'darker' as const, label: 'Глубокий', bg: '#08080a' },
            { key: 'deep-purple' as const, label: 'Фиолетовый', bg: '#12101a' },
            { key: 'gradient-night' as const, label: 'Ночной', bg: 'linear-gradient(145deg, #0a0a12, #1a1025, #0d0d1a)' },
            { key: 'gradient-ocean' as const, label: 'Океан', bg: 'linear-gradient(145deg, #070e1a, #0d1f2a, #070e1a)' },
            { key: 'gradient-sunset' as const, label: 'Закат', bg: 'linear-gradient(145deg, #1a0f0a, #2a1512, #1a0f0a)' },
            { key: 'gradient-forest' as const, label: 'Лес', bg: 'linear-gradient(145deg, #0a140e, #15221a, #0a140e)' },
          ].map(cb => {
            const active = chatBackground === cb.key;
            return (
              <div
                key={cb.key}
                className={`${styles.cardBg} ${active ? styles.cardActive : ''}`}
                onClick={() => setChatBackground(cb.key)}
              >
                <div className={styles.bgPreview} style={{ background: cb.bg }} />
                <div className={styles.cardLabel}>{t(cb.label)}</div>
                {active && (
                  <span className={styles.cardCheck}>
                    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12l4 4L18 6" />
                    </svg>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t('Тема оформления')}</div>
        <div className={styles.sectionDesc}>{t('Цветовая схема и акцентный цвет интерфейса')}</div>
        <div className={styles.themeGrid}>
          {themeOptions.map(th => {
            const active = theme === th.key;
            return (
              <div
                key={th.key}
                className={`${styles.themeCard} ${active ? styles.themeCardActive : ''}`}
                onClick={() => setTheme(th.key)}
              >
                <div className={styles.themePreview} style={{ background: th.bg }}>
                  <div className={styles.themeDot} style={{ background: th.accent }} />
                  <div className={styles.themeBars}>
                    <div className={styles.themeBar} style={{ background: th.accent }} />
                    <div className={styles.themeBar} style={{ background: th.accent, opacity: 0.5 }} />
                    <div className={styles.themeBar} style={{ background: th.accent, opacity: 0.3 }} />
                  </div>
                </div>
                <div className={styles.cardLabel}>{t(th.label)}</div>
                {active && (
                  <span className={styles.cardCheck}>
                    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12l4 4L18 6" />
                    </svg>
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div className={styles.currentTheme}>
          <span style={{ color: activeTheme.accent }}>●</span>
          <span style={{ fontWeight: 600 }}>{t(activeTheme.label)}</span>
          <span style={{ color: 'var(--text-muted, #888)' }}>{activeTheme.accent} + {activeTheme.bg}</span>
        </div>
      </div>
    </ModalShell>
  );
}