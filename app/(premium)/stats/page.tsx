// app/stats/page.tsx
'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
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
import ScreenTimeChart, {ScreenTimeLegend} from '@/components/stats/ScreenTimeChart.client';

import ReadinessRing from '@/app/(premium)/stats/ReadinessRing.client';
import ScoreChart, { ScoreLegend } from '@/components/stats/ScoreChart.client';
import DailyProgressChart, { DailyProgressLegend } from '@/components/stats/DailyProgressChart';
import Heatmap from '@/components/stats/Heatmap.client';
import TopicMasteryChart from '@/components/stats/TopicMasteryChart.client';

import { resetAllLocalData } from '@/lib/stats/resetLocalData';

import { timeKey } from "@/lib/stats/timeKeys"

import { seedAdminDemoDataIfNeeded } from '@/lib/demo/seedAdminDemoData';

import InfoTip from '@/components/InfoTip.client';

import CoachReport from '@/app/(premium)/stats/CoachReport.client';
import CoachReportRich from '@/app/(premium)/stats/CoachReportRich.client';


const datasetId: DatasetId = 'cn-2023-test1';

// Exclude Practice from Stats (per your decision)

const REAL_ONLY_MODE_KEYS = ["real-test"];
const LEARNING_MODE_KEYS = ["real-test", "ten-percent-test", "half-test", "rapid-fire-test"]; // all non-practice modes


const MODE_LABEL: Record<string, string> = {
  "real-test": "Real Test",
  "half-test": "Half Test",
  "rapid-fire-test": "Rapid Fire",
  "ten-percent-test": "10% Test",
};

function modesLabel(keys: string[]) {
  return keys.map((k) => MODE_LABEL[k] ?? k).join(", ");
}

function tfLabelShort(t: Timeframe) {
  return t === "all" ? "all time" : `last ${t} days`;
}

function statsTooltip(keys: string[], t: Timeframe) {
  return `Includes: ${modesLabel(keys)} · ${tfLabelShort(t)}`;
}


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


function startOfDayKey(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatStamp(ms: number) {
  try {
    const d = new Date(ms);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function formatRemaining(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}


export default function StatsPage() {
  const userKey = useUserKey();
  const router = useRouter();

  const seededRef = useRef<string | null>(null);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [attempts, setAttempts] = useState<TestAttemptV1[]>([]);
  const [loading, setLoading] = useState(true);

  const [tfReadiness, setTfReadiness] = useState<Timeframe>(7);
  const [tfScore, setTfScore] = useState<Timeframe>(30);
  const [tfWeekly, setTfWeekly] = useState<Timeframe>(30);
  const [tfBestTime, setTfBestTime] = useState<Timeframe>(30);
  const [tfTopics, setTfTopics] = useState<Timeframe>(30);
  const [attemptsLoaded, setAttemptsLoaded] = useState(false);


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

 // Load attempts: local first (instant) + remote (cross-device) then merge
useEffect(() => {
  // 0) Wait until userKey is ready (prevents double-seed / double-load)
  if (!userKey) return;

  // 0.5) Ensure this entire effect only runs once per (userKey, datasetId) per mount
  const runKey = `${userKey}:${datasetId}`;
  if (seededRef.current === runKey) return;
  seededRef.current = runKey;

  let alive = true;

  (async () => {
    // ✅ seed demo data (admin only) BEFORE reading attempts
    await seedAdminDemoDataIfNeeded(userKey);

    // 1) Local (fast, works offline)
    const local = listSubmittedAttempts({ userKey, datasetId });
    if (!alive) return;
    setAttempts(local);
    setAttemptsLoaded(true);
    // 2) Remote (cross-device). If user isn't logged in, this will just fail quietly.
    try {
      const r = await fetch(
        `/api/attempts?datasetId=${encodeURIComponent(datasetId)}`,
        { cache: "no-store", credentials: "include" }
      );
      if (!r.ok) return;

      const j = await r.json().catch(() => null);
      const remote: TestAttemptV1[] = Array.isArray(j?.attempts) ? j.attempts : [];

      // Merge by attemptId (remote wins if duplicate)
      const byId = new Map<string, TestAttemptV1>();
      for (const a of local) byId.set(a.attemptId, a);
      for (const a of remote) byId.set(a.attemptId, a);

      const merged = Array.from(byId.values()).sort(
        (a, b) =>
          (b.submittedAt ?? b.lastActiveAt ?? b.createdAt ?? 0) -
          (a.submittedAt ?? a.lastActiveAt ?? a.createdAt ?? 0)
      );

      if (!alive) return;
      setAttempts(merged);
    } catch {
      // ignore
    }
  })();

  return () => {
    alive = false;
  };
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

// ✅ Coach fixed windows (SPEC): Skill 30d (real-test) + Habits 7d (learning modes)
const coachSkill = useMemo(() => {
  return computeStats({
    attempts,
    questions,
    filters: { timeframeDays: 30, includeModeKeys: REAL_ONLY_MODE_KEYS },
  });
}, [attempts, questions]);

const coachHabits = useMemo(() => {
  return computeStats({
    attempts,
    questions,
    filters: { timeframeDays: 7, includeModeKeys: LEARNING_MODE_KEYS },
  });
}, [attempts, questions]);



const [readinessDone, setReadinessDone] = useState(false);

const handleReadinessRingDone = () => {
  setReadinessDone(true);
};

// Reset whenever the ring should re-run (timeframe/data changes)
useEffect(() => {
  setReadinessDone(false);
}, [tfReadiness, statsReadiness.readinessPct, loading, questions.length, attemptsLoaded]);


const [screenLegendReady, setScreenLegendReady] = useState(false);

useEffect(() => {
  // reset whenever data/loading changes so it re-reveals correctly
  setScreenLegendReady(false);
}, [loading, attempts.length, questions.length, userKey]);

const [scoreLegendReady, setScoreLegendReady] = useState(false);

useEffect(() => {
  setScoreLegendReady(false);
}, [loading, tfScore, statsScore.attemptsCount, userKey]);

const [dailyLegendReady, setDailyLegendReady] = useState(false);

useEffect(() => {
  setDailyLegendReady(false);
}, [loading, tfWeekly, statsWeekly.attemptsCount, userKey]);


// ======================================================
// GPT COACH: gating + cooldown + saved report (no tokens)
// ======================================================
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

const coachPrefix = userKey ? `expatise:${userKey}` : `expatise:anon`;
const LS_REPORT = `${coachPrefix}:coach:lastReport:v2`;
const LS_COOLDOWN_UNTIL = `${coachPrefix}:coach:cooldownUntil:v2`;


const [coachReport, setCoachReport] = useState<string>("");
const [coachCreatedAt, setCoachCreatedAt] = useState<number | null>(null);
const [coachLoading, setCoachLoading] = useState(false);
const [coachError, setCoachError] = useState<string | null>(null);
const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);

const [nowMs, setNowMs] = useState<number>(Date.now());
useEffect(() => {
  const id = window.setInterval(() => setNowMs(Date.now()), 1000);
  return () => window.clearInterval(id);
}, []);

// Load saved report + cooldown when userKey changes
useEffect(() => {
  try {
    const raw = localStorage.getItem(LS_REPORT);
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj?.report) {
        setCoachReport(String(obj.report));
        const t = Number(obj.createdAt);
        setCoachCreatedAt(Number.isFinite(t) ? t : null);
      }
    }
    const cRaw = localStorage.getItem(LS_COOLDOWN_UNTIL);
    const c = Number(cRaw);
    setCooldownUntil(Number.isFinite(c) && c > 0 ? c : null);
  } catch {
    // ignore
  }
}, [LS_REPORT, LS_COOLDOWN_UNTIL]);

useEffect(() => {
  let alive = true;

  (async () => {
    try {
      const r = await fetch("/api/time-logs?limit=200", {
  cache: "no-store" as any,
  credentials: "include",
});

      const j = await r.json().catch(() => null);
      if (!alive || !r.ok || !j?.ok) return;

      for (const it of (j.logs ?? [])) {
        const kind = it?.kind;
        const date = String(it?.date ?? "");
        const seconds = Number(it?.seconds ?? 0);

        if ((kind !== "test" && kind !== "study") || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
        if (!Number.isFinite(seconds) || seconds < 0) continue;

        const k = timeKey(kind, date);
        const prev = Number(localStorage.getItem(k) ?? "0");
        const next = Math.max(Number.isFinite(prev) ? prev : 0, Math.floor(seconds));
        localStorage.setItem(k, String(next));
      }

      // force re-render so your useMemo computeStats re-runs
      setAttempts((prev) => prev.slice());
    } catch {
      // ignore
    }
  })();

  return () => {
    alive = false;
  };
}, [userKey]);


const scorePointsSorted = useMemo(() => {
  const arr = [...(coachSkill.scoreSeries ?? [])];
  arr.sort((a, b) => a.t - b.t);
  return arr;
}, [coachSkill.scoreSeries]);

const maxAnsweredInAnyRealTest = useMemo(() => {
  return scorePointsSorted.reduce((m, p) => Math.max(m, p.answered ?? 0), 0);
}, [scorePointsSorted]);

const minimumMet = useMemo(() => {
  return (
    (coachSkill.attemptsCount >= 1 && maxAnsweredInAnyRealTest >= 80) ||
    coachSkill.attemptedTotal >= 120
  );
}, [coachSkill.attemptsCount, coachSkill.attemptedTotal, maxAnsweredInAnyRealTest]);

const distinctRealTestDays30d = useMemo(() => {
  const s = new Set<number>();
  for (const p of scorePointsSorted) s.add(startOfDayKey(p.t));
  return s.size;
}, [scorePointsSorted]);

const bestResultsMet = useMemo(() => {
  return coachSkill.attemptsCount >= 3 && distinctRealTestDays30d >= 3;
}, [coachSkill.attemptsCount, distinctRealTestDays30d]);

const cooldownActive = !!(cooldownUntil && nowMs < cooldownUntil);
const remainingMs = cooldownUntil ? Math.max(0, cooldownUntil - nowMs) : 0;

const habitsActiveDays = useMemo(() => {
  return (coachHabits.timeDailySeries ?? []).filter((d) => (d.totalMin ?? 0) > 0).length;
}, [coachHabits.timeDailySeries]);

async function handleGenerateCoach() {
  if (coachLoading) return;

  setCoachError(null);

  // Client-side gate (server also enforces)
  if (!minimumMet) return;

  // UI cooldown gate (server also enforces via cookie)
  if (cooldownActive) return;

  setCoachLoading(true);
  try {
    const weakest = (coachSkill.topicMastery?.weakestSubtopics ?? [])
      .slice(0, 5)
      .map((s: any) => ({
        tagLabel: labelForTag(s.tag) ?? String(s.tag),
        attempted: Number(s.attempted ?? 0),
        accuracyPct: Number(s.accuracyPct ?? 0),
      }));

    const payload = {
      coachContractVersion: "v1.0",
      skillWindowLabel: "30d",
      habitWindowLabel: "7d",
      skill: {
        attemptsCount: coachSkill.attemptsCount,
        attemptedTotal: coachSkill.attemptedTotal,
        accuracyPct: coachSkill.accuracyPct,
        readinessPct: coachSkill.readinessPct,
        scoreAvg: coachSkill.scoreAvg,
        scoreBest: coachSkill.scoreBest,
        scoreLatest: coachSkill.scoreLatest,
        // keep input smaller/cheaper
        scorePoints: scorePointsSorted.slice(-12).map((p) => ({
          t: p.t,
          scorePct: p.scorePct,
          answered: p.answered,
          totalQ: p.totalQ,
        })),
        minTopicAttempted: coachSkill.topicMastery?.minAttempted ?? 10,
        weakestSubtopics: weakest,
      },
      habits: {
        timeThisWeekMin: coachHabits.timeThisWeekMin,
        timeBestDayMin: coachHabits.timeBestDayMin,
        timeStreakDays: coachHabits.timeStreakDays,
        activeDays: habitsActiveDays,
        requiredDays: 4,
      },
    };

    const r = await fetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const j = await r.json().catch(() => null);

    if (!r.ok) {
      if (r.status === 429 && j?.nextAllowedAt) {
        const until = Number(j.nextAllowedAt);
        if (Number.isFinite(until) && until > 0) {
          setCooldownUntil(until);
          try {
            localStorage.setItem(LS_COOLDOWN_UNTIL, String(until));
          } catch {}
        }
        setCoachError(`Next Coach report available in ${formatRemaining(Math.max(0, until - Date.now()))}.`);
        return;
      }

      if (r.status === 400 && j?.error === "insufficient_data") {
        setCoachError("Not enough data yet for personalized coaching. Complete 1 Real Test (80+ answers) or reach 120 answered total.");
        return;
      }

      setCoachError(j?.detail ? String(j.detail) : "Coach request failed. Please try again.");
      return;
    }

    const report = String(j?.report ?? "").trim();
    const createdAt = Number(j?.createdAt ?? Date.now());

    if (!report) {
      setCoachError("Coach returned an empty report. Please try again.");
      return;
    }

    setCoachReport(report);
    setCoachCreatedAt(Number.isFinite(createdAt) ? createdAt : Date.now());

    // Save report locally
    try {
      localStorage.setItem(LS_REPORT, JSON.stringify({ report, createdAt }));
    } catch {}

    // Local UI cooldown (server also enforces via cookie)
    const until = (Number.isFinite(createdAt) ? createdAt : Date.now()) + COOLDOWN_MS;
    setCooldownUntil(until);
    try {
      localStorage.setItem(LS_COOLDOWN_UNTIL, String(until));
    } catch {}
  } finally {
    setCoachLoading(false);
  }
}

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
    <div className={styles.readinessTitleRow}>
      <span className={styles.statsTitleRow}>
      </span>
    </div>

    <ReadinessRing
      valuePct={statsReadiness.readinessPct}
      enabled={!loading && questions.length > 0 && attemptsLoaded}
      onDone={handleReadinessRingDone}
    />

    {/* 👇 Everything below stays hidden until the ring finishes */}
    <div
      className={styles.readinessReveal}
      data-show={readinessDone ? '1' : '0'}
    >
      <div className={styles.readinessMetaBlock}>
        <div className={styles.statsSummaryMeta}>
          {tfShort(tfReadiness)} accuracy: {statsReadiness.accuracyPct}% · Tests:{' '}
          {statsReadiness.attemptsCount}
        </div>
        <div className={styles.readinessMetaLine}>
          Based on {statsReadiness.attemptedTotal} questions answered
        </div>
      </div>

      <button
        type="button"
        className={styles.statsTestButton}
        onClick={() => router.push('/test/real')}
      >
        Take a Test ▸
      </button>

      <TimeframeChips value={tfReadiness} onChange={setTfReadiness} align="center" />
    </div>
  </div>
</section>



{/* ==== Big panel + stack of statistic cards ==== */}
        <section className={styles.statsLongPanel}>
          <div className={styles.statsBlocks}>



{/* Screen Time */}
<article className={styles.statsCard}>
  <header className={styles.statsCardHeader}>
  <div className={styles.statsTitleRow}>
    <h2 className={styles.statsCardTitle}>Screen Time</h2>
    <InfoTip text={`Includes: ${modesLabel(LEARNING_MODE_KEYS)} · last 7 days`} />
  </div>
  <ScreenTimeLegend animate={screenLegendReady} />


</header>


  <div className={`${styles.statsGraphArea} ${styles.statsGraphClean}`}>
<div
  className={`${styles.statsGraphPlaceholder} ${styles.statsGraphClean}`}
  style={{ width: "100%" }}
>
      {loading ? (
        "Loading…"
      ) : (
        <ScreenTimeChart
  data={statsScreen.timeDailySeries}
  height={120}
  timedTestMinutesEstimate={Math.round(statsScreen.timeInTimedTestsSec / 60)}
  streakDays={statsScreen.timeStreakDays}
  onLegendReveal={() => setScreenLegendReady(true)}
/>

      )}
    </div>
  </div>
</article>


{/* Score Card */}
            <article className={styles.statsCard}>
             <header className={styles.statsCardHeader}>
  <div className={styles.statsTitleRow}>
    <h2 className={styles.statsCardTitle}>Score</h2>
    <InfoTip text={statsTooltip(REAL_ONLY_MODE_KEYS, tfScore)} />
  </div>

  <ScoreLegend animate={scoreLegendReady} />
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
        onLegendReveal={() => setScoreLegendReady(true)}
      />
    )}
  </div>
</div>
<TimeframeChips value={tfScore} onChange={setTfScore} />
</article>

{/* Daily Progress */}
<article className={styles.statsCard}>
  <header className={styles.statsCardHeader}>
  <div className={styles.statsTitleRow}>
    <h2 className={styles.statsCardTitle}>Daily Progress</h2>
    <InfoTip text={statsTooltip(LEARNING_MODE_KEYS, tfWeekly)} />
  </div>
  <DailyProgressLegend animate={dailyLegendReady} />
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
          onLegendReveal={() => setDailyLegendReady(true)}
        />
      )}
    </div>
  </div>

  <TimeframeChips value={tfWeekly} onChange={setTfWeekly} />
</article>


{/* Heatmap */}
<article className={styles.statsCard}>
  <header className={styles.statsCardHeader}>
  <div className={styles.statsTitleRow}>
    <h2 className={styles.statsCardTitle}>Heatmap</h2>
    <InfoTip text={statsTooltip(REAL_ONLY_MODE_KEYS, tfBestTime)} />
  </div>
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
  <div className={styles.statsTitleRow}>
    <h2 className={styles.statsCardTitle}>Topic Mastery</h2>
    <InfoTip text={statsTooltip(LEARNING_MODE_KEYS, tfTopics)} />
  </div>

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

{/* GPT Coach */}
<article className={styles.statsCard}>
  <header className={styles.statsCardHeader}>
    <h2 className={styles.statsCardTitle}>GPT Coach</h2>
  </header>

  {loading ? (
    <p className={styles.coachSubtle}>Loading…</p>
  ) : !minimumMet ? (
    <>
      <p className={styles.coachSubtle}><strong>AI Coach needs a bit more data.</strong></p>
      <p className={styles.coachHint}>
        To generate a personalized report, complete either:<br />
        • <strong>1 Real Test</strong> with <strong>80+ answers</strong>, or<br />
        • <strong>120 total questions answered</strong> (practice + tests)
      </p>
      <p className={styles.coachHint}>More answers = less randomness → better advice.</p>

      <div className={styles.coachRow}>
        <button
          type="button"
          className={styles.coachBtnPrimary}
          onClick={() => router.push("/test/real")}
        >
          Take a Real Test
        </button>
        <button
          type="button"
          className={styles.coachBtnSecondary}
          onClick={() => router.push("/test/real")}
        >
          Start Now
        </button>
      </div>
    </>
  ) : (
    <>
      {!bestResultsMet ? (
        <>
          <p className={styles.coachSubtle}>
            <strong>You’re ready for a first Coach report</strong> — here’s how to make it “laser-accurate”.
          </p>
          <p className={styles.coachHint}>
            For the most tailored advice (topics + habits + patterns), aim for:<br />
            ✅ <strong>3 Real Tests (300 questions)</strong> across <strong>3+ days</strong>
          </p>
          <p className={styles.coachHint}>
            Next steps:<br />
            • Do <strong>2 more Real Tests</strong> on separate days<br />
            • Try the <strong>2-pass rule</strong> (answer easy first, then return)<br />
            • Keep a <strong>10-minute minimum</strong> on non-test days
          </p>
        </>
      ) : (
        <p className={styles.coachSubtle}>
          <strong>Coach runs on demand</strong> (Skill: 30d · Habits: 7d). Tap to generate your latest plan.
        </p>
      )}

      <div className={styles.coachRow}>
        <button
          type="button"
          className={styles.coachBtnPrimary}
          onClick={handleGenerateCoach}
          disabled={coachLoading || cooldownActive}
          title={cooldownActive ? `Next available in ${formatRemaining(remainingMs)}` : "Generate Coach Report"}
        >
          {coachLoading ? "Generating…" : cooldownActive ? "Coach Locked" : "Generate Coach Report"}
        </button>

        <button
          type="button"
          className={styles.coachBtnSecondary}
          onClick={() => router.push("/test/real")}
        >
          Take a Test
        </button>
      </div>

      <div className={styles.coachMeta}>
        {cooldownActive ? (
          <>Next Coach report available in <strong>{formatRemaining(remainingMs)}</strong>. You can still read your last report anytime.</>
        ) : (
          <>Coach reports are limited to <strong>1 per 24 hours</strong>. Your latest report stays saved here.</>
        )}
      </div>

      {coachError ? <div className={styles.coachError}>{coachError}</div> : null}

      {coachReport ? (
        <div className={styles.coachReportBox}>
          <div className={styles.coachReportHeader}>
            <p className={styles.coachReportTitle}>Coach Report</p>
            <p className={styles.coachReportStamp}>
              {coachCreatedAt ? `Last report: ${formatStamp(coachCreatedAt)}` : ""}
            </p>
          </div>
          <div className={styles.coachReportText}>
  <CoachReportRich report={coachReport} />
</div>

        </div>
      ) : null}
    </>
  )}
</article>


        <BottomNav />

      </div>
    </main>
  );
}