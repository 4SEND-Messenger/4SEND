import { useState, useEffect, useCallback } from 'react';
import { APP_VERSION } from '../constants/version';

export type AppLang = 'ru' | 'en' | 'es' | 'zh' | 'ar' | 'pt' | 'hi' | 'uk' | 'kk' | 'pl' | 'uz' | 'cs' | 'be' | 'de' | 'fr' | 'it' | 'ja' | 'ko' | 'tr' | 'fa';
export const SUPPORTED_LANGS: AppLang[] = ['ru', 'en', 'es', 'zh', 'ar', 'pt', 'hi', 'uk', 'kk', 'pl', 'uz', 'cs', 'be', 'de', 'fr', 'it', 'ja', 'ko', 'tr', 'fa'];

export const LANG_NAMES: Record<AppLang, string> = {
  ru: 'Русский',
  en: 'English',
  es: 'Español',
  zh: '简体中文',
  ar: 'العربية',
  pt: 'Português',
  hi: 'हिन्दी',
  uk: 'Українська',
  kk: 'Қазақша',
  pl: 'Polski',
  uz: 'Oʻzbekcha',
  cs: 'Čeština',
  be: 'Беларуская',
  de: 'Deutsch',
  fr: 'Français',
  it: 'Italiano',
  ja: '日本語',
  ko: '한국어',
  tr: 'Türkçe',
  fa: 'فارسی',
};

const translations: Record<string, Record<string, string>> = {};
const loadedLangs = new Set<string>();

let currentLang: AppLang = 'ru';
const listeners = new Set<() => void>();

function broadcast() {
  listeners.forEach(fn => fn());
}

function readLang(): AppLang {
  try {
    const raw = localStorage.getItem('4send_language');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (SUPPORTED_LANGS.includes(parsed)) return parsed;
    }
  } catch {}
  return 'ru';
}

function writeLang(lang: AppLang) {
  localStorage.setItem('4send_language', JSON.stringify(lang));
}

async function loadLang(lang: AppLang): Promise<void> {
  if (loadedLangs.has(lang)) return;
  try {
    const res = await fetch(`/languages/${lang}.json?v=${APP_VERSION}`);
    if (res.ok) {
      translations[lang] = await res.json() as Record<string, string>;
      loadedLangs.add(lang);
    }
  } catch {}
}

export const loadTranslations = async (): Promise<void> => {
  currentLang = readLang();
  document.documentElement.lang = currentLang;
  document.documentElement.dir = 'ltr';
  await Promise.all([loadLang('ru'), loadLang(currentLang)]);
};

export const useI18n = () => {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const fn = () => forceUpdate(n => n + 1);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    let text = (translations[currentLang] && translations[currentLang]?.[key])
      || (translations.ru && translations.ru[key])
      || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(new RegExp(`{${k}}`, 'g'), String(v));
      });
    }
    return text;
  }, []);

  const switchLanguage = useCallback((newLang: AppLang) => {
    if (newLang === currentLang) return;
    if (!loadedLangs.has(newLang)) {
      loadLang(newLang).then(() => broadcast());
    }
    currentLang = newLang;
    writeLang(newLang);
    document.documentElement.lang = newLang;
    document.documentElement.dir = 'ltr';
    broadcast();
  }, []);

  return { t, lang: currentLang, switchLanguage };
};

export const translate = (key: string, params?: Record<string, string | number>): string => {
  let text = (translations[currentLang] && translations[currentLang]?.[key])
    || (translations.ru && translations.ru[key])
    || key;
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(new RegExp(`{${k}}`, 'g'), String(v));
    });
  }
  return text;
};

export const getCurrentLang = (): AppLang => currentLang;