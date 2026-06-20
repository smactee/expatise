//lib/i18n/direction.ts

import type { Locale } from '@/messages';

export type Direction = 'ltr' | 'rtl';

// Locales whose UI renders right-to-left. Arabic is the only RTL UI locale today;
// add others here (e.g. 'he', 'fa', 'ur') as they are localized. Kept as a plain
// string set so it can be queried with raw/normalized locale codes too.
const RTL_LOCALES = new Set<string>(['ar']);

/** Writing direction for a locale — drives <html dir> and CSS logical properties. */
export function getLocaleDirection(locale: Locale | string | null | undefined): Direction {
  return RTL_LOCALES.has(String(locale ?? '')) ? 'rtl' : 'ltr';
}

export function isRtlLocale(locale: Locale | string | null | undefined): boolean {
  return RTL_LOCALES.has(String(locale ?? ''));
}
