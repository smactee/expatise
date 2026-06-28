'use client';

import StatsCard from './StatsCard';
import InfoTip from '@/components/InfoTip.client';
import Heatmap from '@/components/stats/Heatmap.client';
import TimeframeChips, { type Timeframe } from '@/components/stats/TimeframeChips';
import type { computeStats } from '@/lib/stats/computeStats';

type Stats = ReturnType<typeof computeStats>;

/**
 * Heatmap card. Pure render — all data/handlers come in as props.
 */
export default function HeatmapCard(props: {
  title: string;
  tooltip: string;
  loadingLabel: string;
  notEnoughDataLabel: string;
  loading: boolean;
  stats: Stats;
  tf: Timeframe;
  onTfChange: (tf: Timeframe) => void;
}) {
  const {
    title,
    tooltip,
    loadingLabel,
    notEnoughDataLabel,
    loading,
    stats,
    tf,
    onTfChange,
  } = props;

  return (
    <StatsCard
      title={title}
      infoTip={<InfoTip text={tooltip} />}
      footer={<TimeframeChips value={tf} onChange={onTfChange} />}
    >
      {loading ? (
        loadingLabel
      ) : !stats.Heatmap ? (
        notEnoughDataLabel
      ) : (
        <Heatmap data={stats.Heatmap} />
      )}
    </StatsCard>
  );
}
