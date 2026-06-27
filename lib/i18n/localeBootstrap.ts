// lib/i18n/localeBootstrap.ts
//
// Blocking <head> script that sets <html lang> and <html dir> from the stored
// locale BEFORE first paint — the i18n analogue of getThemeBootstrapScript.
//
// Without it the document is served as lang="en" dir="ltr" and only flips to
// Arabic / RTL after hydration (a visible flash, and the wrong `lang` for screen
// readers on the first paint). RTL is applied ONLY to right-to-left locales
// (currently just 'ar', from direction.ts); every other locale resolves to
// dir="ltr", so this can never affect a non-Arabic UI.

import { LOCALE_REGISTRY, DEFAULT_LOCALE } from '@/messages';

import { isRtlLocale } from './direction';
import { LOCALE_STORAGE_KEY } from './messages';

export function getLocaleBootstrapScript(): string {
  const codes = Object.keys(LOCALE_REGISTRY);
  const rtlCodes = codes.filter((code) => isRtlLocale(code));

  // Self-contained IIFE — no imports at runtime. Validates the stored value
  // against the known locale codes and falls back to the default locale.
  return `(function(){var d=document.documentElement;var key=${JSON.stringify(
    LOCALE_STORAGE_KEY,
  )};var codes=${JSON.stringify(codes)};var rtl=${JSON.stringify(
    rtlCodes,
  )};var loc=${JSON.stringify(DEFAULT_LOCALE)};try{var s=window.localStorage.getItem(key);if(s&&codes.indexOf(s)>-1){loc=s}}catch(e){}d.lang=loc;d.dir=rtl.indexOf(loc)>-1?'rtl':'ltr';})();`;
}
