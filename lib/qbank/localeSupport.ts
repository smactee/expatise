import { getMessage } from '@/lib/i18n/messages';

const BASE_QUESTION_URL = '/qbank/2023-test1/questions.json';

const PRODUCTION_TRANSLATION_URLS: Record<string, string> = {
  'en-orig': '/qbank/2023-test1/translations.en-orig.json',
  ko: '/qbank/2023-test1/translations.ko.json',
  ja: '/qbank/2023-test1/translations.ja.json',
  fr: '/qbank/2023-test1/translations.fr.json',
  ru: '/qbank/2023-test1/translations.ru.json',
  es: '/qbank/2023-test1/translations.es.json',
  de: '/qbank/2023-test1/translations.de.json',
  ar: '/qbank/2023-test1/translations.ar.json',
  // zh ships as a partial bank (197/1004 as of v3.7.1) and fills in as batches land.
  zh: '/qbank/2023-test1/translations.zh.json',
};

const TRANSLATION_NOTICE_LABELS: Record<string, string> = {
  'en-orig': 'Original PDF (British Chinglish)',
  ko: 'Korean',
  ja: 'Japanese',
  fr: 'French',
  ru: 'Russian',
  es: 'Spanish',
  de: 'German',
  ar: 'Arabic',
  zh: 'Chinese',
};

export const showLanguageDebugCounts =
  process.env.NODE_ENV !== 'production' ||
  process.env.NEXT_PUBLIC_SHOW_LANGUAGE_DEBUG_COUNTS === '1';

export function hasProductionQuestionTranslations(locale: string | null | undefined): boolean {
  return normalizeLocale(locale) in PRODUCTION_TRANSLATION_URLS;
}

export function isTranslatedOnlyQuestionLocale(locale: string | null | undefined): boolean {
  const normalized = normalizeLocale(locale);
  // Data-driven, no per-language list: every non-English locale shows ONLY its
  // translated questions. A complete bank shows all of them; a partial bank (e.g.
  // Arabic mid-build) shows just the translated subset; an empty bank (no batches
  // yet, e.g. Chinese) shows none — instead of silently falling back to the English
  // master. 'en' is the source locale (all questions); '' guards null/unknown input.
  return normalized !== '' && normalized !== 'en';
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
  return getMessage(normalized, 'qbank.betaNotice', { count, label });
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
