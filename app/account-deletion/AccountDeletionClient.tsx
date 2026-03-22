'use client';

import { useMemo, type CSSProperties } from 'react';
import { useT } from '@/lib/i18n/useT';
import { useSearchParams } from "next/navigation";

const APP_NAME = 'Expatise';
const SUPPORT_TEAM = 'Expatise Support';
const SUPPORT_EMAIL = 'maverixnmatrix@gmail.com';
const PROCESSING_TIME_DAYS = 30;
const LAST_UPDATED = '2026-03-01';

export default function AccountDeletionClient() {
  const searchParams = useSearchParams();
  const deleted = searchParams.get("deleted") === "1";
  const { t } = useT();

  const subject = t('accountDeletion.emailTemplate.subject');

  const bodyLines = useMemo(
    () => [
      t('accountDeletion.emailTemplate.greeting', { team: SUPPORT_TEAM }),
      '',
      t('accountDeletion.emailTemplate.request'),
      '',
      t('accountDeletion.emailTemplate.details'),
      t('accountDeletion.emailTemplate.signIn'),
      t('accountDeletion.emailTemplate.username'),
      '',
      t('accountDeletion.emailTemplate.thanks'),
    ],
    [t]
  );

  const mailtoHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(bodyLines.join('\n'))}`;

  const styles: Record<string, CSSProperties> = {
    main: {
      maxWidth: 820,
      margin: '0 auto',
      padding: '28px 18px',
      lineHeight: 1.65,
    },
    card: {
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 14,
      padding: 16,
      marginTop: 14,
      background: 'rgba(0,0,0,0.12)',
    },
    h1: { fontSize: 28, fontWeight: 800, marginBottom: 10 },
    h2: { fontSize: 18, fontWeight: 750, marginTop: 18, marginBottom: 8 },
    p: { opacity: 0.9, marginTop: 8 },
    small: { opacity: 0.75, marginTop: 10 },
    ul: { marginTop: 8, paddingLeft: 18, opacity: 0.9 },
    code: {
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: 13,
      padding: '2px 6px',
      borderRadius: 6,
      background: 'rgba(255,255,255,0.08)',
    },
    a: { textDecoration: 'underline' },
  };

  return (
    <main style={styles.main}>
      <h1 style={styles.h1}>{t('accountDeletion.title')}</h1>

      <p style={styles.p}>
        {t('accountDeletion.intro', { appName: APP_NAME })}
      </p>

      {deleted ? (
        <div style={styles.card}>
          <p style={{ ...styles.p, marginTop: 0 }}>
            <b>{t('accountDeletion.successTitle')}</b>{' '}
            {t('accountDeletion.successBody')}
          </p>
        </div>
      ) : null}

      <div style={styles.card}>
        <p style={{ ...styles.p, marginTop: 0 }}>
          <b>{t('accountDeletion.quickOptions')}</b>
        </p>
        <ul style={{ ...styles.ul, marginBottom: 0 }}>
          <li>
            <a style={styles.a} href="#in-app">
              {t('accountDeletion.optionA')}
            </a>
          </li>
          <li>
            <a style={styles.a} href="#email">
              {t('accountDeletion.optionB')}
            </a>
          </li>
        </ul>
      </div>

      <h2 id="in-app" style={styles.h2}>
        {t('accountDeletion.inAppTitle')}
      </h2>
      <p style={styles.p}>{t('accountDeletion.inAppBody')}</p>

      <h2 id="email" style={styles.h2}>
        {t('accountDeletion.emailTitle')}
      </h2>
      <p style={styles.p}>
        {t('accountDeletion.emailIntroPrefix', { team: SUPPORT_TEAM })}{' '}
        <a style={styles.a} href={mailtoHref}>
          {SUPPORT_EMAIL}
        </a>{' '}
        {t('accountDeletion.emailIntroMiddle')}{' '}
        <span style={styles.code}>{subject}</span>
        {t('accountDeletion.emailIntroSuffix')}
      </p>

      <p style={styles.p}>{t('accountDeletion.pleaseInclude')}</p>
      <ul style={styles.ul}>
        <li>{t('accountDeletion.includeSignIn')}</li>
        <li>{t('accountDeletion.includeIdentifier')}</li>
        <li>{t('accountDeletion.includeStatement')}</li>
      </ul>

      <p style={styles.small}>{t('accountDeletion.verifyNote')}</p>

      <h2 style={styles.h2}>{t('accountDeletion.processingTimeTitle')}</h2>
      <p style={styles.p}>
        <b>{t('accountDeletion.processingInApp')}</b>
        <br />
        <b>{t('accountDeletion.processingEmail', { days: PROCESSING_TIME_DAYS })}</b>
      </p>

      <h2 style={styles.h2}>{t('accountDeletion.whatWeDeleteTitle')}</h2>
      <ul style={styles.ul}>
        <li>{t('accountDeletion.deleteAccountRecord')}</li>
        <li>{t('accountDeletion.deleteServerData')}</li>
      </ul>

      <p style={styles.small}>{t('accountDeletion.examplesNote')}</p>

      <h2 style={styles.h2}>{t('accountDeletion.retainTitle')}</h2>
      <ul style={styles.ul}>
        <li>{t('accountDeletion.retainLegal')}</li>
        <li>{t('accountDeletion.retainSecurity')}</li>
      </ul>

      <p style={styles.small}>{t('accountDeletion.retainNote')}</p>

      <h2 style={styles.h2}>{t('accountDeletion.needHelpTitle')}</h2>
      <p style={styles.p}>
        {t('accountDeletion.needHelpPrefix')}{' '}
        <a style={styles.a} href={`mailto:${SUPPORT_EMAIL}`}>
          {SUPPORT_TEAM} ({SUPPORT_EMAIL})
        </a>{' '}
        {t('accountDeletion.needHelpSuffix')}
      </p>

      <p style={styles.small}>{t('accountDeletion.lastUpdated', { date: LAST_UPDATED })}</p>
    </main>
  );
}
