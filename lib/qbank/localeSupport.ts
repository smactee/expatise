export function isTranslatedOnlyQuestionLocale(locale: string | null | undefined): boolean {
  return String(locale ?? '').trim().toLowerCase() === 'ja';
}

export function getTranslatedOnlyLocaleNotice(locale: string | null | undefined, count: number): string | null {
  if (!isTranslatedOnlyQuestionLocale(locale) || !Number.isFinite(count) || count <= 0) {
    return null;
  }

  return `日本語ベータ版では現在、翻訳済み問題を${count}問利用できます。`;
}
