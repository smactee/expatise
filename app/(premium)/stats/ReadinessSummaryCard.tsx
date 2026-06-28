'use client';

import type { ReactNode } from 'react';
import styles from './stats.module.css';
import ReadinessRing from './ReadinessRing.client';
import TimeframeChips, { type Timeframe } from '@/components/stats/TimeframeChips';

/**
 * Readiness / summary gauge card. Pure render — all data/handlers come in as props.
 * The ReadinessRing element is built in page.tsx (it carries a render `key` and
 * data that must stay co-located with the page's state) and passed in as a node.
 */
export default function ReadinessSummaryCard(props: {
  readinessRing: ReactNode;
  readinessDone: boolean;
  summaryText: string;
  basedOnText: string;
  takeTestLabel: string;
  onTakeTest: () => void;
  tf: Timeframe;
  onTfChange: (tf: Timeframe) => void;
}) {
  const {
    readinessRing,
    readinessDone,
    summaryText,
    basedOnText,
    takeTestLabel,
    onTakeTest,
    tf,
    onTfChange,
  } = props;

  return (
    <section className={styles.statsSummaryCard}>
      <div className={styles.statsSummaryInner}>
        <div className={styles.readinessTitleRow}>
          <span className={styles.statsTitleRow}>
          </span>
        </div>

        {readinessRing}

        {/* 👇 Everything below stays hidden until the ring finishes */}
        <div
          className={styles.readinessReveal}
          data-show={readinessDone ? '1' : '0'}
        >
          <div className={styles.readinessMetaBlock}>
            <div className={styles.statsSummaryMeta}>
              {summaryText}
            </div>
            <div className={styles.readinessMetaLine}>
              {basedOnText}
            </div>
          </div>

          <button
            type="button"
            className={styles.statsTestButton}
            onClick={onTakeTest}
          >
            {takeTestLabel} <span className={styles.takeTestArrow} aria-hidden="true">▸</span>
          </button>

          <TimeframeChips value={tf} onChange={onTfChange} align="center" />
        </div>
      </div>
    </section>
  );
}
