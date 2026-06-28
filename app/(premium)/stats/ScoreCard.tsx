'use client';

import StatsCard from './StatsCard';
import styles from './stats.module.css';
import InfoTip from '@/components/InfoTip.client';
import ScoreChart, { ScoreLegend } from '@/components/stats/ScoreChart.client';
import TimeframeChips, { type Timeframe } from '@/components/stats/TimeframeChips';
import type { computeStats } from '@/lib/stats/computeStats';

type Stats = ReturnType<typeof computeStats>;

/**
 * Score card. Pure render — all data/handlers come in as props.
 */
export default function ScoreCard(props: {
  title: string;
  tooltip: string;
  loadingLabel: string;
  noTestsLabel: string;
  loading: boolean;
  legendReady: boolean;
  stats: Stats;
  tf: Timeframe;
  onTfChange: (tf: Timeframe) => void;
  onLegendReveal: () => void;
}) {
  const {
    title,
    tooltip,
    loadingLabel,
    noTestsLabel,
    loading,
    legendReady,
    stats,
    tf,
    onTfChange,
    onLegendReveal,
  } = props;

  return (
    <StatsCard
      title={title}
      infoTip={<InfoTip text={tooltip} />}
      headerExtra={<ScoreLegend animate={legendReady} />}
      graphAreaClassName={styles.statsGraphClean}
      footer={<TimeframeChips value={tf} onChange={onTfChange} />}
    >
      <div className={`${styles.statsGraphPlaceholder} ${styles.statsGraphClean}`} style={{ width: '100%' }}>
        {loading ? (
          loadingLabel
        ) : stats.attemptsCount === 0 ? (
          noTestsLabel
        ) : (
          <ScoreChart
            series={stats.scoreSeries}
            scoreAvg={stats.scoreAvg}
            scoreBest={stats.scoreBest}
            scoreLatest={stats.scoreLatest}
            attemptsCount={stats.attemptsCount}
            attemptedTotal={stats.attemptedTotal}
            passLine={90}
            height={150}
            onLegendReveal={onLegendReveal}
          />
        )}
      </div>
    </StatsCard>
  );
}
