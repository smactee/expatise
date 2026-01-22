// app/stats/page.tsx
'use client';

import BottomNav from '@/components/BottomNav';
import styles from './stats.module.css'; // reuse shared layout + new stats classes
import BackButton from '@/components/BackButton';
import RequirePremium from '@/components/RequirePremium.client';

export default function StatsPage() {
  return (
    <main className={styles.page}>
      <div className={styles.content}>
        {/* ==== Top Accuracy / Gauge Card ==== */}
        <section className={styles.statsSummaryCard}>
          <div className={styles.statsSummaryInner}>
            <div className={styles.statsGaugeWrapper}>
              <div className={styles.statsGaugeCircleOuter}>
                <div className={styles.statsGaugeCircleInner}>
                  <div className={styles.statsGaugeNumber}>70</div>
                  <div className={styles.statsGaugeLabel}>
                    Accuracy
                    <br />
                    Rate
                  </div>
                </div>
              </div>
            </div>

            <button className={styles.statsTestButton}>Test ▸</button>
          </div>
        </section>

        {/* ==== Stack of statistic cards ==== */}
       {/* ==== Big panel + stack of statistic cards ==== */}
<section className={styles.statsLongPanel}>
  <div className={styles.statsBlocks}>
    {/* Screen Time */}
    <article className={styles.statsCard}>
      <header className={styles.statsCardHeader}>
        <h2 className={styles.statsCardTitle}>Screen Time</h2>
        <div className={styles.statsLegend}>
          <span
            className={`${styles.statsLegendDot} ${styles.statsLegendDotBlue}`}
          />
          <span className={styles.statsLegendLabel}>Global</span>
          <span
            className={`${styles.statsLegendDot} ${styles.statsLegendDotYellow}`}
          />
          <span className={styles.statsLegendLabel}>You</span>
        </div>
      </header>

      <div className={styles.statsGraphArea}>
        <div className={styles.statsGraphPlaceholder}>
          Screen time chart coming soon
        </div>
      </div>
    </article>

    {/* Score */}
    <article className={styles.statsCard}>
      <header className={styles.statsCardHeader}>
        <h2 className={styles.statsCardTitle}>Score</h2>
      </header>

      <div className={styles.statsGraphArea}>
        <div className={styles.statsGraphPlaceholder}>
          Score chart coming soon
        </div>
      </div>
    </article>

    {/* Weekly Progress */}
    <article className={styles.statsCard}>
      <header className={styles.statsCardHeader}>
        <h2 className={styles.statsCardTitle}>Weekly Progress</h2>
        <div className={styles.statsLegend}>
          <span
            className={`${styles.statsLegendDot} ${styles.statsLegendDotBlue}`}
          />
          <span className={styles.statsLegendLabel}>Global</span>
          <span
            className={`${styles.statsLegendDot} ${styles.statsLegendDotYellow}`}
          />
          <span className={styles.statsLegendLabel}>You</span>
        </div>
      </header>

      <div className={styles.statsGraphArea}>
        <div className={styles.statsGraphPlaceholder}>
          Weekly progress chart coming soon
        </div>
      </div>
    </article>

    {/* Best Time */}
    <article className={styles.statsCard}>
      <header className={styles.statsCardHeader}>
        <h2 className={styles.statsCardTitle}>Best Time</h2>
        <div className={styles.statsLegend}>
          <span
            className={`${styles.statsLegendDot} ${styles.statsLegendDotBlue}`}
          />
          <span className={styles.statsLegendLabel}>Global</span>
          <span
            className={`${styles.statsLegendDot} ${styles.statsLegendDotYellow}`}
          />
          <span className={styles.statsLegendLabel}>You</span>
        </div>
      </header>

      <div className={styles.statsGraphArea}>
        <div className={styles.statsGraphPlaceholder}>
          Best time chart coming soon
        </div>
      </div>
    </article>
  </div>
</section>


        {/* Review button at the bottom */}
        <div className={styles.statsReviewWrapper}>
          <button className={styles.statsReviewButton}>
            Review Your Mistakes
          </button>
        </div>

        <BottomNav />
      </div>
    </main>
  );
}
