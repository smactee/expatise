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
    !isDevelopmentVisibilityEnabled() ||
    !hasProductionQuestionTranslations(normalized) ||
    !Number.isFinite(count) ||
    count <= 0
  ) {
    return null;
  }

  const label = TRANSLATION_NOTICE_LABELS[normalized] ?? normalized.toUpperCase();
  return `${label} beta currently has ${count} translated questions available.`;
}

export async function loadProductionTranslationCounts(): Promise<Record<string, number>> {
  if (!isDevelopmentVisibilityEnabled()) return {};

  const entries = await Promise.all(
    Object.entries(PRODUCTION_TRANSLATION_URLS).map(async ([locale, url]) => {
      try {
        const response = await fetch(`${url}?v=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) return [locale, 0] as const;

        const json = await response.json();
        return [locale, countUsableTranslatedQuestions(json)] as const;
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

function countUsableTranslatedQuestions(raw: unknown): number {
  const container =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? ((raw as { questions?: unknown }).questions ?? raw)
      : null;

  if (!container || typeof container !== 'object' || Array.isArray(container)) {
    return 0;
  }

  return Object.values(container).filter((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    const prompt = (entry as { prompt?: unknown }).prompt;
    return typeof prompt === 'string' && prompt.trim().length > 0;
  }).length;
}
