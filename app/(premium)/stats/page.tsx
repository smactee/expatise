// app/stats/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import BottomNav from '@/components/BottomNav';
import styles from './stats.module.css';
import BackButton from '@/components/BackButton';
import RequirePremium from '@/components/RequirePremium.client';

import { loadDataset } from '@/lib/qbank/loadDataset';
import type { DatasetId } from '@/lib/qbank/datasets';
import type { Question } from '@/lib/qbank/types';

import { listSubmittedAttempts } from '@/lib/test-engine/attemptStorage';
import type { TestAttemptV1 } from '@/lib/test-engine/attemptStorage';

import { useUserKey } from '@/components/useUserKey.client';
import { computeStats } from '@/lib/stats/computeStats';

import { ROUTES } from '@/lib/routes';

import { labelForTag } from '@/lib/qbank/tagTaxonomy';

import ScreenTimeChart7 from '@/components/stats/ScreenTimeChart7.client';

import ReadinessRing from '@/app/(premium)/stats/ReadinessRing.client';
import ScoreChart from '@/components/stats/ScoreChart.client';
import WeeklyProgressChart from '@/components/stats/WeeklyProgressChart';

const datasetId: DatasetId = 'cn-2023-test1';

// Exclude Practice from Stats (per your decision)
type Timeframe = 7 | 30 | "all";
const TIMEFRAMES: Timeframe[] = [7, 30, "all"];

const REAL_ONLY_MODE_KEYS = ["real-test"];
const LEARNING_MODE_KEYS = ["real-test", "half-test", "rapid-fire-test"]; // all non-practice modes

export default function StatsPage() {
  const userKey = useUserKey();
  const router = useRouter();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [attempts, setAttempts] = useState<TestAttemptV1[]>([]);
  const [loading, setLoading] = useState(true);

  const [tfReadiness, setTfReadiness] = useState<Timeframe>(7);
  const [tfScore, setTfScore] = useState<Timeframe>(30);
  const [tfWeekly, setTfWeekly] = useState<Timeframe>(30);
  const [tfBestTime, setTfBestTime] = useState<Timeframe>(30);
  const [tfTopics, setTfTopics] = useState<Timeframe>(30);

function tfShort(t: Timeframe) {
  return t === "all" ? "All" : `${t}D`;
}
function tfLabel(t: Timeframe) {
  return t === "all" ? "all time" : `last ${t} days`;
}

function TimeframeChips(props: {
  value: Timeframe;
  onChange: (v: Timeframe) => void;
  align?: "left" | "center";
}) {
  const { value, onChange, align = "center" } = props;
  return (
    <div
      className={`${styles.statsChips} ${
        align === "center" ? styles.statsChipsCenter : ""
      }`}
    >
      {TIMEFRAMES.map((t) => {
        const active = value === t;
        return (
          <button
            key={String(t)}
            type="button"
            onClick={() => onChange(t)}
            className={`${styles.statsChip} ${
              active ? styles.statsChipActive : ""
            }`}
          >
            {tfShort(t)}
          </button>
        );
      })}
    </div>
  );
}



  // Load dataset questions (needed to grade answers)
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const qs = await loadDataset(datasetId);
        if (alive) setQuestions(qs);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [datasetId]);

  // Load submitted attempts from localStorage whenever userKey changes
  useEffect(() => {
    const submitted = listSubmittedAttempts({ userKey, datasetId });
    setAttempts(submitted);
  }, [userKey, datasetId]);

  // Compute stats (default: last 30 days for now; we’ll add filters later)
  const statsReadiness = useMemo(() => {
  return computeStats({
    attempts,
    questions,
    filters: { timeframeDays: tfReadiness, includeModeKeys: REAL_ONLY_MODE_KEYS },
  });
}, [attempts, questions, tfReadiness]);

const statsScreen = useMemo(() => {
  return computeStats({
    attempts,
    questions,
    filters: { timeframeDays: 7, includeModeKeys: LEARNING_MODE_KEYS },
  });
}, [attempts, questions]);


const statsScore = useMemo(() => {
  return computeStats({
    attempts,
    questions,
    filters: { timeframeDays: tfScore, includeModeKeys: REAL_ONLY_MODE_KEYS },
  });
}, [attempts, questions, tfScore]);

const statsWeekly = useMemo(() => {
  return computeStats({
    attempts,
    questions,
    filters: { timeframeDays: tfWeekly, includeModeKeys: LEARNING_MODE_KEYS },
  });
}, [attempts, questions, tfWeekly]);

const statsBestTime = useMemo(() => {
  return computeStats({
    attempts,
    questions,
    filters: { timeframeDays: tfBestTime, includeModeKeys: REAL_ONLY_MODE_KEYS },
  });
}, [attempts, questions, tfBestTime]);

const statsTopics = useMemo(() => {
  return computeStats({
    attempts,
    questions,
    filters: { timeframeDays: tfTopics, includeModeKeys: LEARNING_MODE_KEYS },
  });
}, [attempts, questions, tfTopics]);







  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <BackButton />


        {/* ==== Top Accuracy / Gauge Card ==== */}
<section className={styles.statsSummaryCard}>
  <div className={styles.statsSummaryInner}>
  <ReadinessRing
    valuePct={statsReadiness.readinessPct}
    enabled={!loading && questions.length > 0}
  />


    {/* ✅ goes right here */}
    <div
  style={{
    fontSize: 12,
    color: "rgba(17,24,39,0.65)",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 1.35,
  }}
>
  <div className={styles.statsSummaryMeta}>
    {tfShort(tfReadiness)} accuracy: {statsReadiness.accuracyPct}% · Tests: {statsReadiness.attemptsCount}
  </div>
  <div>
    Based on {statsReadiness.attemptedTotal} questions answered
  </div>
</div>


    <button
  type="button"
  className={styles.statsTestButton}
  onClick={() => router.push("/test/real")}
>
  Take a Test ▸
</button>
<TimeframeChips value={tfReadiness} onChange={setTfReadiness} align="center" />

  </div>
</section>


{/* ==== Big panel + stack of statistic cards ==== */}
        <section className={styles.statsLongPanel}>
          <div className={styles.statsBlocks}>

{/* Screen Time */}
<article className={styles.statsCard}>
  <header className={styles.statsCardHeader}>
  <h2 className={styles.statsCardTitle}>Screen Time</h2>

  <div className={styles.statsLegend}>
    <span className={`${styles.statsLegendDot} ${styles.statsLegendDotYellow}`} />
    <span className={styles.statsLegendLabel}>Test</span>

    <span className={`${styles.statsLegendDot} ${styles.statsLegendDotBlue}`} />
    <span className={styles.statsLegendLabel}>Study</span>

    <span className={`${styles.statsLegendDot} ${styles.statsLegendDotGray}`} />
    <span className={styles.statsLegendLabel}>Total</span>

    <span className={`${styles.statsLegendDot} ${styles.statsLegendDotDark}`} />
    <span className={styles.statsLegendLabel}>7D avg</span>
  </div>
</header>


  <div className={`${styles.statsGraphArea} ${styles.statsGraphClean}`}>
<div
  className={`${styles.statsGraphPlaceholder} ${styles.statsGraphClean}`}
  style={{ width: "100%" }}
>
      {loading ? (
        "Loading…"
      ) : (
        <ScreenTimeChart7
          data={statsScreen.timeDailySeries}
          height={120}
          timedTestMinutesEstimate={Math.round(statsScreen.timeInTimedTestsSec / 60)}
          streakDays={statsScreen.timeStreakDays}
        />
      )}
    </div>
  </div>
</article>


{/* Score Card */}
            <article className={styles.statsCard}>
              <header className={styles.statsCardHeader}>
  <h2 className={styles.statsCardTitle}>Score</h2>

  <div className={styles.statsLegend}>
    <span className={`${styles.statsLegendDot} ${styles.statsLegendDotBlue}`} />
    <span className={styles.statsLegendLabel}>Score</span>

    <span className={`${styles.statsLegendDot} ${styles.statsLegendDotYellow}`} />
    <span className={styles.statsLegendLabel}>Average</span>
  </div>
</header>


              <div className={`${styles.statsGraphArea} ${styles.statsGraphClean}`}>
  <div className={`${styles.statsGraphPlaceholder} ${styles.statsGraphClean}`} style={{ width: '100%' }}>
    {loading ? (
      'Loading…'
    ) : statsScore.attemptsCount === 0 ? (
      `No submitted tests yet (${tfLabel(tfScore)}).`
    ) : (
      <ScoreChart
        series={statsScore.scoreSeries}
        scoreAvg={statsScore.scoreAvg}
        scoreBest={statsScore.scoreBest}
        scoreLatest={statsScore.scoreLatest}
        attemptsCount={statsScore.attemptsCount}
        attemptedTotal={statsScore.attemptedTotal}
        passLine={90}
        height={150}
      />
    )}
  </div>
</div>

              <TimeframeChips value={tfScore} onChange={setTfScore} />
            </article>

{/* Weekly Progress */}
            <article className={styles.statsCard}>
              <header className={styles.statsCardHeader}>
                <h2 className={styles.statsCardTitle}>Weekly Progress</h2>
              </header>

             <div className={`${styles.statsGraphArea} ${styles.statsGraphClean}`}>
  <div className={`${styles.statsGraphPlaceholder} ${styles.statsGraphClean}`} style={{ width: "100%" }}>

  {loading ? (
    "Loading…"
  ) : statsWeekly.weeklySeries.length === 0 ? (
    "No weekly data yet."
  ) : (
  <WeeklyProgressChart
    series={statsWeekly.weeklySeries}
    bestWeekQuestions={statsWeekly.bestWeekQuestions}
    streakWeeks={statsWeekly.consistencyStreakWeeks}
    rows={6}
  />
)
}
</div>

              </div>
              <TimeframeChips value={tfWeekly} onChange={setTfWeekly} />
            </article>

{/* Best Time */}
            <article className={styles.statsCard}>
              <header className={styles.statsCardHeader}>
                <h2 className={styles.statsCardTitle}>Best Time</h2>
              </header>

              <div className={styles.statsGraphArea}>
                <div className={styles.statsGraphPlaceholder}>
  {loading ? (
    "Loading…"
  ) : statsBestTime.attemptsCount === 0 ? (
    `No submitted tests yet (${tfLabel(tfBestTime)}).`
  ) : !statsBestTime.bestTimeLabel ? (
    "Not enough data yet."
  ) : (
    <>
      <div style={{ marginBottom: 8 }}>
        You perform best: <b>{statsBestTime.bestTimeLabel}</b> (avg{" "}
        <b>{statsBestTime.bestTimeAvgScore}%</b>)
      </div>

      <div style={{ fontSize: 12, opacity: 0.85 }}>
        {statsBestTime.bestTimeSeries.map((b) => (
          <div
            key={b.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              padding: "4px 0",
            }}
          >
            <span>{b.label}</span>
            <span>
              Avg {b.avgScore}% · {b.attemptsCount} tests
            </span>
          </div>
        ))}
      </div>
    </>
  )}
</div>

              </div>
              <TimeframeChips value={tfBestTime} onChange={setTfBestTime} />
            </article>


{/* Topic Mastery */}
<article className={styles.statsCard}>
  <header className={styles.statsCardHeader}>
    <h2 className={styles.statsCardTitle}>Topic Mastery</h2>
  </header>

  <div className={styles.statsGraphArea}>
    <div className={styles.statsGraphPlaceholder}>
      {loading ? (
        "Loading…"
      ) : statsTopics.attemptsCount === 0 ? (
        `No submitted tests yet (${tfLabel(tfTopics)}).`
      ) : statsTopics.weakTopics.length === 0 ? (
        "Not enough data yet (need more answers per topic)."
      ) : (
        <>
          <div style={{ marginBottom: 8 }}>
            Weakest topics (min 10 answered)
          </div>

          <div style={{ fontSize: 12, opacity: 0.85 }}>
            {statsTopics.weakTopics.map((t) => (
              <div
                key={t.tag}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "4px 0",
                }}
              >
                <span>{labelForTag(t.tag)}</span>
                <span>
                  {t.accuracyPct}% · {t.attempted} answered
                </span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
            Practice weak topics test: coming soon
          </div>
        </>
      )}
    </div>
  </div>
  <TimeframeChips value={tfTopics} onChange={setTfTopics} />
</article>

          </div>
        </section>

        {/* Review button at the bottom */}
        <div className={styles.statsReviewWrapper}>
          <button
          type = "button" 
          className={styles.statsReviewButton}
          onClick={() => router.push("/my-mistakes")}
          >
            Review Your Mistakes
            </button>
        </div>

        <BottomNav />

      </div>
    </main>
  );
}