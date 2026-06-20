//lib/i18n/languageOptions.ts

import { LOCALE_REGISTRY, type Locale } from '@/messages';

type FutureLanguageCode = 'zh' | 'es' | 'ru' | 'de' | 'ar';
type PendingLanguageCode = Exclude<FutureLanguageCode, Locale>;
type DevLanguageCode = 'ar' | 'zh';

type LanguageOptionBase = {
  code: Locale | PendingLanguageCode;
  label: string;
  enabled: boolean;
  productionReady: boolean;
};

export type LanguageOption = LanguageOptionBase;
export type LanguageOptionCode = LanguageOption['code'];

// ar + zh have full UI message bundles but their QUESTION banks are still being
// built, so they stay dev-only (selectable/testable in dev, "Not ready" in
// production). ru was promoted to production once its bundle landed (its 1004-q
// bank is complete), so it is intentionally absent here.
const DEV_LANGUAGE_CODES = new Set<DevLanguageCode>(['ar', 'zh']);

export function areDevLanguagesEnabled(): boolean {
  return process.env.NODE_ENV !== 'production';
}

export function isLanguageAvailable(code: LanguageOptionCode | string): boolean {
  if (code in LOCALE_REGISTRY) return true;
  return areDevLanguagesEnabled() && DEV_LANGUAGE_CODES.has(code as DevLanguageCode);
}

const IMPLEMENTED_LANGUAGE_OPTIONS: LanguageOption[] = (
  Object.entries(LOCALE_REGISTRY) as [Locale, { label: string }][]
).map(([code, definition]) => {
  // A locale can have its full UI messages registered (so the translated UI
  // is ready and testable in dev) while its QUESTION bank is still being
  // built. Such locales stay dev-only — they appear as "Not ready" in
  // production and are not selectable until promoted. To promote, remove the
  // code from DEV_LANGUAGE_CODES above.
  const devOnly = DEV_LANGUAGE_CODES.has(code as DevLanguageCode);
  return {
    code,
    label: definition.label,
    enabled: devOnly ? areDevLanguagesEnabled() : true,
    productionReady: !devOnly,
  };
});

// zh, ru, ar all have registered UI message bundles now, so they are sourced from
// LOCALE_REGISTRY (IMPLEMENTED_LANGUAGE_OPTIONS) rather than listed as pending. ru
// is production-ready; ar + zh remain dev-only via DEV_LANGUAGE_CODES above.
const PENDING_LANGUAGE_OPTIONS: readonly LanguageOption[] = [];

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

export function getLanguageOption(code: LanguageOptionCode | Locale | string) {
  return LANGUAGE_OPTIONS.find((option) => option.code === code) ?? null;
}

export function getCurrentLanguageOption(locale: Locale) {
  return getLanguageOption(locale) ?? LANGUAGE_OPTIONS[0];
}
