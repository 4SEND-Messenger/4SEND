import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { getLocalStorage, setLocalStorage } from '../utils/storage';
import type { AppLang } from '../hooks/useI18n';

type FontFamily = 'default' | 'gilroy-inter' | 'unbounded-onest' | 'sf-display-text' | 'montserrat-roboto' | 'manrope-inter' | 'golos-onest' | 'rubik-geometria' | 'clash-satoshi' | 'ubuntu-noto';
type Theme = 'classic' | 'lavender-graphite' | 'oil-ink' | 'mint-espresso' | 'sage-slate' | 'dusty-rose' | 'eucalyptus-asphalt' | 'oat-chocolate' | 'polar-mint-ocean' | 'ash-rose-marengo' | 'olive-anthracite' | 'meltwater-monsoon' | 'wild-honey-obsidian' | 'gray-sage-noir' | 'jade-graphite' | 'terracotta-basalt' | 'cyan-abyss' | 'crimson-twilight';

interface SettingsState {
  textSize: 'small' | 'medium' | 'large';
  fontFamily: FontFamily;
  theme: Theme;
  bubbleRadius: 'none' | 'small' | 'medium' | 'large' | 'full';
  animationSpeed: 'off' | 'fast' | 'normal';
  showTime: boolean;
  showRead: boolean;
  showEdited: boolean;
  showTimer: boolean;
  statusIndicator: 'ring' | 'dot';
  avatarStyle: 'round' | 'rounded' | 'dodecagon';
  chatBackground: 'default' | 'dark' | 'darker' | 'deep-purple' | 'gradient-night' | 'gradient-ocean' | 'gradient-sunset' | 'gradient-forest';
  messageAlignment: 'default' | 'allLeft';
  density: 'compact' | 'normal' | 'comfortable';
  scrollbarWidth: 'thin' | 'normal' | 'medium';
  sidebarWidth: 'compact' | 'normal' | 'medium' | 'large' | 'wide';
  volume: number;
  notificationRepeat: number;
  autoLockMinutes: number;
  autoDeleteMonths: number;
  autoLogoutDays: number;
  quickReaction: string;
  language: AppLang;
  privacyState: Record<string, 'all' | 'none' | 'selected'>;
  privacyExceptions: Record<string, string[]>;
  isAppLocked: boolean;
  pin: string | null;
  menuItems: Record<string, string[]>;
}

interface SettingsContextType extends SettingsState {
  textSize: 'small' | 'medium' | 'large';
  setTextSize: (size: 'small' | 'medium' | 'large') => void;
  fontFamily: FontFamily;
  setFontFamily: (f: FontFamily) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  bubbleRadius: 'none' | 'small' | 'medium' | 'large' | 'full';
  setBubbleRadius: (r: 'none' | 'small' | 'medium' | 'large' | 'full') => void;
  animationSpeed: 'off' | 'fast' | 'normal';
  setAnimationSpeed: (a: 'off' | 'fast' | 'normal') => void;
  showTime: boolean;
  setShowTime: (v: boolean) => void;
  showRead: boolean;
  setShowRead: (v: boolean) => void;
  showEdited: boolean;
  setShowEdited: (v: boolean) => void;
  showTimer: boolean;
  setShowTimer: (v: boolean) => void;
  statusIndicator: 'ring' | 'dot';
  setStatusIndicator: (v: 'ring' | 'dot') => void;
  avatarStyle: 'round' | 'rounded' | 'dodecagon';
  setAvatarStyle: (v: 'round' | 'rounded' | 'dodecagon') => void;
  chatBackground: 'default' | 'dark' | 'darker' | 'deep-purple' | 'gradient-night' | 'gradient-ocean' | 'gradient-sunset' | 'gradient-forest';
  setChatBackground: (v: 'default' | 'dark' | 'darker' | 'deep-purple' | 'gradient-night' | 'gradient-ocean' | 'gradient-sunset' | 'gradient-forest') => void;
  messageAlignment: 'default' | 'allLeft';
  setMessageAlignment: (v: 'default' | 'allLeft') => void;
  density: 'compact' | 'normal' | 'comfortable';
  setDensity: (v: 'compact' | 'normal' | 'comfortable') => void;
  scrollbarWidth: 'thin' | 'normal' | 'medium';
  setScrollbarWidth: (v: 'thin' | 'normal' | 'medium') => void;
  sidebarWidth: 'compact' | 'normal' | 'medium' | 'large' | 'wide';
  setSidebarWidth: (v: 'compact' | 'normal' | 'medium' | 'large' | 'wide') => void;
  volume: number;
  setVolume: (vol: number) => void;
  notificationRepeat: number;
  setNotificationRepeat: (minutes: number) => void;
  autoLockMinutes: number;
  setAutoLockMinutes: (minutes: number) => void;
  autoDeleteMonths: number;
  setAutoDeleteMonths: (months: number) => void;
  autoLogoutDays: number;
  setAutoLogoutDays: (days: number) => void;
  quickReaction: string;
  setQuickReaction: (emoji: string) => void;
  language: AppLang;
  setLanguage: (lang: AppLang) => void;
  privacyState: Record<string, 'all' | 'none' | 'selected'>;
  setPrivacyOption: (key: string, val: 'all' | 'none' | 'selected') => void;
  privacyExceptions: Record<string, string[]>;
  setAllPrivacy: (state: Record<string, 'all' | 'none' | 'selected'>, exceptions: Record<string, string[]>) => void;
  addPrivacyException: (key: string, username: string) => void;
  removePrivacyException: (key: string, username: string) => void;
  isAppLocked: boolean;
  lockApp: () => void;
  unlockApp: (pin: string) => boolean;
  confirmUnlock: () => void;
  pin: string | null;
  setPin: (pin: string) => void;
  menuItems: Record<string, string[]>;
  setMenuOrder: (menu: string, items: string[]) => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

const initialSettings: SettingsState = {
  textSize: 'medium' as const,
  fontFamily: 'ubuntu-noto' as const,
  theme: 'classic' as const,
  bubbleRadius: 'medium' as const,
  animationSpeed: 'normal' as const,
  showTime: true,
  showRead: true,
  showEdited: true,
  showTimer: true,
  statusIndicator: 'ring',
  avatarStyle: 'round',
  chatBackground: 'default',
  messageAlignment: 'default',
  density: 'normal',
  scrollbarWidth: 'normal',
  sidebarWidth: 'normal',
  volume: 1,
  notificationRepeat: 5,
  autoLockMinutes: 0,
  autoDeleteMonths: 6,
  autoLogoutDays: 7,
  quickReaction: '❤️',
  language: 'ru' as const,
  privacyState: {
    avatar: 'all', bio: 'all', status: 'all', messages: 'all',
    calls: 'all', voice_video: 'all', forwards: 'all', search: 'all'
  },
  privacyExceptions: {
    avatar: [], bio: [], status: [], messages: [],
    calls: [], voice_video: [], forwards: [], search: []
  },
  isAppLocked: false,
  pin: null,
  menuItems: {
    chat_ctx: ['pin', 'folder', 'archive', 'mute', 'block', 'delete_chat'],
    chat_header: ['search', 'mute', 'block', 'autoDelete', 'stats', 'profile', 'members', 'delete_chat'],
    msg_ctx: ['reply', 'copy', 'forward', 'save', 'pin_msg', 'select', 'edit', 'delete_msg'],
  },
};

function applyCssVars(s: SettingsState) {
  const sizeMap: Record<string, string> = { small: '14px', medium: '16px', large: '18px' };
  const fontMap: Record<string, string> = {
    default: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    'gilroy-inter': '"Gilroy", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    'unbounded-onest': '"Unbounded", "Onest", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    'sf-display-text': '"SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    'montserrat-roboto': '"Montserrat", "Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    'manrope-inter': '"Manrope", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    'golos-onest': '"Golos Text", "Onest", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    'rubik-geometria': '"Rubik", "Geometria", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    'clash-satoshi': '"Clash Display", "Satoshi", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    'ubuntu-noto': '"Noto Sans", "Ubuntu", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  };
  const headingFontMap: Record<string, string> = {
    default: '"Ubuntu", sans-serif',
    'gilroy-inter': '"Gilroy", sans-serif',
    'unbounded-onest': '"Unbounded", sans-serif',
    'sf-display-text': '"SF Pro Display", sans-serif',
    'montserrat-roboto': '"Montserrat", sans-serif',
    'manrope-inter': '"Manrope", sans-serif',
    'golos-onest': '"Golos Text", sans-serif',
    'rubik-geometria': '"Rubik", sans-serif',
    'clash-satoshi': '"Clash Display", sans-serif',
    'ubuntu-noto': '"Ubuntu", sans-serif',
  };
  const themeMap: Record<string, Record<string, string>> = {
    'classic': {
      accent: '#a74fff',
      'accent-solid': '#a74fff',
      'accent-rgb': '167, 79, 255',
      'accent-hover': '#9147e0',
      bg: '#0a0a0c',
      'bg-elevated': '#0f0f13',
      sidebar: '#121218',
      'sidebar-hover': '#1a1a22',
      card: '#1a1a24',
      'card-hover': '#22222c',
      'card-rgb': '26, 26, 36',
      border: '#252530',
      'border-light': '#2e2e3a',
      'overlay-rgb': '30, 27, 36',
      sent: '#2d1b4d',
      'sent-hover': '#3a255a',
      rcv: '#1e1e24',
      'rcv-hover': '#282830',
      'shadow-glow': '0 0 20px rgba(167, 79, 255, 0.3)',
    },
    'lavender-graphite': {
      accent: '#B8A7F0',
      'accent-solid': '#B8A7F0',
      'accent-rgb': '184, 167, 240',
      'accent-hover': '#A693E0',
      bg: '#232329',
      'bg-elevated': '#28282E',
      sidebar: '#1E1E24',
      'sidebar-hover': '#26262C',
      card: '#2A2A32',
      'card-hover': '#32323A',
      'card-rgb': '42, 42, 50',
      border: '#2F2F38',
      'border-light': '#383842',
      'overlay-rgb': '30, 30, 36',
      sent: '#2E2840',
      'sent-hover': '#3A3250',
      rcv: '#1E1E26',
      'rcv-hover': '#282830',
      'shadow-glow': '0 0 20px rgba(184, 167, 240, 0.3)',
    },
    'oil-ink': {
      accent: '#F2D06B',
      'accent-solid': '#F2D06B',
      'accent-rgb': '242, 208, 107',
      'accent-hover': '#E0BE59',
      'on-accent': '#1a1a1a',
      bg: '#1E2530',
      'bg-elevated': '#232A36',
      sidebar: '#181E28',
      'sidebar-hover': '#202632',
      card: '#252D39',
      'card-hover': '#2D3541',
      'card-rgb': '37, 45, 57',
      border: '#2A3340',
      'border-light': '#35404D',
      'overlay-rgb': '24, 30, 40',
      sent: '#2E3430',
      'sent-hover': '#3A403A',
      rcv: '#1A2028',
      'rcv-hover': '#222A32',
      'shadow-glow': '0 0 20px rgba(242, 208, 107, 0.3)',
    },
    'mint-espresso': {
      accent: '#B9E5C8',
      'accent-solid': '#B9E5C8',
      'accent-rgb': '185, 229, 200',
      'accent-hover': '#A7D3B6',
      'on-accent': '#1a1a1a',
      bg: '#2B1A12',
      'bg-elevated': '#302018',
      sidebar: '#241511',
      'sidebar-hover': '#2C1C18',
      card: '#33201B',
      'card-hover': '#3B2823',
      'card-rgb': '51, 32, 27',
      border: '#3A2620',
      'border-light': '#45302A',
      'overlay-rgb': '36, 21, 17',
      sent: '#2E2820',
      'sent-hover': '#3A3228',
      rcv: '#241814',
      'rcv-hover': '#2C201C',
      'shadow-glow': '0 0 20px rgba(185, 229, 200, 0.3)',
    },
    'sage-slate': {
      accent: '#9CAF88',
      'accent-solid': '#9CAF88',
      'accent-rgb': '156, 175, 136',
      'accent-hover': '#8A9D76',
      bg: '#2F3E46',
      'bg-elevated': '#35454D',
      sidebar: '#28363D',
      'sidebar-hover': '#303E45',
      card: '#35454D',
      'card-hover': '#3D4D55',
      'card-rgb': '53, 69, 77',
      border: '#3D4D55',
      'border-light': '#4A5A62',
      'overlay-rgb': '36, 46, 52',
      sent: '#2E3A36',
      'sent-hover': '#3A4842',
      rcv: '#28363D',
      'rcv-hover': '#303E45',
      'shadow-glow': '0 0 20px rgba(156, 175, 136, 0.3)',
    },
    'dusty-rose': {
      accent: '#CCA7A3',
      'accent-solid': '#CCA7A3',
      'accent-rgb': '204, 167, 163',
      'accent-hover': '#BA9591',
      bg: '#1A1C29',
      'bg-elevated': '#20222F',
      sidebar: '#14161F',
      'sidebar-hover': '#1C1E27',
      card: '#222430',
      'card-hover': '#2A2C38',
      'card-rgb': '34, 36, 48',
      border: '#2A2C38',
      'border-light': '#353745',
      'overlay-rgb': '22, 23, 33',
      sent: '#2E2430',
      'sent-hover': '#3A2E3A',
      rcv: '#1A1C29',
      'rcv-hover': '#222430',
      'shadow-glow': '0 0 20px rgba(204, 167, 163, 0.3)',
    },
    'eucalyptus-asphalt': {
      accent: '#A3B19B',
      'accent-solid': '#A3B19B',
      'accent-rgb': '163, 177, 155',
      'accent-hover': '#919F89',
      bg: '#252627',
      'bg-elevated': '#2B2C2D',
      sidebar: '#1F2021',
      'sidebar-hover': '#272829',
      card: '#2D2E2F',
      'card-hover': '#353637',
      'card-rgb': '45, 46, 47',
      border: '#353637',
      'border-light': '#404142',
      'overlay-rgb': '25, 26, 27',
      sent: '#2A2E28',
      'sent-hover': '#363A32',
      rcv: '#1F2021',
      'rcv-hover': '#272829',
      'shadow-glow': '0 0 20px rgba(163, 177, 155, 0.3)',
    },
    'oat-chocolate': {
      accent: '#E6DFD3',
      'accent-solid': '#E6DFD3',
      'accent-rgb': '230, 223, 211',
      'accent-hover': '#D4CDC1',
      'on-accent': '#1a1a1a',
      bg: '#2B211B',
      'bg-elevated': '#302721',
      sidebar: '#241B16',
      'sidebar-hover': '#2C231E',
      card: '#332922',
      'card-hover': '#3B312A',
      'card-rgb': '51, 41, 34',
      border: '#3A302A',
      'border-light': '#453B35',
      'overlay-rgb': '36, 27, 22',
      sent: '#2E2820',
      'sent-hover': '#3A3228',
      rcv: '#241B16',
      'rcv-hover': '#2C231E',
      'shadow-glow': '0 0 20px rgba(230, 223, 211, 0.3)',
    },
    'polar-mint-ocean': {
      accent: '#BFFCC6',
      'accent-solid': '#BFFCC6',
      'accent-rgb': '191, 252, 198',
      'accent-hover': '#ADEAB4',
      'on-accent': '#1a1a1a',
      bg: '#0D1B2A',
      'bg-elevated': '#12202F',
      sidebar: '#0A1522',
      'sidebar-hover': '#121D2A',
      card: '#14222F',
      'card-hover': '#1C2A37',
      'card-rgb': '20, 34, 47',
      border: '#1C2A37',
      'border-light': '#273542',
      'overlay-rgb': '10, 21, 30',
      sent: '#1A2830',
      'sent-hover': '#263238',
      rcv: '#0D1B2A',
      'rcv-hover': '#14222F',
      'shadow-glow': '0 0 20px rgba(191, 252, 198, 0.3)',
    },
    'ash-rose-marengo': {
      accent: '#B59A9A',
      'accent-solid': '#B59A9A',
      'accent-rgb': '181, 154, 154',
      'accent-hover': '#A38888',
      bg: '#20242C',
      'bg-elevated': '#262A32',
      sidebar: '#1A1E26',
      'sidebar-hover': '#22262E',
      card: '#282C34',
      'card-hover': '#30343C',
      'card-rgb': '40, 44, 52',
      border: '#30343C',
      'border-light': '#3A3E46',
      'overlay-rgb': '22, 26, 34',
      sent: '#2E2430',
      'sent-hover': '#3A2E3A',
      rcv: '#1A1E26',
      'rcv-hover': '#22262E',
      'shadow-glow': '0 0 20px rgba(181, 154, 154, 0.3)',
    },
    'olive-anthracite': {
      accent: '#8A9A86',
      'accent-solid': '#8A9A86',
      'accent-rgb': '138, 154, 134',
      'accent-hover': '#788874',
      bg: '#1C1E21',
      'bg-elevated': '#222427',
      sidebar: '#16181B',
      'sidebar-hover': '#1E2023',
      card: '#242628',
      'card-hover': '#2C2E30',
      'card-rgb': '36, 38, 40',
      border: '#2C2E30',
      'border-light': '#36383A',
      'overlay-rgb': '18, 20, 23',
      sent: '#2A2E28',
      'sent-hover': '#363A32',
      rcv: '#1C1E21',
      'rcv-hover': '#242628',
      'shadow-glow': '0 0 20px rgba(138, 154, 134, 0.3)',
    },
    'meltwater-monsoon': {
      accent: '#A9BCC6',
      'accent-solid': '#A9BCC6',
      'accent-rgb': '169, 188, 198',
      'accent-hover': '#97AAB4',
      bg: '#1E252B',
      'bg-elevated': '#242B31',
      sidebar: '#181F25',
      'sidebar-hover': '#20272D',
      card: '#262D33',
      'card-hover': '#2E353B',
      'card-rgb': '38, 45, 51',
      border: '#2E353B',
      'border-light': '#384046',
      'overlay-rgb': '22, 28, 34',
      sent: '#222A30',
      'sent-hover': '#2E343A',
      rcv: '#181F25',
      'rcv-hover': '#20272D',
      'shadow-glow': '0 0 20px rgba(169, 188, 198, 0.3)',
    },
    'wild-honey-obsidian': {
      accent: '#D0A36E',
      'accent-solid': '#D0A36E',
      'accent-rgb': '208, 163, 110',
      'accent-hover': '#BE915C',
      bg: '#191A1C',
      'bg-elevated': '#1F2022',
      sidebar: '#131416',
      'sidebar-hover': '#1B1C1E',
      card: '#212224',
      'card-hover': '#292A2C',
      'card-rgb': '33, 34, 36',
      border: '#292A2C',
      'border-light': '#333436',
      'overlay-rgb': '15, 16, 18',
      sent: '#2E2820',
      'sent-hover': '#3A3228',
      rcv: '#191A1C',
      'rcv-hover': '#212224',
      'shadow-glow': '0 0 20px rgba(208, 163, 110, 0.3)',
    },
    'gray-sage-noir': {
      accent: '#B2C2B7',
      'accent-solid': '#B2C2B7',
      'accent-rgb': '178, 194, 183',
      'accent-hover': '#A0B0A5',
      'on-accent': '#1a1a1a',
      bg: '#15161A',
      'bg-elevated': '#1B1C20',
      sidebar: '#0F1014',
      'sidebar-hover': '#17181C',
      card: '#1D1E22',
      'card-hover': '#25262A',
      'card-rgb': '29, 30, 34',
      border: '#25262A',
      'border-light': '#2F3034',
      'overlay-rgb': '12, 13, 17',
      sent: '#222628',
      'sent-hover': '#2E3234',
      rcv: '#15161A',
      'rcv-hover': '#1D1E22',
      'shadow-glow': '0 0 20px rgba(178, 194, 183, 0.3)',
    },
    'jade-graphite': {
      accent: '#9DB3A4',
      'accent-solid': '#9DB3A4',
      'accent-rgb': '157, 179, 164',
      'accent-hover': '#8BA192',
      'on-accent': '#1a1a1a',
      bg: '#1F2221',
      'bg-elevated': '#252826',
      sidebar: '#191C1B',
      'sidebar-hover': '#212423',
      card: '#272A29',
      'card-hover': '#2F3231',
      'card-rgb': '39, 42, 41',
      border: '#2F3231',
      'border-light': '#393C3B',
      'overlay-rgb': '18, 21, 20',
      sent: '#262A28',
      'sent-hover': '#323634',
      rcv: '#1F2221',
      'rcv-hover': '#272A29',
      'shadow-glow': '0 0 20px rgba(157, 179, 164, 0.3)',
    },
    'terracotta-basalt': {
      accent: '#C87D6B',
      'accent-solid': '#C87D6B',
      'accent-rgb': '200, 125, 107',
      'accent-hover': '#B66B59',
      bg: '#1A1615',
      'bg-elevated': '#201C1B',
      sidebar: '#141011',
      'sidebar-hover': '#1C1819',
      card: '#221E1D',
      'card-hover': '#2A2625',
      'card-rgb': '34, 30, 29',
      border: '#2A2625',
      'border-light': '#34302F',
      'overlay-rgb': '14, 10, 9',
      sent: '#2E221E',
      'sent-hover': '#3A2C28',
      rcv: '#1A1615',
      'rcv-hover': '#221E1D',
      'shadow-glow': '0 0 20px rgba(200, 125, 107, 0.3)',
    },
    'cyan-abyss': {
      accent: '#5FD9D0',
      'accent-solid': '#5FD9D0',
      'accent-rgb': '95, 217, 208',
      'accent-hover': '#4DC7BE',
      'on-accent': '#1a1a1a',
      bg: '#0A0E12',
      'bg-elevated': '#101418',
      sidebar: '#060A0E',
      'sidebar-hover': '#0E1216',
      card: '#12161A',
      'card-hover': '#1A1E22',
      'card-rgb': '18, 22, 26',
      border: '#1A1E22',
      'border-light': '#24282C',
      'overlay-rgb': '6, 10, 14',
      sent: '#0E2228',
      'sent-hover': '#1A2E34',
      rcv: '#060A0E',
      'rcv-hover': '#0E1216',
      'shadow-glow': '0 0 20px rgba(95, 217, 208, 0.3)',
    },
    'crimson-twilight': {
      accent: '#C6686A',
      'accent-solid': '#C6686A',
      'accent-rgb': '198, 104, 106',
      'accent-hover': '#B45658',
      bg: '#161214',
      'bg-elevated': '#1C181A',
      sidebar: '#100C0E',
      'sidebar-hover': '#181416',
      card: '#1E1A1C',
      'card-hover': '#262224',
      'card-rgb': '30, 26, 28',
      border: '#262224',
      'border-light': '#302C2E',
      'overlay-rgb': '12, 8, 10',
      sent: '#2E1C22',
      'sent-hover': '#3A2630',
      rcv: '#161214',
      'rcv-hover': '#1E1A1C',
      'shadow-glow': '0 0 20px rgba(198, 104, 106, 0.3)',
    },
  };
  const root = document.documentElement;
  const basePx = sizeMap[s.textSize] || '16px';
  const scale = s.textSize === 'small' ? '0.875' : s.textSize === 'large' ? '1.125' : '1';
  root.style.setProperty('--msg-text-size', basePx);
  root.style.setProperty('--font-size-base', basePx);
  root.style.setProperty('--font-size-scale', scale);
  root.style.setProperty('--fs-unit', `calc(1px * ${scale})`);
  root.style.fontSize = basePx;
  root.style.setProperty('--font-main', fontMap[s.fontFamily] ?? fontMap.default);
  root.style.setProperty('--font-heading', headingFontMap[s.fontFamily] ?? headingFontMap.default);
  const radiusMap: Record<string, string> = { none: '4px', small: '10px', medium: '18px', large: '28px', full: '50px' };
  root.style.setProperty('--bubble-radius', radiusMap[s.bubbleRadius] || '18px');
  const animDurations: Record<string, { fast: string; base: string; slow: string }> = {
    normal: { fast: '0.15s', base: '0.3s', slow: '0.5s' },
    fast: { fast: '0.08s', base: '0.12s', slow: '0.2s' },
    off: { fast: '0s', base: '0s', slow: '0s' },
  };
  const dur = animDurations[s.animationSpeed] ?? animDurations.normal;
  root.style.setProperty('--anim-dur-fast', dur.fast);
  root.style.setProperty('--anim-dur-base', dur.base);
  root.style.setProperty('--anim-dur-slow', dur.slow);
  root.style.setProperty('--show-time', s.showTime ? 'inline' : 'none');
  root.style.setProperty('--show-read', s.showRead ? 'flex' : 'none');
  root.style.setProperty('--show-edited', s.showEdited ? 'inline' : 'none');
  root.style.setProperty('--show-timer', s.showTimer ? 'flex' : 'none');
  root.style.setProperty('--status-style', s.statusIndicator);
  const avatarRadiusMap: Record<string, string> = { round: '50%', rounded: '12px', dodecagon: '0' };
  const avatarClipMap: Record<string, string> = { round: 'none', rounded: 'none', dodecagon: 'polygon(100% 50%, 93.3% 75%, 75% 93.3%, 50% 100%, 25% 93.3%, 6.7% 75%, 0% 50%, 6.7% 25%, 25% 6.7%, 50% 0%, 75% 6.7%, 93.3% 25%)' };
  root.style.setProperty('--avatar-radius', avatarRadiusMap[s.avatarStyle] || '50%');
  root.style.setProperty('--avatar-clip', avatarClipMap[s.avatarStyle] || 'none');
  const chatBgMap: Record<string, string> = {
    default: '#0f0f13',
    dark: '#0f0f13',
    darker: '#08080a',
    'deep-purple': '#12101a',
    'gradient-night': 'linear-gradient(145deg, #0a0a12 0%, #1a1025 50%, #0d0d1a 100%)',
    'gradient-ocean': 'linear-gradient(145deg, #070e1a 0%, #0d1f2a 50%, #070e1a 100%)',
    'gradient-sunset': 'linear-gradient(145deg, #1a0f0a 0%, #2a1512 50%, #1a0f0a 100%)',
    'gradient-forest': 'linear-gradient(145deg, #0a140e 0%, #15221a 50%, #0a140e 100%)',
  };
  const chatPatternOpacity: Record<string, string> = {
    default: '0.6', dark: '0', darker: '0', 'deep-purple': '0',
    'gradient-night': '0.1', 'gradient-ocean': '0.1', 'gradient-sunset': '0.1', 'gradient-forest': '0.1',
  };
  root.style.setProperty('--chat-bg', chatBgMap[s.chatBackground] || '#0f0f13');
  root.style.setProperty('--chat-pattern', chatPatternOpacity[s.chatBackground] || '0');
  root.style.setProperty('--msg-justify-sent', s.messageAlignment === 'allLeft' ? 'flex-start' : 'flex-end');
  root.style.setProperty('--msg-align-self-sent', s.messageAlignment === 'allLeft' ? 'flex-start' : 'flex-end');
  const densityVars: Record<string, Record<string, string>> = {
    compact: {
      '--density-msg-gap': '4px',
      '--density-msg-padding': '12px',
      '--density-contact-padding': '8px 15px',
      '--density-header-padding': '10px 20px',
      '--density-input-padding': '4px 8px',
      '--density-bottom-gap': '4px',
    },
    normal: {
      '--density-msg-gap': '8px',
      '--density-msg-padding': '20px',
      '--density-contact-padding': '12px 15px',
      '--density-header-padding': '15px 25px',
      '--density-input-padding': '8px 12px',
      '--density-bottom-gap': '8px',
    },
    comfortable: {
      '--density-msg-gap': '14px',
      '--density-msg-padding': '28px',
      '--density-contact-padding': '16px 20px',
      '--density-header-padding': '20px 30px',
      '--density-input-padding': '12px 16px',
      '--density-bottom-gap': '12px',
    },
  };
  const dv = densityVars[s.density] ?? densityVars.normal;
  Object.entries(dv ?? {}).forEach(([key, val]) => root.style.setProperty(key, val));
  root.setAttribute('data-scrollbar', s.scrollbarWidth);
  const sidebarWidthMap: Record<string, string> = {
    compact: '80px',
    normal: '320px',
    medium: '380px',
    large: '450px',
    wide: '55vw',
  };
  root.style.setProperty('--sidebar-width', sidebarWidthMap[s.sidebarWidth] || '320px');
  root.setAttribute('data-sidebar', s.sidebarWidth);
  if (s.animationSpeed === 'off') {
    root.style.setProperty('--anim-disabled', 'none');
    root.setAttribute('data-anim-off', '');
    root.removeAttribute('data-anim-fast');
  } else if (s.animationSpeed === 'fast') {
    root.style.removeProperty('--anim-disabled');
    root.setAttribute('data-anim-fast', '');
    root.removeAttribute('data-anim-off');
  } else {
    root.style.removeProperty('--anim-disabled');
    root.removeAttribute('data-anim-off');
    root.removeAttribute('data-anim-fast');
  }
  const theme = themeMap[s.theme] ?? themeMap['classic'];
  Object.entries(theme ?? {}).forEach(([key, val]) => {
    root.style.setProperty(`--${key}`, val);
  });
}

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<SettingsState>(() => {
    const storedPrivacy = (() => {
      try { return JSON.parse(localStorage.getItem('4send_privacy') || '{}'); } catch { return {}; }
    })();
    const initial: SettingsState = {
      ...initialSettings,
      textSize: getLocalStorage('4send_text_size', 'medium'),
      fontFamily: getLocalStorage('4send_fontFamily', 'ubuntu-noto'),
      theme: getLocalStorage('4send_theme', 'classic'),
      bubbleRadius: getLocalStorage('4send_bubbleRadius', 'medium'),
      animationSpeed: getLocalStorage('4send_animationSpeed', 'normal'),
      showTime: getLocalStorage('4send_showTime', true),
      showRead: getLocalStorage('4send_showRead', true),
      showEdited: getLocalStorage('4send_showEdited', true),
      showTimer: getLocalStorage('4send_showTimer', true),
      statusIndicator: getLocalStorage('4send_statusIndicator', 'ring'),
      avatarStyle: getLocalStorage('4send_avatarStyle', 'round'),
      chatBackground: getLocalStorage('4send_chatBackground', 'default'),
      messageAlignment: getLocalStorage('4send_messageAlignment', 'default'),
      density: getLocalStorage('4send_density', 'normal'),
      scrollbarWidth: getLocalStorage('4send_scrollbarWidth', 'normal'),
      sidebarWidth: getLocalStorage('4send_sidebarWidth', 'normal'),
      volume: getLocalStorage('4send_volume', 1),
      notificationRepeat: getLocalStorage('4send_notif_repeat', 5),
      autoLockMinutes: getLocalStorage('4send_lock_time', 0),
      autoDeleteMonths: getLocalStorage('4send_auto_delete', 6),
      autoLogoutDays: getLocalStorage('4send_auto_logout', 7),
      quickReaction: getLocalStorage('4send_quick_reaction', '❤️'),
      language: getLocalStorage<AppLang>('4send_language', 'ru'),
      pin: getLocalStorage('4send_pin', null),
      menuItems: (() => {
        try { const v = localStorage.getItem('4send_menu_items'); return v ? JSON.parse(v) : initialSettings.menuItems; } catch { return initialSettings.menuItems; }
      })(),
      isAppLocked: sessionStorage.getItem('4send_is_locked') === '1',
      privacyState: {
        avatar: storedPrivacy.avatar || 'all',
        bio: storedPrivacy.bio || 'all',
        status: storedPrivacy.status || 'all',
        messages: storedPrivacy.messages || 'all',
        calls: storedPrivacy.calls || 'all',
        voice_video: storedPrivacy.voice_video || 'all',
        forwards: storedPrivacy.forwards || 'all',
        search: storedPrivacy.search || 'all',
      },
      privacyExceptions: {
        avatar: storedPrivacy.exceptions?.avatar || [],
        bio: storedPrivacy.exceptions?.bio || [],
        status: storedPrivacy.exceptions?.status || [],
        messages: storedPrivacy.exceptions?.messages || [],
        calls: storedPrivacy.exceptions?.calls || [],
        voice_video: storedPrivacy.exceptions?.voice_video || [],
        forwards: storedPrivacy.exceptions?.forwards || [],
        search: storedPrivacy.exceptions?.search || [],
      },
    };
    applyCssVars(initial);
    return initial;
  });

  useEffect(() => { applyCssVars(settings); }, [settings.textSize, settings.fontFamily, settings.theme, settings.bubbleRadius, settings.animationSpeed, settings.showTime, settings.showRead, settings.showEdited, settings.showTimer, settings.statusIndicator, settings.avatarStyle, settings.chatBackground, settings.messageAlignment, settings.density, settings.scrollbarWidth, settings.sidebarWidth]);

  const updateSetting = useCallback(<K extends keyof SettingsContextType>(key: K, value: SettingsContextType[K]) => {
    setSettings(prev => {
      const newSettings = { ...prev, [key]: value };
      if (key !== 'isAppLocked' && key !== 'pin' && key !== 'privacyExceptions') {
        setLocalStorage(`4send_${key}`, value);
      }
      return newSettings;
    });
  }, []);

  return (
    <SettingsContext.Provider value={{
      ...settings,
      setTextSize: (v) => updateSetting('textSize', v),
      setFontFamily: (v) => updateSetting('fontFamily', v),
      setTheme: (v) => updateSetting('theme', v),
      setBubbleRadius: (v) => updateSetting('bubbleRadius', v),
      setAnimationSpeed: (v) => updateSetting('animationSpeed', v),
      setShowTime: (v) => updateSetting('showTime', v),
      setShowRead: (v) => updateSetting('showRead', v),
      setShowEdited: (v) => updateSetting('showEdited', v),
      setShowTimer: (v) => updateSetting('showTimer', v),
      setStatusIndicator: (v) => updateSetting('statusIndicator', v),
      setAvatarStyle: (v) => updateSetting('avatarStyle', v),
      setChatBackground: (v) => updateSetting('chatBackground', v),
      setMessageAlignment: (v) => updateSetting('messageAlignment', v),
      setDensity: (v) => updateSetting('density', v),
      setScrollbarWidth: (v) => updateSetting('scrollbarWidth', v),
      setSidebarWidth: (v) => updateSetting('sidebarWidth', v),
      setVolume: (v) => updateSetting('volume', v),
      setNotificationRepeat: (v) => updateSetting('notificationRepeat', v),
      setAutoLockMinutes: (v) => updateSetting('autoLockMinutes', v),
      setAutoDeleteMonths: (v) => updateSetting('autoDeleteMonths', v),
      setAutoLogoutDays: (v) => updateSetting('autoLogoutDays', v),
      setQuickReaction: (v) => updateSetting('quickReaction', v),
      setLanguage: (v) => updateSetting('language', v),
      setPrivacyOption: (key, val) => {
        setSettings(prev => {
          const newState = { ...prev.privacyState, [key]: val };
          const stored = JSON.parse(localStorage.getItem('4send_privacy') || '{}');
          const merged = { ...stored, ...newState, exceptions: stored.exceptions };
          setLocalStorage('4send_privacy', JSON.stringify(merged));
          return { ...prev, privacyState: newState };
        });
      },
      setAllPrivacy: (state, exceptions) => {
        setSettings(prev => {
          const payload = { ...state, exceptions };
          setLocalStorage('4send_privacy', JSON.stringify(payload));
          return { ...prev, privacyState: state, privacyExceptions: exceptions };
        });
      },
      addPrivacyException: (key, username) => {
        setSettings(prev => {
          const exceptions = { ...prev.privacyExceptions, [key]: [...(prev.privacyExceptions[key] || []), username] };
          const privacy = JSON.parse(localStorage.getItem('4send_privacy') || '{}');
          privacy.exceptions = { ...privacy.exceptions, [key]: exceptions[key] };
          setLocalStorage('4send_privacy', JSON.stringify(privacy));
          return { ...prev, privacyExceptions: exceptions };
        });
      },
      removePrivacyException: (key, username) => {
        setSettings(prev => {
          const exceptions = { ...prev.privacyExceptions, [key]: (prev.privacyExceptions[key] || []).filter(u => u !== username) };
          const privacy = JSON.parse(localStorage.getItem('4send_privacy') || '{}');
          privacy.exceptions = { ...privacy.exceptions, [key]: exceptions[key] };
          setLocalStorage('4send_privacy', JSON.stringify(privacy));
          return { ...prev, privacyExceptions: exceptions };
        });
      },
      lockApp: () => {
        sessionStorage.setItem('4send_is_locked', '1');
        setSettings(prev => ({ ...prev, isAppLocked: true }));
      },
      unlockApp: (pin: string) => {
        if (pin === settings.pin) {
          return true;
        }
        return false;
      },
      confirmUnlock: () => {
        sessionStorage.removeItem('4send_is_locked');
        setSettings(prev => ({ ...prev, isAppLocked: false }));
      },
      setPin: (pin: string) => {
        setSettings(prev => {
          setLocalStorage('4send_pin', pin);
          return { ...prev, pin };
        });
      },
      setMenuOrder: (menu: string, items: string[]) => {
        setSettings(prev => {
          const newItems = { ...prev.menuItems, [menu]: items };
          localStorage.setItem('4send_menu_items', JSON.stringify(newItems));
          return { ...prev, menuItems: newItems };
        });
      },
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within SettingsProvider');
  return context;
};