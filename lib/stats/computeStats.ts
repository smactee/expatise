// lib/stats/computeStats.ts
import type { Question } from "@/lib/qbank/types";
import { deriveTopicSubtags } from "@/lib/qbank/deriveTopicSubtags";
import { timeKey } from "@/lib/stats/timeKeys";

type AnswerRecordLike = { choice: string; answeredAt?: number };

export type AttemptLike = {
  status: "submitted" | string;
  submittedAt?: number;
  lastActiveAt?: number;
  createdAt?: number;

  modeKey: string;

  questionIds: string[];
  answersByQid: Record<string, AnswerRecordLike>;

  timeLimitSec?: number;
  remainingSec?: number;
};

export type StatsFilters = {
  timeframeDays: 7 | 30 | "all";
  includeModeKeys: string[]; // e.g. ["real-test","half-test","rapid-fire-test"]
};

export type StatsVM = {
  attemptsCount: number;

  // Grading totals (timeframe+mode filtered)
  attemptedTotal: number;
  correctTotal: number;

  accuracy: number; // 0..1
  accuracyPct: number; // 0..100

  // Score (exam-style)
  scoreAvg: number; // 0..100
  scoreBest: number; // 0..100
  scoreLatest: number; // 0..100

  // Simple readiness (v1)
  readinessPct: number; // 0..100

  // Optional (timed-test estimate only)
  timeInTimedTestsSec: number;

  // Minimal series we can chart later
  scoreSeries: Array<{ t: number; scorePct: number }>;

    // Weekly Progress (Consistency)
  weeklySeries: Array<{
    weekStart: number;          // ms timestamp (Mon 00:00 local)
    testsCompleted: number;
    questionsAnswered: number;  // answered count (attempted)
    avgScore: number;           // 0..100
  }>;

    // Best Time (Performance by time-of-day)
  bestTimeSeries: Array<{
    label: string;        // e.g. "6–9"
    avgScore: number;     // 0..100
    attemptsCount: number;
  }>;

  bestTimeLabel: string | null;   // e.g. "9–12"
  bestTimeAvgScore: number;       // 0..100


  bestWeekQuestions: number;        // max questionsAnswered in a week
  consistencyStreakWeeks: number;   // current streak (consecutive weeks with >0)

    // Topic Mastery (Weakest topics)
  weakTopics: Array<{
    tag: string;         // e.g. "road-safety:accidents"
    attempted: number;   // answered count
    correct: number;
    accuracyPct: number; // 0..100
  }>;

  timeDailySeries: Array<{
  dayStart: number;      // local midnight ms
  deliberateMin: number; // test minutes
  studyMin: number;      // study minutes
  totalMin: number;
}>;

timeThisWeekMin: number;
timeBestDayMin: number;
timeStreakDays: number;
deliberateThisWeekMin: number;
studyThisWeekMin: number;


};

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function median(nums: number[]) {
  if (nums.length === 0) return 0;
  const a = [...nums].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

function normalizeRowChoice(v: string | null | undefined): "R" | "W" | null {
  if (!v) return null;
  const t = v.trim().toLowerCase();
  if (t === "r" || t === "right") return "R";
  if (t === "w" || t === "wrong") return "W";
  return null;
}

/**
 * Robust correctness check that matches what you’re effectively doing in Mistakes:
 * - MCQ: user choice can be "A"/"B", originalKey, or option id
 * - correctOptionId can be option id OR key/letter depending on dataset normalization
 * - ROW: "R"/"W" (also accepts "Right"/"Wrong")
 */
function isAnswerCorrect(question: Question, chosenRaw: string | null | undefined): boolean {
  if (!chosenRaw) return false;

  if (question.type === "ROW") {
    const chosen = normalizeRowChoice(chosenRaw);
    const expected = normalizeRowChoice((question as any).correctRow ?? null);
    return !!(chosen && expected && chosen === expected);
  }

  // MCQ
  if (question.type !== "MCQ") return false;
  const expected = (question as any).correctOptionId as string | undefined;
  const options = (question as any).options as Array<{ id: string; originalKey?: string | null }> | undefined;

  if (!expected || !options?.length) return false;

  // Find the option the user chose
  const idx = options.findIndex((opt, i) => {
    const letter = String.fromCharCode(65 + i); // A,B,C...
    const key = opt.originalKey ?? letter;
    return chosenRaw === key || chosenRaw === letter || chosenRaw === opt.id;
  });

  if (idx < 0) return false;

  const opt = options[idx];
  const letter = String.fromCharCode(65 + idx);
  const key = opt.originalKey ?? letter;

  return expected === opt.id || expected === key || expected === letter;
}

function getAttemptTime(a: AttemptLike): number {
  return a.submittedAt ?? a.lastActiveAt ?? a.createdAt ?? 0;
}

function inTimeframe(t: number, timeframeDays: StatsFilters["timeframeDays"]) {
  if (timeframeDays === "all") return true;
  const now = Date.now();
  const ms = timeframeDays * 24 * 60 * 60 * 1000;
  return t >= now - ms;
}

function startOfWeekMs(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun, 1=Mon...
  const diffToMonday = (day + 6) % 7; // Mon->0, Tue->1, Sun->6
  d.setDate(d.getDate() - diffToMonday);
  return d.getTime();
}


export function computeStats(params: {
  attempts: AttemptLike[];
  questions: Question[];
  filters: StatsFilters;
}): StatsVM {
  const { attempts, questions, filters } = params;

  const questionsById = new Map<string, Question>();
  for (const q of questions) questionsById.set(q.id, q);

  const allowedModes = new Set(filters.includeModeKeys);

  const filtered = attempts
    .filter((a) => a.status === "submitted")
    .filter((a) => allowedModes.has(a.modeKey))
    .filter((a) => inTimeframe(getAttemptTime(a), filters.timeframeDays))
    .sort((a, b) => getAttemptTime(b) - getAttemptTime(a)); // newest first

  let attemptedTotal = 0;
  let correctTotal = 0;

  let timeInTimedTestsSec = 0;

  const scoreSeries: Array<{ t: number; scorePct: number }> = [];
  const scoreList: number[] = [];

  const weekly = new Map<
    number,
    { tests: number; answered: number; scoreSum: number; scoreCount: number }
  >();

  // Best Time buckets (local hour of submittedAt)
  const TIME_BUCKETS = [
    { label: "6–9", start: 6, end: 9 },
    { label: "9–12", start: 9, end: 12 },
    { label: "12–15", start: 12, end: 15 },
    { label: "15–18", start: 15, end: 18 },
    { label: "18–21", start: 18, end: 21 },
    { label: "21–24", start: 21, end: 24 },
    { label: "0–6", start: 0, end: 6 },
  ] as const;

  const timeBuckets = TIME_BUCKETS.map((b) => ({
    ...b,
    scoreSum: 0,
    count: 0,
  }));

  // Topic Mastery
  const mastery = new Map<string, { attempted: number; correct: number }>();
  const MIN_TOPIC_ATTEMPTED = 10;

  for (const a of filtered) {
    const t = getAttemptTime(a);

    let attempted = 0;
    let correct = 0;

    for (const [qid, rec] of Object.entries(a.answersByQid ?? {})) {
      const question = questionsById.get(qid);
      if (!question) continue;

      const chosen = rec?.choice ?? null;
      if (!chosen) continue;

      const answerCorrect = isAnswerCorrect(question, chosen);

      attempted++;
      if (answerCorrect) correct++;

      // Topic mastery (subtopics only)
      const tags = deriveTopicSubtags(question) ?? [];
      const subtopics = tags.filter(
        (tag) => tag.includes(":") && !tag.endsWith(":all")
      );

      for (const tag of subtopics) {
        const m = mastery.get(tag) ?? { attempted: 0, correct: 0 };
        m.attempted += 1;
        if (answerCorrect) m.correct += 1;
        mastery.set(tag, m);
      }
    }

    attemptedTotal += attempted;
    correctTotal += correct;

    const denom = Math.max(1, a.questionIds?.length ?? 0);
    const scorePct = Math.round((100 * correct) / denom);

    scoreSeries.push({ t, scorePct });
    scoreList.push(scorePct);

    // Best Time bucket update
    const hour = new Date(t).getHours();
    const bi = timeBuckets.findIndex((b) => hour >= b.start && hour < b.end);
    if (bi >= 0) {
      timeBuckets[bi].scoreSum += scorePct;
      timeBuckets[bi].count += 1;
    }

    // Weekly bucket
    const ws = startOfWeekMs(t);
    const w =
      weekly.get(ws) ?? { tests: 0, answered: 0, scoreSum: 0, scoreCount: 0 };
    w.tests += 1;
    w.answered += attempted;
    w.scoreSum += scorePct;
    w.scoreCount += 1;
    weekly.set(ws, w);

    // timed-test estimate (optional)
    const tls = typeof a.timeLimitSec === "number" ? a.timeLimitSec : 0;
    const rem = typeof a.remainingSec === "number" ? a.remainingSec : 0;
    if (tls > 0) timeInTimedTestsSec += Math.max(0, tls - rem);
  }

  // Best Time outputs
  const bestTimeSeries = timeBuckets.map((b) => ({
    label: b.label,
    avgScore: b.count ? Math.round(b.scoreSum / b.count) : 0,
    attemptsCount: b.count,
  }));

  let bestTimeLabel: string | null = null;
  let bestTimeAvgScore = 0;

  for (const b of bestTimeSeries) {
    if (b.attemptsCount <= 0) continue;
    if (b.avgScore > bestTimeAvgScore) {
      bestTimeAvgScore = b.avgScore;
      bestTimeLabel = b.label;
    }
  }

  // Topic Mastery outputs
  const weakTopics = Array.from(mastery.entries())
    .map(([tag, m]) => ({
      tag,
      attempted: m.attempted,
      correct: m.correct,
      accuracyPct: m.attempted ? Math.round((100 * m.correct) / m.attempted) : 0,
    }))
    .filter((x) => x.attempted >= MIN_TOPIC_ATTEMPTED)
    .sort((a, b) => a.accuracyPct - b.accuracyPct || b.attempted - a.attempted)
    .slice(0, 5);

  // Score + readiness
  scoreSeries.sort((x, y) => x.t - y.t);

  const accuracy = attemptedTotal > 0 ? correctTotal / attemptedTotal : 0;
  const accuracyPct = Math.round(accuracy * 100);

  const scoreAvg = scoreList.length
    ? Math.round(scoreList.reduce((s, n) => s + n, 0) / scoreList.length)
    : 0;
  const scoreBest = scoreList.length ? Math.max(...scoreList) : 0;
  const scoreLatest = filtered.length ? scoreList[0] : 0;

  const medianScore01 = clamp01(median(scoreList) / 100);
  const readinessPct = Math.round(
    100 * (0.7 * clamp01(accuracy) + 0.3 * medianScore01)
  );

  // Weekly outputs
  const weeklySeries = Array.from(weekly.entries())
    .map(([weekStart, w]) => ({
      weekStart,
      testsCompleted: w.tests,
      questionsAnswered: w.answered,
      avgScore: w.scoreCount ? Math.round(w.scoreSum / w.scoreCount) : 0,
    }))
    .sort((a, b) => a.weekStart - b.weekStart);

  const bestWeekQuestions = weeklySeries.length
    ? Math.max(...weeklySeries.map((x) => x.questionsAnswered))
    : 0;

  let consistencyStreakWeeks = 0;
  let cursor = startOfWeekMs(Date.now());
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  while (true) {
    const w = weekly.get(cursor);
    if (!w || w.answered <= 0) break;
    consistencyStreakWeeks += 1;
    cursor -= WEEK_MS;
  }

  function readDailySeconds(kind: "test" | "study", ymd: string) {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(timeKey(kind, ymd));
    const n = Number(raw ?? "0");
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function startOfDayMsLocal(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

const DAYS = 7;
const today = new Date();
today.setHours(0, 0, 0, 0);

const timeDailySeries = [];
for (let i = DAYS - 1; i >= 0; i--) {
  const d = new Date(today);
  d.setDate(d.getDate() - i);

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const ymd = `${y}-${m}-${day}`;

  const testSec = readDailySeconds("test", ymd);
  const studySec = readDailySeconds("study", ymd);

  const deliberateMin = Math.round(testSec / 60);
  const studyMin = Math.round(studySec / 60);

  timeDailySeries.push({
    dayStart: startOfDayMsLocal(d),
    deliberateMin,
    studyMin,
    totalMin: deliberateMin + studyMin,
  });
}

const deliberateThisWeekMin = timeDailySeries.reduce((s, d) => s + d.deliberateMin, 0);
const studyThisWeekMin = timeDailySeries.reduce((s, d) => s + d.studyMin, 0);
const timeThisWeekMin = deliberateThisWeekMin + studyThisWeekMin;

const timeBestDayMin = timeDailySeries.length
  ? Math.max(...timeDailySeries.map((d) => d.totalMin))
  : 0;

// streak: consecutive days ending today with totalMin > 0
let timeStreakDays = 0;
for (let i = timeDailySeries.length - 1; i >= 0; i--) {
  if (timeDailySeries[i].totalMin <= 0) break;
  timeStreakDays += 1;
}


  return {
    attemptsCount: filtered.length,
    attemptedTotal,
    correctTotal,
    accuracy,
    accuracyPct,
    scoreAvg,
    scoreBest,
    scoreLatest,
    readinessPct,
    timeInTimedTestsSec,
    scoreSeries,
    weeklySeries,
    bestWeekQuestions,
    consistencyStreakWeeks,
    bestTimeSeries,
    bestTimeLabel,
    bestTimeAvgScore,
    weakTopics,
    timeDailySeries,
    timeThisWeekMin,
    timeBestDayMin,
    timeStreakDays,
    deliberateThisWeekMin,
    studyThisWeekMin,
  };
}
