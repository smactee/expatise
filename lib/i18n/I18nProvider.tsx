'use client';

import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { DEFAULT_LOCALE, type Locale } from '@/messages';

import { detectDeviceLocale } from './detectDeviceLocale';
import { getLocaleDirection } from './direction';
import { AVAILABLE_LOCALES, getLocaleLabel, getMessage, getNextLocale as getRegisteredNextLocale, LOCALE_STORAGE_KEY, resolveLocale, type LocaleOption, type MessageKey } from './messages';
import { type MessageParams } from './types';

// Set once the device-language suggestion prompt has been shown, so a returning
// first-run user is never re-prompted (belt-and-suspenders alongside the stored locale).
const LANGUAGE_PROMPT_SEEN_KEY = 'expatise.languagePromptSeen';

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  locales: readonly LocaleOption[];
  t: (key: MessageKey, params?: MessageParams) => string;
  getLocaleLabel: (locale: Locale) => string;
  getNextLocale: (locale?: Locale) => Locale;
  /** A locale matching the device language, proposed on first launch (null = no prompt). */
  suggestedLocale: Locale | null;
  /** Accept the device-language suggestion: switch to it and dismiss the prompt for good. */
  acceptLanguageSuggestion: () => void;
  /** Decline the suggestion: keep the current locale and don't prompt again. */
  dismissLanguageSuggestion: () => void;
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
  const [suggestedLocale, setSuggestedLocale] = useState<Locale | null>(null);

  useEffect(() => {
    let nextLocale = initialLocale;
    let hadStoredLocale = false;

    try {
      const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      hadStoredLocale = storedLocale != null;
      nextLocale = resolveLocale(storedLocale, initialLocale);
    } catch {
      // Ignore storage access issues and keep the default locale.
    }

    setLocaleState(nextLocale);
    setHydrated(true);

    // First launch only (no explicit choice yet): if the device language maps to
    // an enabled locale that isn't what we're about to show, offer to switch.
    if (!hadStoredLocale) {
      try {
        const alreadyPrompted = window.localStorage.getItem(LANGUAGE_PROMPT_SEEN_KEY);
        if (!alreadyPrompted) {
          const detected = detectDeviceLocale();
          if (detected && detected !== nextLocale) {
            setSuggestedLocale(detected);
          }
        }
      } catch {
        // Ignore storage/navigator access issues — just skip the suggestion.
      }
    }
  }, [initialLocale]);

  useEffect(() => {
    document.documentElement.lang = locale;
    // Mirror the layout for RTL locales (Arabic). CSS logical properties +
    // [dir="rtl"] overrides key off this; LTR locales resolve to 'ltr' unchanged.
    document.documentElement.dir = getLocaleDirection(locale);
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

  const markLanguagePromptSeen = useCallback(() => {
    try {
      window.localStorage.setItem(LANGUAGE_PROMPT_SEEN_KEY, '1');
    } catch {
      // Ignore storage access issues; the stored locale already prevents re-prompting.
    }
  }, []);

  const acceptLanguageSuggestion = useCallback(() => {
    setSuggestedLocale((suggested) => {
      if (suggested) setLocaleState(suggested);
      return null;
    });
    markLanguagePromptSeen();
  }, [markLanguagePromptSeen]);

  const dismissLanguageSuggestion = useCallback(() => {
    setSuggestedLocale(null);
    markLanguagePromptSeen();
  }, [markLanguagePromptSeen]);

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
    suggestedLocale,
    acceptLanguageSuggestion,
    dismissLanguageSuggestion,
  }), [locale, localeLabel, nextLocale, setLocale, t, suggestedLocale, acceptLanguageSuggestion, dismissLanguageSuggestion]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
