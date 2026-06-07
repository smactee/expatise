'use client';

import { useT } from '@/lib/i18n/useT';

import styles from './LanguageSuggestionModal.module.css';

// Shown in the SUGGESTED language so the user understands the offer in their own
// language. Falls back to English for any locale not listed here.
const PROMPT_STRINGS: Record<string, { question: string; accept: string; decline: string }> = {
  ko: { question: '앱을 한국어로 표시할까요?', accept: '한국어로 전환', decline: 'English 유지' },
  ja: { question: 'アプリを日本語で表示しますか？', accept: '日本語に切り替え', decline: 'English のまま' },
  fr: { question: "Afficher l'application en français ?", accept: 'Passer en français', decline: 'Rester en anglais' },
  es: { question: '¿Mostrar la app en español?', accept: 'Cambiar a español', decline: 'Seguir en inglés' },
};

export default function LanguageSuggestionModal() {
  const { suggestedLocale, acceptLanguageSuggestion, dismissLanguageSuggestion, getLocaleLabel } = useT();

  if (!suggestedLocale) return null;

  const label = getLocaleLabel(suggestedLocale);
  const strings = PROMPT_STRINGS[suggestedLocale] ?? {
    question: `Switch the app to ${label}?`,
    accept: `Switch to ${label}`,
    decline: 'Keep English',
  };

  return (
    <div
      className={styles.overlay}
      onClick={dismissLanguageSuggestion}
      role="dialog"
      aria-modal="true"
      aria-label={strings.question}
    >
      <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div className={styles.label}>{label}</div>
        <div className={styles.title}>{strings.question}</div>
        <div className={styles.buttons}>
          <button type="button" className={styles.decline} onClick={dismissLanguageSuggestion}>
            {strings.decline}
          </button>
          <button type="button" className={styles.accept} onClick={acceptLanguageSuggestion}>
            {strings.accept}
          </button>
        </div>
      </div>
    </div>
  );
}
