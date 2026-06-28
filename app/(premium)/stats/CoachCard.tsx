'use client';

import type { ReactNode } from 'react';
import styles from './stats.module.css';

/**
 * AI Coach card. Pure render — all data/handlers/strings come in as props.
 * Translation, cooldown math, gating and report generation all stay in page.tsx.
 *
 * The CoachReportRich element is built in page.tsx (it consumes page state) and
 * passed in as `coachReportRich`. `coachReport` is the truthiness flag used to
 * decide whether the report box renders.
 */
export default function CoachCard(props: {
  title: string;
  loading: boolean;
  minimumMet: boolean;
  bestResultsMet: boolean;
  isPremium: boolean;
  coachLoading: boolean;
  cooldownActive: boolean;
  coachLoadingDots: number;
  coachError: string | null;
  coachReport: unknown;
  coachCreatedAt: number | null;
  // resolved strings
  loadingLabel: string;
  needsDataTitle: string;
  needsDataBody: string;
  needsDataHint: string;
  takeTestLabel: string;
  upgradeLabel: string;
  firstReportTitle: string;
  firstReportBody: string;
  firstReportNextSteps: string;
  readyText: string;
  generateButtonTitle: string;
  generateLabel: string;
  generatingLabel: string;
  lockedLabel: string;
  cooldownMetaText: string;
  reportTitle: string;
  reportStampText: string;
  // handlers
  onTakeTest: () => void;
  onUpgrade: () => void;
  onGenerate: () => void;
  // report body element (built in page.tsx)
  coachReportRich: ReactNode;
}) {
  const {
    title,
    loading,
    minimumMet,
    bestResultsMet,
    isPremium,
    coachLoading,
    cooldownActive,
    coachLoadingDots,
    coachError,
    coachReport,
    loadingLabel,
    needsDataTitle,
    needsDataBody,
    needsDataHint,
    takeTestLabel,
    upgradeLabel,
    firstReportTitle,
    firstReportBody,
    firstReportNextSteps,
    readyText,
    generateButtonTitle,
    generateLabel,
    generatingLabel,
    lockedLabel,
    cooldownMetaText,
    reportTitle,
    reportStampText,
    onTakeTest,
    onUpgrade,
    onGenerate,
    coachReportRich,
  } = props;

  return (
    <article className={styles.statsCard}>
      <header className={styles.statsCardHeader}>
        <h2 className={styles.statsCardTitle}>{title}</h2>
      </header>

      {loading ? (
        <p className={styles.coachSubtle}>{loadingLabel}</p>
      ) : !minimumMet ? (
        <>
          <p className={styles.coachSubtle}><strong>{needsDataTitle}</strong></p>
          <p className={styles.coachHint} style={{ whiteSpace: 'pre-line' }}>{needsDataBody}</p>
          <p className={styles.coachHint}>{needsDataHint}</p>

          <div className={styles.coachRow}>
            <button
              type="button"
              className={styles.coachBtnPrimary}
              onClick={onTakeTest}
            >
              {takeTestLabel}
            </button>
            {!isPremium ? (
              <button
                type="button"
                className={styles.coachBtnSecondary}
                onClick={onUpgrade}
              >
                {upgradeLabel}
              </button>
            ) : null}
          </div>
        </>
      ) : (
        <>
          {!bestResultsMet ? (
            <>
              <p className={styles.coachSubtle}>
                <strong>{firstReportTitle}</strong>
              </p>
              <p className={styles.coachHint} style={{ whiteSpace: 'pre-line' }}>{firstReportBody}</p>
              <p className={styles.coachHint} style={{ whiteSpace: 'pre-line' }}>{firstReportNextSteps}</p>
            </>
          ) : (
            <p className={styles.coachSubtle}>
              <strong>{readyText}</strong>
            </p>
          )}

          <div className={styles.coachRow}>
            <button
              type="button"
              className={styles.coachBtnPrimary}
              onClick={onGenerate}
              disabled={coachLoading || cooldownActive}
              title={generateButtonTitle}
            >
              {coachLoading
                ? (
                  <>
                    <span>{generatingLabel}</span>
                    <span className={styles.loadingDots} aria-hidden="true">
                      {".".repeat(coachLoadingDots)}
                    </span>
                  </>
                )
                : cooldownActive
                ? lockedLabel
                : generateLabel}
            </button>

            <button
              type="button"
              className={styles.coachBtnSecondary}
              onClick={onTakeTest}
            >
              {takeTestLabel}
            </button>
          </div>

          <div className={styles.coachMeta}>
            {cooldownMetaText}
          </div>

          {coachError ? <div className={styles.coachError}>{coachError}</div> : null}

          {coachReport ? (
            <div className={styles.coachReportBox}>
              <div className={styles.coachReportHeader}>
                <p className={styles.coachReportTitle}>{reportTitle}</p>
                <p className={styles.coachReportStamp}>
                  {reportStampText}
                </p>
              </div>
              <div className={styles.coachReportText}>
                {coachReportRich}
              </div>

            </div>
          ) : null}
        </>
      )}
    </article>
  );
}
