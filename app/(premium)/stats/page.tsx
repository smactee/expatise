// app/stats/page.tsx
'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import styles from './stats.module.css';
import BackButton from '@/components/BackButton';
import { loadDataset } from '@/lib/qbank/loadDataset';
import type { DatasetId } from '@/lib/qbank/datasets';
import type { Question } from '@/lib/qbank/types';
import { listSubmittedAttempts, migrateLocalAttemptsToCanonical } from '@/lib/test-engine/attemptStorage';
import type { TestAttemptV1 } from '@/lib/test-engine/attemptStorage';
import { useUserKey } from '@/components/useUserKey.client';
import { computeStats } from '@/lib/stats/computeStats';
import { labelForTag } from '@/lib/qbank/tagTaxonomy';
import TimeframeChips, { type Timeframe } from '@/components/stats/TimeframeChips';
import ScreenTimeChart, {ScreenTimeLegend} from '@/components/stats/ScreenTimeChart.client';
import ReadinessRing from '@/app/(premium)/stats/ReadinessRing.client';
import ScoreChart, { ScoreLegend } from '@/components/stats/ScoreChart.client';
import DailyProgressChart, { DailyProgressLegend } from '@/components/stats/DailyProgressChart';
import Heatmap from '@/components/stats/Heatmap.client';
import TopicMasteryChart from '@/components/stats/TopicMasteryChart.client';
import { resetAllLocalData } from '@/lib/stats/resetLocalData';
import { timeKey } from "@/lib/stats/timeKeys"
import { seedAdminDemoDataIfNeeded, reenableDemoSeed } from '@/lib/demo/seedAdminDemoData';
import InfoTip from '@/components/InfoTip.client';
import CoachReportRich from '@/app/(premium)/stats/CoachReportRich.client';
import { useAuthStatus } from '@/components/useAuthStatus';
import { fetchAttemptsFromSupabase } from '@/lib/sync/fetchAttemptsFromSupabase';
import { createClient } from "@/lib/supabase/client";
import { fetchTimeLogsFromSupabase } from '@/lib/sync/timeLogs.client';
import PremiumFeatureModal from "@/components/PremiumFeatureModal";
import { useEntitlements } from "@/components/EntitlementsProvider.client";
import { userKeyFromEmail } from "@/lib/identity/userKey";
import { useT } from '@/lib/i18n/useT';
import {
  DEFAULT_COACH_LOCALE,
  getCoachLocaleConfig,
  resolveCoachLocale,
  type CoachLocale,
} from "@/lib/coach/locale";
import {
  COACH_REPORT_CACHE_VERSION,
  normalizeCoachReportData,
  parseCoachReportDataFromText,
  type CoachReportData,
} from "@/lib/coach/report";



const datasetId: DatasetId = 'cn-2023-test1';

// Exclude Practice from Stats (per your decision)

const REAL_ONLY_MODE_KEYS = ["real-test"];
const LEARNING_MODE_KEYS = ["real-test", "ten-percent-test", "half-test", "rapid-fire-test"]; // all non-practice modes


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

const SKIP_SYNC_KEY = "__expatise_skip_sync_once";

type CachedCoachReport = {
  version?: number | null;
  reportData?: CoachReportData | null;
  report?: string;
  createdAt?: number | null;
  reportLocale?: string | null;
};

const DEMO_ADMIN_EMAILS =
  process.env.NODE_ENV === "production"
    ? []
    : Array.from(
        new Set(
          String(process.env.NEXT_PUBLIC_DEMO_ADMIN_EMAIL ?? "")
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean)
        )
      );

function consumeSkipSyncToken(): boolean {
  if (typeof window === "undefined") return false;

  const raw = window.localStorage.getItem(SKIP_SYNC_KEY);
  const n = Number(raw);

  if (!Number.isFinite(n) || n <= 0) return false;

  const next = n - 1;
  if (next <= 0) window.localStorage.removeItem(SKIP_SYNC_KEY);
  else window.localStorage.setItem(SKIP_SYNC_KEY, String(next));

  return true;
}

export default function StatsPage() {
  const userKey = useUserKey();
  const router = useRouter();
  const { t, locale } = useT();
  const currentCoachLocale = resolveCoachLocale(locale);

  const modeLabel = (key: string) =>
    key === "real-test"
      ? t("stats.modes.realTest")
      : key === "half-test"
      ? t("stats.modes.halfTest")
      : key === "rapid-fire-test"
      ? t("stats.modes.rapidFire")
      : key === "ten-percent-test"
      ? t("stats.modes.tenPercent")
      : key;

  const modesLabel = (keys: string[]) => keys.map((key) => modeLabel(key)).join(", ");
  const tfShortLabel = (timeframe: Timeframe) =>
    timeframe === "all"
      ? t("stats.timeframes.allShort")
      : t("stats.timeframes.daysShort", { days: timeframe });
  const tfLabel = (timeframe: Timeframe) =>
    timeframe === "all"
      ? t("stats.timeframes.allTime")
      : t("stats.timeframes.lastDays", { days: timeframe });
  const statsTooltip = (keys: string[], timeframe: Timeframe) =>
    t("stats.tooltips.includes", { modes: modesLabel(keys), timeframe: tfLabel(timeframe) });



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

  const {
  authed: supabaseAuthed,
  email: sessionEmail,
  loading: authLoading,
} = useAuthStatus();

const { isPremium } = useEntitlements();

const [attemptsHydrated, setAttemptsHydrated] = useState(false);
const [showPremiumModal, setShowPremiumModal] = useState(false);
const legacyEmailUserKey = sessionEmail ? userKeyFromEmail(sessionEmail) : "";

const normalizedSessionEmail = (sessionEmail ?? "").trim().toLowerCase();

const showDemoReseedButton =
  process.env.NODE_ENV !== "production" &&
  !authLoading &&
  supabaseAuthed &&
  DEMO_ADMIN_EMAILS.length > 0 &&
  DEMO_ADMIN_EMAILS.includes(normalizedSessionEmail);

const showCoachCooldownResetButton =
  process.env.NODE_ENV !== "production" &&
  !authLoading &&
  supabaseAuthed;

const resetCoachCooldownLabel = locale === "ja" ? "コーチの待機時間をリセット" : "Reset Coach Cooldown";
const resetCoachCooldownAria = locale === "ja" ? "AIコーチの待機時間をリセット" : "Reset AI Coach cooldown";
const resetCoachCooldownTitle = locale === "ja" ? "このユーザーのAIコーチ待機時間をリセット" : "Reset AI Coach cooldown for this user";
const resetCoachCooldownSuccess = locale === "ja" ? "コーチの待機時間をリセットしました。" : "Coach cooldown reset.";
const resetCoachCooldownFailed = locale === "ja" ? "コーチの待機時間のリセットに失敗しました。" : "Coach cooldown reset failed.";




  // Load dataset questions (needed to grade answers)
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const qs = await loadDataset(datasetId, { locale });
        if (alive) setQuestions(qs);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [datasetId, locale]);

 // Load attempts: local first (instant) + remote (cross-device) then merge
useEffect(() => {
  // 0) Wait until userKey is ready (prevents double-seed / double-load)
  if (!userKey) return;
// ✅ After a Reset, skip demo seeding + remote sync once
const skipSyncOnce = consumeSkipSyncToken();
  // 0.5) Ensure this entire effect only runs once per (userKey, datasetId) per mount
  const runKey = `${userKey}:${datasetId}:${supabaseAuthed ? "authed" : "guest"}`;
  if (seededRef.current === runKey) return;
  seededRef.current = runKey;
  setAttemptsHydrated(false);
  let alive = true;

  (async () => {
    migrateLocalAttemptsToCanonical({
      userKey,
      legacyUserKeys: [legacyEmailUserKey, "guest"],
    });

    // ✅ seed demo data (admin only) BEFORE reading attempts
    if (!skipSyncOnce) {
  await seedAdminDemoDataIfNeeded(userKey, { sessionEmail });
}

    // 1) Local (fast, works offline)
    const local = listSubmittedAttempts({ userKey, datasetId });
    if (!alive) return;
    setAttempts(local);
    setAttemptsLoaded(true);
    // 2) Remote (cross-device). If user isn't logged in, this will just fail quietly.
    if (skipSyncOnce) {
  // local only (which should now be empty after reset)
  if (alive) setAttemptsHydrated(true);
  return;
}
    if (!supabaseAuthed) {
  if (alive) setAttemptsHydrated(true);
  return;
}
    try {
  const remote = await fetchAttemptsFromSupabase({ datasetId });
// keep your old behavior: if it fails, just bail and let local remain
if (!remote) return;

  // Merge...
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
} finally {
  if (alive) setAttemptsHydrated(true);
}
  })();

  return () => {
    alive = false;
  };
}, [userKey, datasetId, supabaseAuthed, sessionEmail, legacyEmailUserKey]);


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
}, [tfReadiness, userKey]);


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
const LS_REPORT = `${coachPrefix}:coach:lastReport:v3`;
const LEGACY_LS_REPORT_V2 = `${coachPrefix}:coach:lastReport:v2`;
const LS_COOLDOWN_UNTIL = `${coachPrefix}:coach:cooldownUntil:v2`;
const legacyCoachPrefix = legacyEmailUserKey ? `expatise:${legacyEmailUserKey}` : "";
const legacyReportKey = legacyCoachPrefix
  ? `${legacyCoachPrefix}:coach:lastReport:v3`
  : "";
const legacyReportKeyV2 = legacyCoachPrefix
  ? `${legacyCoachPrefix}:coach:lastReport:v2`
  : "";
const legacyCooldownKey = legacyCoachPrefix
  ? `${legacyCoachPrefix}:coach:cooldownUntil:v2`
  : "";


const [coachReport, setCoachReport] = useState<CoachReportData | string | null>(null);
const [coachCreatedAt, setCoachCreatedAt] = useState<number | null>(null);
const [coachReportLocale, setCoachReportLocale] = useState<CoachLocale | null>(null);
const [coachLoading, setCoachLoading] = useState(false);
const [coachLoadingDots, setCoachLoadingDots] = useState(1);
const [coachError, setCoachError] = useState<string | null>(null);
const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
const [coachCooldownResetLoading, setCoachCooldownResetLoading] = useState(false);

const [nowMs, setNowMs] = useState<number>(Date.now());
useEffect(() => {
  const id = window.setInterval(() => setNowMs(Date.now()), 10000);
  return () => window.clearInterval(id);
}, []);

useEffect(() => {
  if (!coachLoading) {
    setCoachLoadingDots(1);
    return;
  }

  setCoachLoadingDots(1);
  const id = window.setInterval(() => {
    setCoachLoadingDots((prev) => (prev % 3) + 1);
  }, 400);

  return () => window.clearInterval(id);
}, [coachLoading]);

// Load saved report + cooldown when userKey changes
useEffect(() => {
  setCoachReport(null);
  setCoachCreatedAt(null);
  setCoachReportLocale(null);

  try {
    const reportKeys = Array.from(
      new Set([LS_REPORT, LEGACY_LS_REPORT_V2, legacyReportKey, legacyReportKeyV2].filter(Boolean))
    );
    let reportRaw: string | null = null;
    let reportKeyUsed: string | null = null;
    for (const k of reportKeys) {
      const v = localStorage.getItem(k);
      if (v) {
        reportRaw = v;
        reportKeyUsed = k;
        break;
      }
    }
    if (reportRaw) {
      const obj = JSON.parse(reportRaw) as CachedCoachReport;
      const reportData = normalizeCoachReportData(obj?.reportData);
      const legacyReport = typeof obj?.report === "string" ? obj.report.trim() : "";
      const parsedLegacyReport = legacyReport ? parseCoachReportDataFromText(legacyReport) : null;
      const report = reportData ?? parsedLegacyReport ?? (legacyReport || null);

      if (report) {
        const createdAt = Number(obj.createdAt);
        const reportLocale = resolveCoachLocale(
          typeof obj.reportLocale === "string" ? obj.reportLocale : DEFAULT_COACH_LOCALE
        );

        setCoachReport(report);
        setCoachCreatedAt(Number.isFinite(createdAt) ? createdAt : null);
        setCoachReportLocale(reportLocale);

        if (reportKeyUsed !== LS_REPORT || reportData !== report || obj.version !== COACH_REPORT_CACHE_VERSION) {
          localStorage.setItem(
            LS_REPORT,
            JSON.stringify({
              version: COACH_REPORT_CACHE_VERSION,
              reportData: typeof report === "string" ? null : report,
              report: typeof report === "string" ? report : undefined,
              createdAt: Number.isFinite(createdAt) ? createdAt : null,
              reportLocale,
            })
          );
        }
      }
    }
    const cooldownKeys = Array.from(new Set([LS_COOLDOWN_UNTIL, legacyCooldownKey].filter(Boolean)));
    let cooldownRaw: string | null = null;
    let cooldownKeyUsed: string | null = null;
    for (const k of cooldownKeys) {
      const v = localStorage.getItem(k);
      if (v) {
        cooldownRaw = v;
        cooldownKeyUsed = k;
        break;
      }
    }
    const c = Number(cooldownRaw);
    setCooldownUntil(Number.isFinite(c) && c > 0 ? c : null);
    if (cooldownRaw && cooldownKeyUsed && cooldownKeyUsed !== LS_COOLDOWN_UNTIL) {
      localStorage.setItem(LS_COOLDOWN_UNTIL, cooldownRaw);
    }
  } catch {
    // ignore
  }
}, [LEGACY_LS_REPORT_V2, LS_REPORT, LS_COOLDOWN_UNTIL, legacyReportKey, legacyReportKeyV2, legacyCooldownKey]);

useEffect(() => {
  let alive = true;

  if (consumeSkipSyncToken()) {
    return () => { alive = false; };
  }
  if (!supabaseAuthed) {
    return () => {
      alive = false;
    };
  }

  (async () => {
    try {
      const logs = await fetchTimeLogsFromSupabase({ limit: 200 });
      if (!alive || !logs) return;

      for (const it of logs) {
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

      // keep your old behavior: force re-render so stats recompute
      setAttempts((prev) => prev.slice());
    } catch {
      // ignore
    }
  })();

  return () => {
    alive = false;
  };
}, [userKey, supabaseAuthed]);


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

function clearCoachCooldownState() {
  setCooldownUntil(null);
  setNowMs(Date.now());
  setCoachError(null);

  try {
    localStorage.removeItem(LS_COOLDOWN_UNTIL);
    if (legacyCooldownKey) {
      localStorage.removeItem(legacyCooldownKey);
    }
  } catch {
    // ignore
  }
}

async function handleResetCoachCooldown() {
  if (coachCooldownResetLoading) return;

  setCoachCooldownResetLoading(true);
  try {
    const supabase = createClient();

    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr) {
      window.alert(t('stats.coach.errors.sessionRead', { message: sessionErr.message }));
      return;
    }

    let token = sessionData.session?.access_token ?? null;
    if (!token) {
      const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
      if (refreshErr) {
        window.alert(t('stats.coach.errors.sessionRefresh', { message: refreshErr.message }));
        return;
      }
      token = refreshed.session?.access_token ?? null;
    }

    if (!token) {
      window.alert(t("stats.reset.mustBeLoggedIn"));
      return;
    }

    const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
    const anonKey = String(
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      ""
    ).trim();

    if (!supabaseUrl || !anonKey) {
      window.alert(t("stats.reset.missingEnv"));
      return;
    }

    const res = await fetch(`${supabaseUrl}/functions/v1/reset-stats`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ scope: "coach_cooldown" }),
    });
    const data = await res.json().catch(() => null);

    if (process.env.NODE_ENV !== "production") {
      console.info("[coach-cooldown-reset]", data);
    }

    if (!res.ok || !data?.ok) {
      window.alert(
        data?.error ??
          data?.message ??
          `${resetCoachCooldownFailed} (${res.status}).`
      );
      return;
    }

    clearCoachCooldownState();
    window.alert(resetCoachCooldownSuccess);
  } catch (err: unknown) {
    window.alert(err instanceof Error ? err.message : resetCoachCooldownFailed);
  } finally {
    setCoachCooldownResetLoading(false);
  }
}

async function handleGenerateCoach() {
  if (coachLoading) return;

  setCoachError(null);

  // Client-side gate (server also enforces)
  if (!minimumMet) return;

  // UI cooldown gate (server also enforces via coach_cooldown.last_ms)
  if (cooldownActive) return;

  setCoachLoading(true);
  try {
    const weakest = (coachSkill.topicMastery?.weakestSubtopics ?? [])
      .slice(0, 5)
      .map((s: any) => ({
        tagLabel: labelForTag(s.tag, t) ?? String(s.tag),
        attempted: Number(s.attempted ?? 0),
        accuracyPct: Number(s.accuracyPct ?? 0),
      }));

    const payload = {
      coachContractVersion: "v2.0",
      locale: currentCoachLocale,
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

const supabase = createClient();

const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
if (sessionErr) {
  setCoachError(t('stats.coach.errors.sessionRead', { message: sessionErr.message }));
  return;
}

let token = sessionData.session?.access_token ?? null;
if (!token) {
  const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
  if (refreshErr) {
    setCoachError(t('stats.coach.errors.sessionRefresh', { message: refreshErr.message }));
    return;
  }
  token = refreshed.session?.access_token ?? null;
}

if (!token) {
  setCoachError(t('stats.coach.errors.loginRequired'));
  return;
}

const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const anonKey = String(
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  ""
).trim();

if (!supabaseUrl || !anonKey) {
  setCoachError(t('stats.coach.errors.missingEnv'));
  return;
}

const res = await fetch(`${supabaseUrl}/functions/v1/coach`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    apikey: anonKey,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});
const j = await res.json().catch(() => null);

if (j?.error === "cooldown" && j?.nextAllowedAt) {
  if (process.env.NODE_ENV !== "production") {
    console.warn("[coach-cooldown-429]", j?.debug ?? j);
  }
  const until = Number(j.nextAllowedAt);
  if (Number.isFinite(until) && until > 0) {
    setCooldownUntil(until);
    try { localStorage.setItem(LS_COOLDOWN_UNTIL, String(until)); } catch {}
  }
  setCoachError(t('stats.coach.errors.cooldown', { time: formatRemaining(Math.max(0, until - Date.now())) }));
  return;
}

if (j?.error === "insufficient_data") {
  setCoachError(t('stats.coach.errors.insufficientData'));
  return;
}

if (!res.ok || !j?.ok) {
  setCoachError(
    j?.detail
      ? String(j.detail)
      : j?.error ?? t('stats.coach.errors.requestFailedStatus', { status: res.status })
  );
  return;
}

// success
const reportData = normalizeCoachReportData(j?.reportData);
const createdAt = Number(j?.createdAt ?? Date.now());
const reportLocale = resolveCoachLocale(j?.reportLocale ?? currentCoachLocale);

if (!reportData) {
  setCoachError(t('stats.coach.errors.emptyReport'));
  return;
}

setCoachReport(reportData);
setCoachCreatedAt(Number.isFinite(createdAt) ? createdAt : Date.now());
setCoachReportLocale(reportLocale);

// Save report locally
try {
  localStorage.setItem(
    LS_REPORT,
    JSON.stringify({
      version: Number(j?.version) || COACH_REPORT_CACHE_VERSION,
      reportData,
      createdAt,
      reportLocale,
    })
  );
} catch {}

// Local UI cooldown (your existing UI logic)
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
</div>

<div className={styles.statsSummaryWrap}>
  <div className={styles.statsBackButton}>
        <BackButton variant='inline'/>
  </div>
<button
  type="button"
  className={styles.resetBtn}
  onClick={async () => {
  if (!isPremium) {
    setShowPremiumModal(true);
    return;
  }

  if (!supabaseAuthed) {
    const goLogin = window.confirm(
      t("stats.reset.needLoginConfirm")
    );
    if (goLogin) {
      router.push("/login?next=/stats");
    }
    return;
  }

  const typed = window.prompt(
    t("stats.reset.prompt")
  );
  if ((typed ?? "").trim().toUpperCase() !== "RESET") return;

 try {
  const supabase = createClient();

  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr) {
    window.alert(t('stats.coach.errors.sessionRead', { message: sessionErr.message }));
    return;
  }

  let token = sessionData.session?.access_token ?? null;
  if (!token) {
    const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
    if (refreshErr) {
      window.alert(t('stats.coach.errors.sessionRefresh', { message: refreshErr.message }));
      return;
    }
    token = refreshed.session?.access_token ?? null;
  }

  if (!token) {
    window.alert(t("stats.reset.mustBeLoggedIn"));
    return;
  }

  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const anonKey = String(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ""
  ).trim();

  if (!supabaseUrl || !anonKey) {
    window.alert(t("stats.reset.missingEnv"));
    return;
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/reset-stats`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    window.alert(data?.error ?? data?.message ?? `${t("stats.reset.cloudResetFailed")} (${res.status}).`);
    return;
  }

  if (!data?.ok) {
    window.alert(data?.error ?? t("stats.reset.cloudResetFailed"));
    return;
  }

  localStorage.setItem("__expatise_skip_sync_once", "2");
  localStorage.setItem("__expatise_disable_demo_seed", "1");

  await resetAllLocalData({ includeCaches: true });
  window.location.reload();
} catch (err: unknown) {
  window.alert(err instanceof Error ? err.message : t("stats.reset.resetFailed"));
}
}}
  aria-label={t("stats.reset.aria")}
  title={t("stats.reset.title")}
>
  {t("stats.reset.button")}
</button>

{showDemoReseedButton ? (
  <button
    type="button"
    className={styles.reseedBtn}
    onClick={() => {
      reenableDemoSeed();
      window.location.reload();
    }}
    aria-label={t("stats.reset.reseedAria")}
    title={t("stats.reset.reseedTitle")}
  >
    {t("stats.reset.reseedButton")}
  </button>
) : null}

{showCoachCooldownResetButton ? (
  <button
    type="button"
    className={styles.reseedBtn}
    onClick={handleResetCoachCooldown}
    disabled={coachCooldownResetLoading}
    aria-label={resetCoachCooldownAria}
    title={resetCoachCooldownTitle}
    style={{
      top: 34,
      right: 150,
      width: 132,
      minHeight: 36,
      height: "auto",
      padding: "8px 12px",
      fontSize: 12,
      lineHeight: 1.15,
      whiteSpace: "normal",
      textAlign: "center",
      opacity: coachCooldownResetLoading ? 0.7 : 1,
      cursor: coachCooldownResetLoading ? "default" : "pointer",
    }}
  >
    {resetCoachCooldownLabel}
  </button>
) : null}


        {/* ==== Top Accuracy / Gauge Card ==== */}
<section className={styles.statsSummaryCard}>
  <div className={styles.statsSummaryInner}>
    <div className={styles.readinessTitleRow}>
      <span className={styles.statsTitleRow}>
      </span>
    </div>

   <ReadinessRing
  key={`${userKey}:${tfReadiness}`}   // stable key (or you can remove key entirely)
  valuePct={statsReadiness.readinessPct}
  enabled={!loading && questions.length > 0 && attemptsHydrated}
  onDone={handleReadinessRingDone}
/>

    {/* 👇 Everything below stays hidden until the ring finishes */}
    <div
      className={styles.readinessReveal}
      data-show={readinessDone ? '1' : '0'}
    >
      <div className={styles.readinessMetaBlock}>
        <div className={styles.statsSummaryMeta}>
          {t('stats.readiness.summary', {
            timeframe: tfShortLabel(tfReadiness),
            accuracy: statsReadiness.accuracyPct,
            count: statsReadiness.attemptsCount,
          })}
        </div>
        <div className={styles.readinessMetaLine}>
          {t('stats.readiness.basedOn', { count: statsReadiness.attemptedTotal })}
        </div>
      </div>

      <button
        type="button"
        className={styles.statsTestButton}
        onClick={() => router.push('/test/real')}
      >
        {t('stats.readiness.takeTest')} ▸
      </button>

      <TimeframeChips value={tfReadiness} onChange={setTfReadiness} align="center" />
    </div>
  </div>
</section>
</div>


{/* ==== Big panel + stack of statistic cards ==== */}
        <section className={styles.statsLongPanel}>
          <div className={styles.statsBlocks}>



{/* Screen Time */}
<article className={styles.statsCard}>
  <header className={styles.statsCardHeader}>
  <div className={styles.statsTitleRow}>
    <h2 className={styles.statsCardTitle}>{t('stats.cards.screenTime')}</h2>
    <InfoTip text={statsTooltip(LEARNING_MODE_KEYS, 7)} />
  </div>
  <ScreenTimeLegend animate={screenLegendReady} />


</header>


  <div className={`${styles.statsGraphArea} ${styles.statsGraphClean}`}>
<div
  className={`${styles.statsGraphPlaceholder} ${styles.statsGraphClean}`}
  style={{ width: "100%" }}
>
      {loading ? (
        t('shared.common.loading')
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
    <h2 className={styles.statsCardTitle}>{t('stats.cards.score')}</h2>
    <InfoTip text={statsTooltip(REAL_ONLY_MODE_KEYS, tfScore)} />
  </div>

  <ScoreLegend animate={scoreLegendReady} />
</header>



              <div className={`${styles.statsGraphArea} ${styles.statsGraphClean}`}>
  <div className={`${styles.statsGraphPlaceholder} ${styles.statsGraphClean}`} style={{ width: '100%' }}>
    {loading ? (
      t('shared.common.loading')
    ) : statsScore.attemptsCount === 0 ? (
      t('stats.scoreCard.noTests', { timeframe: tfLabel(tfScore) })
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
    <h2 className={styles.statsCardTitle}>{t('stats.cards.dailyProgress')}</h2>
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
        t('shared.common.loading')
      ) : statsWeekly.attemptsCount === 0 ? (
        t('stats.dailyProgressCard.noData')
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
    <h2 className={styles.statsCardTitle}>{t('stats.cards.heatmap')}</h2>
    <InfoTip text={statsTooltip(REAL_ONLY_MODE_KEYS, tfBestTime)} />
  </div>
  </header>

  <div className={styles.statsGraphArea}>
    {loading ? (
      t('shared.common.loading')
    ) : !statsBestTime.Heatmap ? (
      t('charts.heatmap.notEnoughData')
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
    <h2 className={styles.statsCardTitle}>{t('stats.cards.topicMastery')}</h2>
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
  if (!isPremium) {
    setShowPremiumModal(true);
    return;
  }

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

    title={t('stats.topicMasteryCard.quizTitle')}
  >
    {t('stats.topicMasteryCard.quizButton')}
  </button>
</header>


  <div className={`${styles.statsGraphArea} ${styles.topicMasteryArea}`}>
  {loading ? (
    t('shared.common.loading')
  ) : !statsTopics.topicMastery || statsTopics.topicMastery.topics.length === 0 ? (
    t('stats.topicMasteryCard.noData')
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
            {t('stats.reviewMistakes')}
            </button>
        </div>

{/* GPT Coach */}
<article className={styles.statsCard}>
  <header className={styles.statsCardHeader}>
    <h2 className={styles.statsCardTitle}>{t('stats.cards.aiCoach')}</h2>
  </header>

  {loading ? (
    <p className={styles.coachSubtle}>{t('stats.coach.loading')}</p>
  ) : !minimumMet ? (
    <>
      <p className={styles.coachSubtle}><strong>{t('stats.coach.needsDataTitle')}</strong></p>
      <p className={styles.coachHint} style={{ whiteSpace: 'pre-line' }}>{t('stats.coach.needsDataBody')}</p>
      <p className={styles.coachHint}>{t('stats.coach.needsDataHint')}</p>

      <div className={styles.coachRow}>
        <button
          type="button"
          className={styles.coachBtnPrimary}
          onClick={() => router.push("/test/real")}
        >
          {t('stats.readiness.takeTest')}
        </button>
        {!isPremium ? (
          <button
            type="button"
            className={styles.coachBtnSecondary}
            onClick={() => setShowPremiumModal(true)}
          >
            {t('stats.coach.upgradeToPremium')}
          </button>
        ) : null}
      </div>
    </>
  ) : (
    <>
      {!bestResultsMet ? (
        <>
          <p className={styles.coachSubtle}>
            <strong>{t('stats.coach.firstReportTitle')}</strong>
          </p>
          <p className={styles.coachHint} style={{ whiteSpace: 'pre-line' }}>{t('stats.coach.firstReportBody')}</p>
          <p className={styles.coachHint} style={{ whiteSpace: 'pre-line' }}>{t('stats.coach.firstReportNextSteps')}</p>
        </>
      ) : (
        <p className={styles.coachSubtle}>
          <strong>{t('stats.coach.readyText')}</strong>
        </p>
      )}

      <div className={styles.coachRow}>
        <button
          type="button"
          className={styles.coachBtnPrimary}
          onClick={handleGenerateCoach}
          disabled={coachLoading || cooldownActive}
          title={
            cooldownActive
              ? t('stats.coach.nextAvailable', { time: formatRemaining(remainingMs) })
              : t('stats.coach.generateTitle')
          }
        >
          {coachLoading
            ? (
              <>
                <span>{t('stats.coach.generating')}</span>
                <span className={styles.loadingDots} aria-hidden="true">
                  {".".repeat(coachLoadingDots)}
                </span>
              </>
            )
            : cooldownActive
            ? t('stats.coach.locked')
            : t('stats.coach.generateTitle')}
        </button>

        <button
          type="button"
          className={styles.coachBtnSecondary}
          onClick={() => router.push("/test/real")}
        >
          {t('stats.readiness.takeTest')}
        </button>
      </div>

      <div className={styles.coachMeta}>
        {cooldownActive ? (
          <>{t('stats.coach.cooldownActive', { time: formatRemaining(remainingMs) })}</>
        ) : (
          <>{t('stats.coach.cooldownIdle')}</>
        )}
      </div>

      {coachError ? <div className={styles.coachError}>{coachError}</div> : null}

      {coachReport ? (
        <div className={styles.coachReportBox}>
          <div className={styles.coachReportHeader}>
            <p className={styles.coachReportTitle}>{t('stats.coach.reportTitle')}</p>
            <p className={styles.coachReportStamp}>
              {coachCreatedAt ? t('stats.coach.reportStamp', { stamp: formatStamp(coachCreatedAt) }) : ""}
              {coachReportLocale
                ? `${coachCreatedAt ? " · " : ""}${getCoachLocaleConfig(coachReportLocale).label}`
                : ""}
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
      </div>
      <BottomNav />

      <PremiumFeatureModal
        open={showPremiumModal}
        onClose={() => setShowPremiumModal(false)}
        nextPath="/stats"
        isAuthed={supabaseAuthed}
        premiumPath="/premium?next=%2Fstats"
      />
    </main>
  );
}
