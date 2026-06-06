'use client';

import { useT } from '@/lib/i18n/useT';

/**
 * Banner shown at the top of English-only legal pages (Privacy, Terms) when the
 * user's locale is not English. The legal bodies are intentionally kept in
 * English (the authoritative/governing version); this notice tells non-English
 * users why the page is in English and that the English version governs.
 *
 * Renders nothing for English locales (en, en-orig).
 */
export default function LegalLanguageNotice() {
  const { locale, t } = useT();

  if (locale === 'en' || locale === 'en-orig') return null;

  return (
    <aside
      role="note"
      style={{
        marginTop: 16,
        padding: '12px 14px',
        borderLeft: '3px solid #888',
        borderRadius: 6,
        background: 'rgba(136, 136, 136, 0.08)',
        fontSize: 13,
        lineHeight: 1.55,
      }}
    >
      <strong style={{ display: 'block', marginBottom: 4 }}>
        {t('legal.englishNoticeTitle')}
      </strong>
      <span style={{ opacity: 0.85 }}>{t('legal.englishNoticeBody')}</span>
    </aside>
  );
}
