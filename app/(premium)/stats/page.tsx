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

const datasetId: DatasetId = 'cn-2023-test1';

// Exclude Practice from Stats (per your decision)
const INCLUDE_MODE_KEYS = ['real-test', 'half-test', 'rapid-fire-test'];

export default function StatsPage() {
  const userKey = useUserKey();
  const router = useRouter();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [attempts, setAttempts] = useState<TestAttemptV1[]>([]);
  const [loading, setLoading] = useState(true);

  const [timeframeDays, setTimeframeDays] = useState<7 | 30 | "all">(30);
const [modeKeys, setModeKeys] = useState<string[]>(INCLUDE_MODE_KEYS);

const timeframeLabel =
  timeframeDays === "all" ? "all time" : `last ${timeframeDays} days`;

const MODE_OPTIONS = [
  { key: "real-test", label: "Real" },
  { key: "half-test", label: "Half" },
  { key: "rapid-fire-test", label: "Rapid" },
] as const;


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
  const stats7 = useMemo(() => {
  return computeStats({
    attempts,
    questions,
    filters: {
      timeframeDays: 7,
      includeModeKeys: INCLUDE_MODE_KEYS,
    },
  });
}, [attempts, questions, modeKeys]);

const stats = useMemo(() => {
  return computeStats({
    attempts,
    questions,
    filters: {
      timeframeDays,
      includeModeKeys: modeKeys,
    },
  });
}, [attempts, questions, timeframeDays, modeKeys]);






  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <BackButton />
<div
  style={{
    display: "flex",
    gap: 10,
    justifyContent: "space-between",
    alignItems: "center",
    margin: "10px 0 14px",
    flexWrap: "wrap",
  }}
>
  {/* Timeframe */}
  <div style={{ display: "flex", gap: 6 }}>
    {([7, 30, "all"] as const).map((t) => {
      const active = timeframeDays === t;
      return (
        <button
          key={String(t)}
          type="button"
          onClick={() => setTimeframeDays(t)}
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid rgba(17,24,39,0.12)",
            background: active ? "rgba(17,24,39,0.08)" : "rgba(255,255,255,0.7)",
            fontSize: 12,
          }}
        >
          {t === "all" ? "All" : `${t}D`}
        </button>
      );
    })}
  </div>

  {/* Modes */}
  <div style={{ display: "flex", gap: 6 }}>
    {MODE_OPTIONS.map((m) => {
      const active = modeKeys.includes(m.key);
      return (
        <button
          key={m.key}
          type="button"
          onClick={() => {
            setModeKeys((prev) => {
              if (prev.includes(m.key)) return prev.filter((x) => x !== m.key);
              return [...prev, m.key];
            });
          }}
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid rgba(17,24,39,0.12)",
            background: active ? "rgba(43,124,175,0.12)" : "rgba(255,255,255,0.7)",
            fontSize: 12,
          }}
        >
          {m.label}
        </button>
      );
    })}
  </div>
</div>

        {/* ==== Top Accuracy / Gauge Card ==== */}
<section className={styles.statsSummaryCard}>
  <div className={styles.statsSummaryInner}>
    <div className={styles.statsGaugeWrapper}>
      {(() => {
  const pct = stats7.readinessPct; // 0..100
  const fillDeg = Math.round((pct / 100) * 360);

  const c1 = "rgba(43, 124, 175, 0.4)";
  const c2 = "rgba(255, 197, 66, 0.4)";

  return (
    <div
      className={styles.statsGaugeCircleOuter}
      style={{
        // Flip the ring so clockwise drawing appears counter-clockwise
        transform: "scaleX(-1)",
        background: `conic-gradient(
          from 0deg,
          ${c1} 0deg,
          ${c2} ${fillDeg}deg,
          #e4e4e4 ${fillDeg}deg,
          #e4e4e4 360deg
        )`,
      }}
    >
      <div
        className={styles.statsGaugeCircleInner}
        style={{
          // Flip inner content back so text is normal
          transform: "scaleX(-1)",
        }}
      >
        <div className={styles.statsGaugeNumber}>{pct}</div>
        <div className={styles.statsGaugeLabel}>
          License Exam
          <br />
          Readiness
        </div>
      </div>
    </div>
  );
})()}

    </div>

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
    7D accuracy: {stats7.accuracyPct}% · Tests: {stats7.attemptsCount}
  </div>
  <div>
    Based on {stats7.attemptedTotal} questions answered
  </div>
</div>


    <button
  type="button"
  className={styles.statsTestButton}
  onClick={() => router.push("/test/real")}
>
  Take a Test ▸
</button>

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
                  <span className={`${styles.statsLegendDot} ${styles.statsLegendDotBlue}`} />
                  <span className={styles.statsLegendLabel}>Global</span>
                  <span className={`${styles.statsLegendDot} ${styles.statsLegendDotYellow}`} />
                  <span className={styles.statsLegendLabel}>You</span>
                </div>
              </header>

              <div className={styles.statsGraphArea}>
                <div className={styles.statsGraphPlaceholder}>
  {loading ? (
    "Loading…"
  ) : (
    <>
      <div style={{ marginBottom: 8 }}>
        This week: <b>{stats7.deliberateThisWeekMin}</b> min test ·{" "}
        <b>{stats7.studyThisWeekMin}</b> min study
        <br />
        Best day: <b>{stats7.timeBestDayMin}</b> min · Streak:{" "}
        <b>{stats7.timeStreakDays}</b> days
      </div>

      <div style={{ fontSize: 12, opacity: 0.85 }}>
        {stats7.timeDailySeries.map((d) => (
          <div
            key={d.dayStart}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              padding: "4px 0",
            }}
          >
            <span>
              {new Date(d.dayStart).toLocaleDateString(undefined, { weekday: "short" })}
            </span>
            <span>
              {d.deliberateMin}m · {d.studyMin}m
            </span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
        (Attempt-based timed-test estimate: {Math.round(stats7.timeInTimedTestsSec / 60)} min)
      </div>
    </>
  )}
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
                  {loading ? (
                    'Loading…'
                  ) : stats.attemptsCount === 0 ? (
                    `No submitted tests yet (${timeframeLabel}).`
                  ) : (
                    <>
                      Avg: {stats.scoreAvg}% · Best: {stats.scoreBest}% · Latest: {stats.scoreLatest}%
                      <br />
                      Based on {stats.attemptedTotal} answered questions across {stats.attemptsCount} tests
                    </>
                  )}
                </div>
              </div>
            </article>

            {/* Weekly Progress */}
            <article className={styles.statsCard}>
              <header className={styles.statsCardHeader}>
                <h2 className={styles.statsCardTitle}>Weekly Progress</h2>
                <div className={styles.statsLegend}>
                  <span className={`${styles.statsLegendDot} ${styles.statsLegendDotBlue}`} />
                  <span className={styles.statsLegendLabel}>Global</span>
                  <span className={`${styles.statsLegendDot} ${styles.statsLegendDotYellow}`} />
                  <span className={styles.statsLegendLabel}>You</span>
                </div>
              </header>

              <div className={styles.statsGraphArea}>
                <div className={styles.statsGraphPlaceholder}>
  {loading ? (
    "Loading…"
  ) : stats.weeklySeries.length === 0 ? (
    "No weekly data yet."
  ) : (
    <>
      <div style={{ marginBottom: 8 }}>
        Best week: <b>{stats.bestWeekQuestions}</b> questions
        <br />
        Consistency streak: <b>{stats.consistencyStreakWeeks}</b> weeks
      </div>

      <div style={{ fontSize: 12, opacity: 0.85 }}>
        {/* Show last 6 weeks (most recent at bottom) */}
        {stats.weeklySeries.slice(-6).map((w) => {
          const label = new Date(w.weekStart).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          });

          return (
            <div
              key={w.weekStart}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                padding: "4px 0",
              }}
            >
              <span>Week of {label}</span>
              <span>
                {w.questionsAnswered} answered · {w.testsCompleted} tests · Avg{" "}
                {w.avgScore}%
              </span>
            </div>
          );
        })}
      </div>
    </>
  )}
</div>

              </div>
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
  ) : stats.attemptsCount === 0 ? (
    `No submitted tests yet (${timeframeLabel}).`
  ) : !stats.bestTimeLabel ? (
    "Not enough data yet."
  ) : (
    <>
      <div style={{ marginBottom: 8 }}>
        You perform best: <b>{stats.bestTimeLabel}</b> (avg{" "}
        <b>{stats.bestTimeAvgScore}%</b>)
      </div>

      <div style={{ fontSize: 12, opacity: 0.85 }}>
        {stats.bestTimeSeries.map((b) => (
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
      ) : stats.attemptsCount === 0 ? (
        `No submitted tests yet (${timeframeLabel}).`
      ) : stats.weakTopics.length === 0 ? (
        "Not enough data yet (need more answers per topic)."
      ) : (
        <>
          <div style={{ marginBottom: 8 }}>
            Weakest topics (min 10 answered)
          </div>

          <div style={{ fontSize: 12, opacity: 0.85 }}>
            {stats.weakTopics.map((t) => (
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