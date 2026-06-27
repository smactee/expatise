// lib/i18n/dateLocale.ts
//
// Locale tag for Date/number formatting. Uses the document's active language
// (set to 'ar' for Arabic by the locale bootstrap) instead of the browser
// default, so dates localize to the chosen UI language. The `-u-nu-latn`
// extension forces the Latin (western) numbering system — 123, never ١٢٣ —
// per product requirement, while still giving Arabic month/weekday names.
export function dateLocale(): string {
  if (typeof document === 'undefined') return 'en-u-nu-latn';
  const lang = document.documentElement.lang || 'en';
  return `${lang}-u-nu-latn`;
}
