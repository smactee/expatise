import type { Locale } from '@/messages';

const ROW_DISPLAY_LABELS: Record<Locale, { right: string; wrong: string }> = {
  en: {
    right: 'Right',
    wrong: 'Wrong',
  },
  ko: {
    right: 'Y',
    wrong: 'N',
  },
  ja: {
    right: 'Yes',
    wrong: 'No',
  },
  fr: {
    right: 'Vrai',
    wrong: 'Faux',
  },
  es: {
    right: 'Verdadero',
    wrong: 'Falso',
  },
  de: {
    right: 'Richtig',
    wrong: 'Falsch',
  },
  'en-orig': {
    right: 'Right',
    wrong: 'Wrong',
  },
};

export function getRowDisplayLabel(
  value: string | null | undefined,
  locale: Locale,
): string {
  if (!value) return "";

  const normalized = value.trim().toLowerCase();
  const labels = ROW_DISPLAY_LABELS[locale] ?? ROW_DISPLAY_LABELS.en;

  if (normalized === "r" || normalized === "right") return labels.right;
  if (normalized === "w" || normalized === "wrong") return labels.wrong;

  return "";
}
