//lib/i18n/languageOptions.ts

import { LOCALE_REGISTRY, type Locale } from '@/messages';

type FutureLanguageCode = 'zh' | 'ja' | 'es' | 'ru' | 'fr' | 'de' | 'ar';
type PendingLanguageCode = Exclude<FutureLanguageCode, Locale>;

type EnabledLanguageOption = {
  code: Locale;
  label: string;
  enabled: true;
};

type PendingLanguageOption = {
  code: PendingLanguageCode;
  label: string;
  enabled: false;
};

export type LanguageOption = EnabledLanguageOption | PendingLanguageOption;
export type LanguageOptionCode = LanguageOption['code'];

const IMPLEMENTED_LANGUAGE_OPTIONS: EnabledLanguageOption[] = (
  Object.entries(LOCALE_REGISTRY) as [Locale, { label: string }][]
).map(([code, definition]) => ({
  code,
  label: definition.label,
  enabled: true,
}));

const PENDING_LANGUAGE_OPTIONS: readonly PendingLanguageOption[] = [
  { code: 'zh', label: '中文', enabled: false },
  { code: 'es', label: 'Español', enabled: false },
  { code: 'ru', label: 'Русский', enabled: false },
  { code: 'fr', label: 'Français', enabled: false },
  { code: 'de', label: 'Deutsch', enabled: false },
  { code: 'ar', label: 'العربية', enabled: false },
] as const;

// To enable a future language:
// 1. Add/register its messages in messages/index.ts
// 2. Remove its pending entry below so it becomes implemented via LOCALE_REGISTRY
export const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  ...IMPLEMENTED_LANGUAGE_OPTIONS,
  ...PENDING_LANGUAGE_OPTIONS,
];

export function isEnabledLanguageOption(option: LanguageOption): option is EnabledLanguageOption {
  return option.enabled;
}

export function getLanguageOption(code: LanguageOptionCode | Locale) {
  return LANGUAGE_OPTIONS.find((option) => option.code === code) ?? null;
}

export function getCurrentLanguageOption(locale: Locale) {
  return getLanguageOption(locale) ?? LANGUAGE_OPTIONS[0];
}
