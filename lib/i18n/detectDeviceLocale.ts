import { DEFAULT_LOCALE, type Locale } from '@/messages';

import { getLanguageOption, isEnabledLanguageOption } from './languageOptions';

// "ko-KR" / "es-419" / "pt-BR" -> "ko" / "es" / "pt"
function baseCode(tag: string): string {
  return String(tag || '').toLowerCase().split('-')[0]!.trim();
}

/**
 * Best ENABLED, production-ready locale matching the device's preferred
 * languages, or null if none beats the default. Reads `navigator.languages`
 * (works in the Capacitor Android webview; mirrors the OS language). Never
 * suggests the default locale, and stops at the first preference that is the
 * default — i.e. if the user prefers English over an available language, we
 * don't nag them.
 */
export function detectDeviceLocale(): Locale | null {
  if (typeof navigator === 'undefined') return null;

  const prefs: string[] = [];
  if (Array.isArray(navigator.languages)) prefs.push(...navigator.languages);
  if (navigator.language) prefs.push(navigator.language);

  for (const pref of prefs) {
    const code = baseCode(pref);
    if (!code) continue;
    // The user's top-ranked language is the default → respect it, no prompt.
    if (code === DEFAULT_LOCALE) return null;
    const option = getLanguageOption(code);
    if (option && isEnabledLanguageOption(option)) {
      return code as Locale;
    }
    // Known-but-not-enabled (e.g. a pending language) → keep scanning lower
    // preferences in case the next one is available.
  }

  return null;
}
