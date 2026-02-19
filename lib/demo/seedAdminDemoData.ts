// lib/demo/seedAdminDemoData.ts
import { loadDataset } from "@/lib/qbank/loadDataset";
import type { Question } from "@/lib/qbank/types";
import { userKeyFromEmail } from "@/lib/identity/userKey";
import {
  listSubmittedAttempts,
  writeAttempt,
  deleteAttemptById,
} from "@/lib/test-engine/attemptStorage";
import type { TestAttemptV1 } from "@/lib/test-engine/attemptTypes";
import { timeKey, ymdLocal } from "@/lib/stats/timeKeys";

// ✅ bump this number whenever you want to regenerate a fresh demo dataset
const SEED_VERSION = 2;

// ✅ keep these aligned with your current app config
const DATASET_ID = "cn-2023-test1";
const DATASET_VERSION = "cn-2023-test1@v1";

// ✅ set via .env.local (and in Vercel env vars for production)
const ADMIN_EMAIL = (process.env.NEXT_PUBLIC_DEMO_ADMIN_EMAIL ?? "")
  .trim()
  .toLowerCase();

const TOTAL_ATTEMPTS = 100;
const DAYS = 30;

function stableHash(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rand01(seed: string) {
  // deterministic 0..1
  return stableHash(seed) / 4294967295;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function optionKeyForIndex(q: Question, idx: number) {
  const opt = q.options[idx];
  return opt?.originalKey ?? String.fromCharCode(65 + idx); // A/B/C/D...
}

function normalizeRowAnswer(v: unknown): "R" | "W" | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (s.startsWith("r")) return "R";
  if (s.startsWith("w")) return "W";
  return null;
}

function pickCorrectChoice(q: Question): string {
  if (q.type === "ROW") {
    return normalizeRowAnswer(q.correctRow) ?? "R";
  }

  const correctId = q.correctOptionId;
  if (!correctId || q.options.length === 0) return "A";

  const idx = q.options.findIndex((o) => o.id === correctId);
  const safeIdx = idx >= 0 ? idx : 0;
  return optionKeyForIndex(q, safeIdx);
}

function pickWrongChoice(q: Question): string {
  if (q.type === "ROW") {
    const correct = normalizeRowAnswer(q.correctRow) ?? "R";
    return correct === "R" ? "W" : "R";
  }

  if (q.options.length === 0) return "B";

  const correctId = q.correctOptionId;
  const correctIdx = correctId ? q.options.findIndex((o) => o.id === correctId) : -1;

  let wrongIdx = 0;
  if (wrongIdx === correctIdx) wrongIdx = 1;
  if (wrongIdx >= q.options.length) wrongIdx = 0;

  return optionKeyForIndex(q, wrongIdx);
}

function sliceQuestionIds(all: string[], count: number, seed: string) {
  if (all.length <= count) return all.slice(0, count);
  const h = stableHash(seed);
  const start = h % (all.length - count + 1);
  return all.slice(start, start + count);
}

function tsAt(daysAgo: number, hour: number, minute: number) {
  const now = Date.now();

  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);

  let t = d.getTime();

  // ✅ never allow “future” timestamps (can happen when daysAgo=0)
  if (t > now - 60_000) {
    const backMin = 10 + (stableHash(`${daysAgo}:${hour}:${minute}`) % 120); // 10..129 minutes
    t = now - backMin * 60_000;
  }

  return t;
}

type SeedPlan = {
  attemptId: string;
  modeKey: "real-test" | "half-test" | "rapid-fire-test" | "ten-percent-test";
  submittedAt: number;
  questionCount: number;
  correctCount: number;
  timeSpentSec: number;
  timeLimitSec: number; 
};

function buildAttempt(
  params: SeedPlan,
  userKey: string,
  qById: Map<string, Question>,
  allQids: string[]
): TestAttemptV1 {
  const submittedAt = params.submittedAt;
  const createdAt = submittedAt - params.timeSpentSec * 1000;

  const questionIds = sliceQuestionIds(allQids, params.questionCount, params.attemptId);

  const answersByQid: Record<string, { choice: string; answeredAt: number }> = {};
  const correctSet = new Set(questionIds.slice(0, params.correctCount));

  questionIds.forEach((qid, idx) => {
    const q = qById.get(qid);
    if (!q) return;

    const choice = correctSet.has(qid) ? pickCorrectChoice(q) : pickWrongChoice(q);
    answersByQid[qid] = { choice, answeredAt: createdAt + idx * 1200 };
  });

  const remainingSec =
    params.timeLimitSec > 0 ? Math.max(0, params.timeLimitSec - params.timeSpentSec) : 0;

  return {
    schemaVersion: 1,
    attemptId: params.attemptId,
    userKey,
    modeKey: params.modeKey,
    datasetId: DATASET_ID,
    datasetVersion: DATASET_VERSION,

    questionIds,
    answersByQid,
    flaggedByQid: {},

    timeLimitSec: params.timeLimitSec,
    remainingSec,

    status: "submitted",
    createdAt,
    lastActiveAt: submittedAt,
    submittedAt,
    // ✅ do NOT include pausedAt at all (it’s optional and must be number if present)
  };
}

function makePlans(userKey: string): SeedPlan[] {
  const timeSlots = [
    { h: 8, m: 10 },
    { h: 12, m: 45 },
    { h: 18, m: 20 },
    { h: 22, m: 5 },
  ];

  const plans: SeedPlan[] = [];
  let i = 0;

  function mk(modeKey: SeedPlan["modeKey"], daysAgo: number): SeedPlan {
    const slot = timeSlots[i % timeSlots.length];
    const submittedAt = tsAt(daysAgo, slot.h, slot.m);

    const dayProgress = (DAYS - 1 - daysAgo) / (DAYS - 1); // older=0 → newest=1
    const noise = (rand01(`acc:${userKey}:${i}`) - 0.5) * 0.10; // +/-5%

    const baseAcc = 0.65 + dayProgress * 0.25 + noise; // ~0.60 → ~0.92
    const modeAdj = modeKey === "real-test" ? 0.02 : modeKey === "rapid-fire-test" ? -0.02 : 0.0;
    const acc = clamp(baseAcc + modeAdj, 0.55, 0.95);

    const isShort = modeKey === "rapid-fire-test" || modeKey === "ten-percent-test";

    const questionCount = modeKey === "real-test" ? 100 : modeKey === "half-test" ? 50 : 10;
    const timeLimitSec = modeKey === "real-test" ? 45 * 60 : modeKey === "half-test" ? 25 * 60 : 5 * 60;

    const spendRatio = 0.45 + rand01(`time:${userKey}:${i}`) * 0.5;
    const timeSpentSec = Math.max(60, Math.min(timeLimitSec, Math.round(timeLimitSec * spendRatio)));

    const correctCount = clamp(Math.round(questionCount * acc), 0, questionCount);

    const attemptId = `demo-${modeKey}-${String(i).padStart(3, "0")}`;
    i++;

    return {
      attemptId,
      modeKey,
      submittedAt,
      questionCount,
      correctCount,
      timeSpentSec,
      timeLimitSec,
    };
  }

  // ✅ Guaranteed coverage:
  // - 1 real-test every day (so real-only charts always have data)
  // - 1 learning attempt every day (for variety / streaks)
  for (let daysAgo = 0; daysAgo < DAYS; daysAgo++) {
    plans.push(mk("real-test", daysAgo));

    const learningMode: SeedPlan["modeKey"] =
      daysAgo % 2 === 0 ? "half-test" : "ten-percent-test"; // swap to rapid-fire-test if you prefer

    plans.push(mk(learningMode, daysAgo));
  }

  // Add extra learning attempts until TOTAL_ATTEMPTS
  while (plans.length < TOTAL_ATTEMPTS) {
    const daysAgo = stableHash(`extra-day:${userKey}:${i}`) % DAYS;
    const r = rand01(`extra-mode:${userKey}:${i}`);
    const mode: SeedPlan["modeKey"] = r < 0.5 ? "rapid-fire-test" : "ten-percent-test";
    plans.push(mk(mode, daysAgo));
  }

  return plans;
}


export async function seedAdminDemoDataIfNeeded(userKey: string) {
  // Only run in browser
  if (typeof window === "undefined") return false;

  if (!ADMIN_EMAIL) return false;

  const adminUserKey = userKeyFromEmail(ADMIN_EMAIL);
  if (userKey !== adminUserKey) return false;

  const seedFlag = `expatise:demo-seed:v${SEED_VERSION}:${DATASET_ID}:${userKey}`;
  if (localStorage.getItem(seedFlag) === "1") return false;

  // ✅ delete old demo attempts (demo-*) so reseeding is clean
  const existing = listSubmittedAttempts({ userKey, datasetId: DATASET_ID });
  for (const a of existing) {
    if (a.attemptId.startsWith("demo-")) {
      await deleteAttemptById(a.attemptId);
    }
  }

  const questions = await loadDataset(DATASET_ID);
  const allQids = questions.map((q) => q.id);
  const qById = new Map(questions.map((q) => [q.id, q] as const));

  const plans = makePlans(userKey);

  // for time logs
  const perDay = new Map<string, { testSec: number; studySec: number }>();

  for (const p of plans) {
    const attempt = buildAttempt(p, userKey, qById, allQids);
    await writeAttempt(attempt);

    const day = ymdLocal(new Date(p.submittedAt));
    const prev = perDay.get(day) ?? { testSec: 0, studySec: 0 };
    prev.testSec += p.timeSpentSec;

    // study = a bit less than test, plus some baseline
    prev.studySec += Math.round(p.timeSpentSec * 0.35) + 6 * 60;
    perDay.set(day, prev);
  }

  // Seed time logs (last 30 days) so Screen Time charts aren’t empty
  for (let d = 0; d < DAYS; d++) {
    const dayDate = new Date();
    dayDate.setDate(dayDate.getDate() - d);
    const day = ymdLocal(dayDate);

    const totals = perDay.get(day) ?? { testSec: 8 * 60, studySec: 6 * 60 };

    const kTest = timeKey("test", day);
    const kStudy = timeKey("study", day);

    localStorage.setItem(kTest, String(totals.testSec));
    localStorage.setItem(kStudy, String(totals.studySec));
  }

  localStorage.setItem(seedFlag, "1");
  return true;
}
