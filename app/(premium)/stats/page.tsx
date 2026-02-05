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

import TimeframeChips, { type Timeframe, tfShort } from '@/components/stats/TimeframeChips';
import ScreenTimeChart7 from '@/components/stats/ScreenTimeChart7.client';

import ReadinessRing from '@/app/(premium)/stats/ReadinessRing.client';
import ScoreChart from '@/components/stats/ScoreChart.client';
import WeeklyProgressChart from '@/components/stats/DailyProgressChart';
import DailyProgressChart from '@/components/stats/DailyProgressChart';
import Heatmap from '@/components/stats/Heatmap.client';
import TopicMasteryChart from '@/components/stats/TopicMasteryChart.client';

import { resetAllLocalData } from '@/lib/stats/resetLocalData';


const datasetId: DatasetId = 'cn-2023-test1';

// Exclude Practice from Stats (per your decision)

const REAL_ONLY_MODE_KEYS = ["real-test"];
const LEARNING_MODE_KEYS = ["real-test", "half-test", "rapid-fire-test"]; // all non-practice modes



// Topic Quiz config saver: builds a config that prioritizes weakest subtopics
function buildWeakSubtopicRankedTags(topicMastery: any) {
  const topics = topicMastery?.topics ?? [];
  const all = topics.flatMap((t: any) => t.subtopics ?? []);

  // de-dupe by tag (keep lowest accuracy if duplicates)
  const byTag = new Map<string, any>();
  for (const s of all) {
    const prev = byTag.get(s.tag);
    const sPct = Number.isFinite(s.accuracyPct) ? s.accuracyPct : 0;
    const pPct = prev && Number.isFinite(prev.accuracyPct) ? prev.accuracyPct : 0;
    if (!prev || sPct < pPct) byTag.set(s.tag, s);
  }

  const arr = Array.from(byTag.values());

  // 0% first, then upward; tie-breaker: fewer attempts first
  arr.sort((a, b) => {
    const ap = Number.isFinite(a.accuracyPct) ? a.accuracyPct : 0;
    const bp = Number.isFinite(b.accuracyPct) ? b.accuracyPct : 0;
    if (ap !== bp) return ap - bp;
    return (a.attempted ?? 0) - (b.attempted ?? 0);
  });

  return arr.map((x) => x.tag);
}

function saveTopicQuizConfig(topicMastery: any) {
  const rankedTags = buildWeakSubtopicRankedTags(topicMastery);

  const cfg = {
    v: 1,
    createdAt: Date.now(),
    rankedTags,          // weakest -> strongest
    questionCount: 20,
    timeLimitSec: 600,   // 10 min
  };

  localStorage.setItem('topicQuiz:v1', JSON.stringify(cfg));
  return cfg;
}




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


function tfLabel(t: Timeframe) {
  return t === "all" ? "all time" : `last ${t} days`;
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
  <div className={styles.pageTopRow}>
    <BackButton />

<button
  type="button"
  className={styles.resetBtnFixed}
  onClick={async () => {
    const typed = window.prompt(
      'This will permanently delete ALL saved data on this device.\n\nType RESET to confirm:'
    );
    if ((typed ?? '').trim().toUpperCase() !== 'RESET') return;

    await resetAllLocalData({ includeCaches: true });

    // reload so every hook/store reads fresh empty storage
    window.location.reload();
  }}
  aria-label="Reset all saved data"
  title="Reset all saved data"
>
  Reset All Stats
</button>
  </div>



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

  <span className={styles.statsLegend__screenTime__totalGradientSwatch} />
  <span className={styles.statsLegendLabel}>Total</span>

  <span className={styles.statsLegend__screenTime__avgDottedSwatch} />
  <span className={`${styles.statsLegendLabel} ${styles.statsLegendLabelAvg}`}>7D avg</span>


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
    <span className={`${styles.statsLegendDot} ${styles.statsScoreChartLegendDotScore}`} />
    <span className={styles.statsLegendLabel}>Score</span>

    <span className={`${styles.statsLegendDot} ${styles.statsScoreChartLegendDotAverage}`} />
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

{/* Daily Progress */}
<article className={styles.statsCard}>
  <header className={styles.statsCardHeader}>
  <h2 className={styles.statsCardTitle}>Daily Progress</h2>

  <div className={styles.statsLegend}>
    <span className={`${styles.statsLegendDot} ${styles.statsLegendDotBlue}`} />
    <span className={styles.statsLegendLabel}>Questions</span>

    <span className={`${styles.statsLegendDot} ${styles.statsLegendDotAvg}`} />
    <span className={styles.statsLegendLabel}>Avg score</span>
  </div>
</header>


  <div className={`${styles.statsGraphArea} ${styles.statsGraphClean}`}>
    <div
      className={`${styles.statsGraphPlaceholder} ${styles.statsGraphClean}`}
      style={{ width: "100%" }}
    >
      {loading ? (
        "Loading…"
      ) : statsWeekly.attemptsCount === 0 ? (
        "No daily data yet."
      ) : (
        <DailyProgressChart
          series={statsWeekly.dailySeries}
          bestDayQuestions={statsWeekly.bestDayQuestions}
          streakDays={statsWeekly.consistencyStreakDays}
          rows={tfWeekly === "all" ? 30 : tfWeekly}
        />
      )}
    </div>
  </div>

  <TimeframeChips value={tfWeekly} onChange={setTfWeekly} />
</article>


{/* Heatmap */}
<article className={styles.statsCard}>
  <header className={styles.statsCardHeader}>
    <h2 className={styles.statsCardTitle}>Heatmap</h2>
  </header>

  <div className={styles.statsGraphArea}>
    {loading ? (
      "Loading…"
    ) : !statsBestTime.Heatmap ? (
      "Not enough data yet."
    ) : (
      <Heatmap data={statsBestTime.Heatmap} />
    )}
  </div>

  <TimeframeChips value={tfBestTime} onChange={setTfBestTime} />
</article>



{/* Topic Mastery */}
<article className={styles.statsCard}>
  <header className={`${styles.statsCardHeader} ${styles.statsCardHeaderRow}`}>
  <h2 className={styles.statsCardTitle}>Topic Mastery</h2>

  <button
    type="button"
    className={styles.quizBtn}
    disabled={
      loading ||
      !statsTopics.topicMastery ||
      buildWeakSubtopicRankedTags(statsTopics.topicMastery).length === 0
    }
    onClick={() => {
  if (!statsTopics.topicMastery) return;

  // ✅ keep it to the “weakest 5” (as you intended)
  const rankedTags = buildWeakSubtopicRankedTags(statsTopics.topicMastery)
    .slice(0, 5)
    .map((t) => String(t ?? "").trim().replace(/^#/, "").toLowerCase())
    .filter(Boolean);

  const cfg = {
    schemaVersion: 1,
    createdAt: Date.now(),
    tags: rankedTags,
  };

  // ✅ canonical key (what AllTestClient expects)
  localStorage.setItem("expatise:topicQuiz:v1", JSON.stringify(cfg));

  // (optional) keep old key for a bit
  localStorage.setItem("topicQuiz:v1", JSON.stringify({ v: 1, createdAt: cfg.createdAt, rankedTags }));

  router.push("/test/topics");
}}

    title="Start a 20-question quiz from your weakest subtopics"
  >
    Topic Quiz
  </button>
</header>


  <div className={`${styles.statsGraphArea} ${styles.topicMasteryArea}`}>
  {loading ? (
    "Loading…"
  ) : !statsTopics.topicMastery || statsTopics.topicMastery.topics.length === 0 ? (
    "Not enough data yet (need more answers per topic)."
  ) : (
    <TopicMasteryChart data={statsTopics.topicMastery} />
  )}
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