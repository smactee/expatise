//lib/i18n/languageOptions.ts

import { LOCALE_REGISTRY, type Locale } from '@/messages';

type FutureLanguageCode = 'zh' | 'es' | 'ru' | 'de' | 'ar';
type PendingLanguageCode = Exclude<FutureLanguageCode, Locale>;
type DevLanguageCode = 'ru' | 'es';

type LanguageOptionBase = {
  code: Locale | PendingLanguageCode;
  label: string;
  enabled: boolean;
  productionReady: boolean;
};

export type LanguageOption = LanguageOptionBase;
export type LanguageOptionCode = LanguageOption['code'];

const DEV_LANGUAGE_CODES = new Set<DevLanguageCode>(['ru', 'es']);

export function areDevLanguagesEnabled(): boolean {
  return process.env.NODE_ENV !== 'production';
}

export function isLanguageAvailable(code: LanguageOptionCode | string): boolean {
  if (code in LOCALE_REGISTRY) return true;
  return areDevLanguagesEnabled() && DEV_LANGUAGE_CODES.has(code as DevLanguageCode);
}

const IMPLEMENTED_LANGUAGE_OPTIONS: LanguageOption[] = (
  Object.entries(LOCALE_REGISTRY) as [Locale, { label: string }][]
).map(([code, definition]) => ({
  code,
  label: definition.label,
  enabled: true,
  productionReady: true,
}));

const PENDING_LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  { code: 'zh', label: '中文', enabled: isLanguageAvailable('zh'), productionReady: false },
  { code: 'es', label: 'Español', enabled: isLanguageAvailable('es'), productionReady: false },
  { code: 'ru', label: 'Русский', enabled: isLanguageAvailable('ru'), productionReady: false },
  { code: 'de', label: 'Deutsch', enabled: isLanguageAvailable('de'), productionReady: false },
  { code: 'ar', label: 'العربية', enabled: isLanguageAvailable('ar'), productionReady: false },
];

// To enable a future language:
// 1. Add/register its messages in messages/index.ts
// 2. Remove its pending entry below so it becomes implemented via LOCALE_REGISTRY

// The original-test pseudo-language ("British Chinglish") is pinned to the very
// top of the picker so users can jump straight to the verbatim PDF text.
const ORIGINAL_TEST_LANGUAGE_CODE: Locale = 'en-orig';

export const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  ...IMPLEMENTED_LANGUAGE_OPTIONS.filter((option) => option.code === ORIGINAL_TEST_LANGUAGE_CODE),
  ...IMPLEMENTED_LANGUAGE_OPTIONS.filter((option) => option.code !== ORIGINAL_TEST_LANGUAGE_CODE),
  ...PENDING_LANGUAGE_OPTIONS,
];

export function isEnabledLanguageOption(option: LanguageOption): boolean {
  return option.enabled && isLanguageAvailable(option.code);
}

export function getLanguageOption(code: LanguageOptionCode | Locale) {
  return LANGUAGE_OPTIONS.find((option) => option.code === code) ?? null;
}

export function getCurrentLanguageOption(locale: Locale) {
  return getLanguageOption(locale) ?? LANGUAGE_OPTIONS[0];
}
