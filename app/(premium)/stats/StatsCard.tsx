'use client';

import type { ReactNode } from 'react';
import styles from './stats.module.css';

/**
 * Presentational wrapper for the repeated stats "card" shell:
 *   article > header (title row + InfoTip + headerExtra) > graph area > footer
 *
 * Pure render only — receives already-resolved strings / elements as props.
 * No state, effects, or data hooks live here.
 */
export default function StatsCard(props: {
  /** Optional extra class appended to the <header> (e.g. statsCardHeaderRow). */
  headerClassName?: string;
  /** Resolved card title string. */
  title: string;
  /** The <InfoTip /> element (or any node) rendered next to the title. */
  infoTip: ReactNode;
  /** Header trailing slot: legend element, action button, etc. Sibling of the title row. */
  headerExtra?: ReactNode;
  /** Extra class appended after styles.statsGraphArea (e.g. statsGraphClean, topicMasteryArea). */
  graphAreaClassName?: string;
  /** Graph-area content. */
  children: ReactNode;
  /** Footer slot (e.g. <TimeframeChips />). */
  footer?: ReactNode;
}) {
  const {
    headerClassName,
    title,
    infoTip,
    headerExtra,
    graphAreaClassName,
    children,
    footer,
  } = props;

  return (
    <article className={styles.statsCard}>
      <header
        className={
          headerClassName
            ? `${styles.statsCardHeader} ${headerClassName}`
            : styles.statsCardHeader
        }
      >
        <div className={styles.statsTitleRow}>
          <h2 className={styles.statsCardTitle}>{title}</h2>
          {infoTip}
        </div>
        {headerExtra}
      </header>

      <div
        className={
          graphAreaClassName
            ? `${styles.statsGraphArea} ${graphAreaClassName}`
            : styles.statsGraphArea
        }
      >
        {children}
      </div>

      {footer}
    </article>
  );
}
