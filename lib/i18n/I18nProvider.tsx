'use client';

import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { DEFAULT_LOCALE, type Locale } from '@/messages';

import { AVAILABLE_LOCALES, getLocaleLabel, getMessage, getNextLocale as getRegisteredNextLocale, LOCALE_STORAGE_KEY, resolveLocale, type LocaleOption, type MessageKey } from './messages';
import { type MessageParams } from './types';

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  locales: readonly LocaleOption[];
  t: (key: MessageKey, params?: MessageParams) => string;
  getLocaleLabel: (locale: Locale) => string;
  getNextLocale: (locale?: Locale) => Locale;
};

type I18nProviderProps = {
  children: ReactNode;
  initialLocale?: Locale;
};

export const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export function I18nProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
}: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let nextLocale = initialLocale;

    try {
      const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      nextLocale = resolveLocale(storedLocale, initialLocale);
    } catch {
      // Ignore storage access issues and keep the default locale.
    }

    setLocaleState(nextLocale);
    setHydrated(true);
  }, [initialLocale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    if (!hydrated) return;

    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      // Ignore storage access issues; the in-memory locale still works.
    }
  }, [hydrated, locale]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== LOCALE_STORAGE_KEY) return;
      setLocaleState(resolveLocale(event.newValue, DEFAULT_LOCALE));
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
  }, []);

  const t = useCallback((key: MessageKey, params?: MessageParams) => {
    return getMessage(locale, key, params);
  }, [locale]);

  const localeLabel = useCallback((targetLocale: Locale) => {
    return getLocaleLabel(targetLocale);
  }, []);

  const nextLocale = useCallback((fromLocale: Locale = locale) => {
    return getRegisteredNextLocale(fromLocale);
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    setLocale,
    locales: AVAILABLE_LOCALES,
    t,
    getLocaleLabel: localeLabel,
    getNextLocale: nextLocale,
  }), [locale, localeLabel, nextLocale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
