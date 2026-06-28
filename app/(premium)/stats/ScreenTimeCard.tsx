'use client';

import StatsCard from './StatsCard';
import styles from './stats.module.css';
import InfoTip from '@/components/InfoTip.client';
import ScreenTimeChart, { ScreenTimeLegend } from '@/components/stats/ScreenTimeChart.client';

/**
 * Screen Time card. Pure render — all data/handlers come in as props.
 */
export default function ScreenTimeCard(props: {
  title: string;
  tooltip: string;
  loadingLabel: string;
  loading: boolean;
  legendReady: boolean;
  series: React.ComponentProps<typeof ScreenTimeChart>['data'];
  timedTestMinutesEstimate: number;
  streakDays: number;
  onLegendReveal: () => void;
}) {
  const {
    title,
    tooltip,
    loadingLabel,
    loading,
    legendReady,
    series,
    timedTestMinutesEstimate,
    streakDays,
    onLegendReveal,
  } = props;

  return (
    <StatsCard
      title={title}
      infoTip={<InfoTip text={tooltip} />}
      headerExtra={<ScreenTimeLegend animate={legendReady} />}
      graphAreaClassName={styles.statsGraphClean}
    >
      <div
        className={`${styles.statsGraphPlaceholder} ${styles.statsGraphClean}`}
        style={{ width: '100%' }}
      >
        {loading ? (
          loadingLabel
        ) : (
          <ScreenTimeChart
            data={series}
            height={120}
            timedTestMinutesEstimate={timedTestMinutesEstimate}
            streakDays={streakDays}
            onLegendReveal={onLegendReveal}
          />
        )}
      </div>
    </StatsCard>
  );
}
