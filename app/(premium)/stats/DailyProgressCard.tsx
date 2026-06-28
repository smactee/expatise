'use client';

import StatsCard from './StatsCard';
import styles from './stats.module.css';
import InfoTip from '@/components/InfoTip.client';
import DailyProgressChart, { DailyProgressLegend } from '@/components/stats/DailyProgressChart';
import TimeframeChips, { type Timeframe } from '@/components/stats/TimeframeChips';
import type { computeStats } from '@/lib/stats/computeStats';

type Stats = ReturnType<typeof computeStats>;

/**
 * Daily Progress card. Pure render — all data/handlers come in as props.
 */
export default function DailyProgressCard(props: {
  title: string;
  tooltip: string;
  loadingLabel: string;
  noDataLabel: string;
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
    noDataLabel,
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
      headerExtra={<DailyProgressLegend animate={legendReady} />}
      graphAreaClassName={styles.statsGraphClean}
      footer={<TimeframeChips value={tf} onChange={onTfChange} />}
    >
      <div
        className={`${styles.statsGraphPlaceholder} ${styles.statsGraphClean}`}
        style={{ width: '100%' }}
      >
        {loading ? (
          loadingLabel
        ) : stats.attemptsCount === 0 ? (
          noDataLabel
        ) : (
          <DailyProgressChart
            series={stats.dailySeries}
            bestDayQuestions={stats.bestDayQuestions}
            streakDays={stats.consistencyStreakDays}
            rows={tf === 'all' ? 30 : tf}
            onLegendReveal={onLegendReveal}
          />
        )}
      </div>
    </StatsCard>
  );
}
