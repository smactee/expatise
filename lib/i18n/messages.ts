//lib/i18n/messages.ts

import { DEFAULT_LOCALE, LOCALE_REGISTRY, type AppMessages, type Locale, type LocaleDefinition } from '@/messages';

import { type MessageKeyOf, type MessageParams } from './types';

export const LOCALE_STORAGE_KEY = 'expatise-locale';

export type Messages = AppMessages;
export type MessageKey = MessageKeyOf<Messages>;

export type LocaleOption = {
  code: Locale;
  label: string;
};

const localeEntries = Object.entries(LOCALE_REGISTRY) as [Locale, LocaleDefinition<Messages>][];
const warnedMessages = new Set<string>();

export const AVAILABLE_LOCALES = localeEntries.map(([code, definition]) => ({
  code,
  label: definition.label,
})) as readonly LocaleOption[];

export function isLocale(value: string | null | undefined): value is Locale {
  return typeof value === 'string' && value in LOCALE_REGISTRY;
}

function isDevelopmentQuestionLocale(value: string | null | undefined): boolean {
  return process.env.NODE_ENV !== 'production' && value === 'ru';
}

export function resolveLocale(value: string | null | undefined, fallback: Locale = DEFAULT_LOCALE): Locale {
  if (isLocale(value)) return value;
  if (isDevelopmentQuestionLocale(value)) return value as Locale;
  return fallback;
}

function warnOnce(cacheKey: string, message: string) {
  if (process.env.NODE_ENV === 'production') return;
  if (warnedMessages.has(cacheKey)) return;

  warnedMessages.add(cacheKey);
  console.warn(message);
}

function readMessage(messages: Messages, key: MessageKey): string | undefined {
  const resolved = key.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[segment];
  }, messages);

  return typeof resolved === 'string' ? resolved : undefined;
}

function formatMessage(locale: Locale | string, key: MessageKey, template: string, params?: MessageParams): string {
  if (!params) {
    const unresolvedTokens = template.match(/\{(\w+)\}/g);
    if (unresolvedTokens) {
      warnOnce(
        `missing-params:${locale}:${key}:${unresolvedTokens.join('|')}`,
        `[i18n] Missing interpolation params for "${key}" in locale "${locale}": ${unresolvedTokens.join(', ')}`
      );
    }

    return template;
  }

  const missingTokens = new Set<string>();

  const formatted = template.replace(/\{(\w+)\}/g, (_, token: string) => {
    const value = params[token];
    if (value == null) {
      missingTokens.add(token);
      return `{${token}}`;
    }

    return String(value);
  });

  if (missingTokens.size > 0) {
    warnOnce(
      `missing-params:${locale}:${key}:${[...missingTokens].join('|')}`,
      `[i18n] Missing interpolation params for "${key}" in locale "${locale}": ${[...missingTokens].join(', ')}`
    );
  }

  return formatted;
}

function getLocaleMessages(locale: Locale | string): Messages {
  return LOCALE_REGISTRY[locale as Locale]?.messages ?? LOCALE_REGISTRY[DEFAULT_LOCALE].messages;
}

export function getMessage(locale: Locale | string, key: MessageKey, params?: MessageParams): string {
  const localeTemplate = readMessage(getLocaleMessages(locale), key);
  if (localeTemplate != null) {
    return formatMessage(locale, key, localeTemplate, params);
  }

  const fallbackTemplate = readMessage(getLocaleMessages(DEFAULT_LOCALE), key);
  if (fallbackTemplate != null) {
    warnOnce(
      `missing-translation:${locale}:${key}`,
      `[i18n] Missing translation for "${key}" in locale "${locale}". Falling back to "${DEFAULT_LOCALE}".`
    );
    return formatMessage(DEFAULT_LOCALE, key, fallbackTemplate, params);
  }

  warnOnce(
    `missing-key:${key}`,
    `[i18n] Missing translation key "${key}" in both locale "${locale}" and fallback "${DEFAULT_LOCALE}".`
  );

  return key;
}

export function getLocaleLabel(locale: Locale | string): string {
  return LOCALE_REGISTRY[locale as Locale]?.label ?? LOCALE_REGISTRY[DEFAULT_LOCALE].label;
}

export function getNextLocale(locale: Locale): Locale {
  const currentIndex = AVAILABLE_LOCALES.findIndex((option) => option.code === locale);
  if (currentIndex < 0 || AVAILABLE_LOCALES.length === 0) return DEFAULT_LOCALE;

  const nextIndex = (currentIndex + 1) % AVAILABLE_LOCALES.length;
  return AVAILABLE_LOCALES[nextIndex].code;
}
