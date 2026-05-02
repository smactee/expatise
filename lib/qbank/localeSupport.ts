const BASE_QUESTION_URL = '/qbank/2023-test1/questions.json';

const PRODUCTION_TRANSLATION_URLS: Record<string, string> = {
  ko: '/qbank/2023-test1/translations.ko.json',
  ja: '/qbank/2023-test1/translations.ja.json',
  ru: '/qbank/2023-test1/translations.ru.json',
};

const TRANSLATION_NOTICE_LABELS: Record<string, string> = {
  ko: 'Korean',
  ja: 'Japanese',
  ru: 'Russian',
};

export const showLanguageDebugCounts =
  process.env.NODE_ENV !== 'production' ||
  process.env.NEXT_PUBLIC_SHOW_LANGUAGE_DEBUG_COUNTS === '1';

function isDevelopmentVisibilityEnabled(): boolean {
  return process.env.NODE_ENV !== 'production';
}

export function hasProductionQuestionTranslations(locale: string | null | undefined): boolean {
  return normalizeLocale(locale) in PRODUCTION_TRANSLATION_URLS;
}

export function isTranslatedOnlyQuestionLocale(locale: string | null | undefined): boolean {
  const normalized = normalizeLocale(locale);
  if (normalized === 'ja') return true;
  return isDevelopmentVisibilityEnabled() && hasProductionQuestionTranslations(normalized);
}

export function getTranslatedOnlyLocaleNotice(locale: string | null | undefined, count: number): string | null {
  const normalized = normalizeLocale(locale);
  if (
    !showLanguageDebugCounts ||
    !hasProductionQuestionTranslations(normalized) ||
    !Number.isFinite(count) ||
    count <= 0
  ) {
    return null;
  }

  const label = TRANSLATION_NOTICE_LABELS[normalized] ?? normalized.toUpperCase();
  return `${label} beta currently has ${count} translated questions available.`;
}

export function getLanguageQuestionCountNotice(locale: string | null | undefined, count: number): string | null {
  const normalized = normalizeLocale(locale);
  if (!showLanguageDebugCounts || !Number.isFinite(count) || count <= 0) {
    return null;
  }

  if (normalized === 'en') {
    return `English currently has ${count} questions available.`;
  }

  return getTranslatedOnlyLocaleNotice(normalized, count);
}

export async function loadLanguageQuestionCounts(): Promise<Record<string, number>> {
  if (!showLanguageDebugCounts) return {};

  const entries = await Promise.all(
    [
      ['en', BASE_QUESTION_URL],
      ...Object.entries(PRODUCTION_TRANSLATION_URLS),
    ].map(async ([locale, url]) => {
      try {
        const response = await fetch(`${url}?v=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) return [locale, 0] as const;

        const json = await response.json();
        return [locale, countUsableQuestions(json)] as const;
      } catch {
        return [locale, 0] as const;
      }
    }),
  );

  return Object.fromEntries(entries);
}

function normalizeLocale(locale: string | null | undefined): string {
  return String(locale ?? '').trim().toLowerCase();
}

function countUsableQuestions(raw: unknown): number {
  const container =
    raw && typeof raw === 'object'
      ? ((raw as { questions?: unknown }).questions ?? raw)
      : null;

  if (!container || typeof container !== 'object') {
    return 0;
  }

  const entries = Array.isArray(container) ? container : Object.values(container);

  return entries.filter((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    const prompt = (entry as { prompt?: unknown }).prompt;
    return typeof prompt === 'string' && prompt.trim().length > 0;
  }).length;
}
