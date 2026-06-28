'use client';

import StatsCard from './StatsCard';
import styles from './stats.module.css';
import InfoTip from '@/components/InfoTip.client';
import TopicMasteryChart from '@/components/stats/TopicMasteryChart.client';
import TimeframeChips, { type Timeframe } from '@/components/stats/TimeframeChips';
import type { computeStats } from '@/lib/stats/computeStats';

type Stats = ReturnType<typeof computeStats>;

/**
 * Topic Mastery card. Pure render — all data/handlers come in as props.
 * The quiz-button click handler and disabled gating are computed in page.tsx.
 */
export default function TopicMasteryCard(props: {
  title: string;
  tooltip: string;
  loadingLabel: string;
  noDataLabel: string;
  quizTitle: string;
  quizButtonLabel: string;
  loading: boolean;
  quizDisabled: boolean;
  onQuizClick: () => void;
  stats: Stats;
  tf: Timeframe;
  onTfChange: (tf: Timeframe) => void;
}) {
  const {
    title,
    tooltip,
    loadingLabel,
    noDataLabel,
    quizTitle,
    quizButtonLabel,
    loading,
    quizDisabled,
    onQuizClick,
    stats,
    tf,
    onTfChange,
  } = props;

  return (
    <StatsCard
      headerClassName={styles.statsCardHeaderRow}
      title={title}
      infoTip={<InfoTip text={tooltip} />}
      headerExtra={
        <button
          type="button"
          className={styles.quizBtn}
          disabled={quizDisabled}
          onClick={onQuizClick}
          title={quizTitle}
        >
          {quizButtonLabel}
        </button>
      }
      graphAreaClassName={styles.topicMasteryArea}
      footer={<TimeframeChips value={tf} onChange={onTfChange} />}
    >
      {loading ? (
        loadingLabel
      ) : !stats.topicMastery || stats.topicMastery.topics.length === 0 ? (
        noDataLabel
      ) : (
        <TopicMasteryChart data={stats.topicMastery} />
      )}
    </StatsCard>
  );
}
