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
const SEED_VERSION = 3;

// ✅ keep these aligned with your current app config
const DATASET_ID = "cn-2023-test1";
const DATASET_VERSION = "cn-2023-test1@v1";

// ✅ set via .env.local (and in Vercel env vars for production)
const ADMIN_EMAIL = (process.env.NEXT_PUBLIC_DEMO_ADMIN_EMAIL ?? "")
  .trim()
  .toLowerCase();

const DEMO_SEED_ALL = (process.env.NEXT_PUBLIC_DEMO_SEED_ALL ?? "") === "1";

function isDemoHost() {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h.endsWith(".vercel.app");
}

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

type DayPartKey = "morning" | "midday" | "evening" | "late";

function pickWeighted<T extends string>(items: Array<{ key: T; w: number }>, seed: string): T {
  const total = items.reduce((s, it) => s + it.w, 0);
  const r = rand01(seed) * total;
  let acc = 0;
  for (const it of items) {
    acc += it.w;
    if (r <= acc) return it.key;
  }
  return items[items.length - 1]!.key;
}

function pickDayPart(modeKey: SeedPlan["modeKey"], userKey: string, daysAgo: number, i: number): DayPartKey {
  // Tune these weights however you want.
  // Key goal: real-test should NOT always fall into the same dayparts.
  const seed = `daypart:${userKey}:${modeKey}:${daysAgo}:${i}`;

  if (modeKey === "real-test") {
    // Spread real-tests across all 4 buckets
    return pickWeighted(
      [
        { key: "morning", w: 0.30 },
        { key: "midday",  w: 0.20 },
        { key: "evening", w: 0.30 },
        { key: "late",    w: 0.20 },
      ],
      seed
    );
  }

  // Learning attempts: slightly more midday/evening
  return pickWeighted(
    [
      { key: "morning", w: 0.20 },
      { key: "midday",  w: 0.30 },
      { key: "evening", w: 0.35 },
      { key: "late",    w: 0.15 },
    ],
    seed
  );
}

function pickHourMinuteInDayPart(part: DayPartKey, seed: string) {
  const rH = rand01(`${seed}:h`);
  const rM = rand01(`${seed}:m`);

  let hour = 8;
  if (part === "morning") {
    // 6..11
    hour = 6 + Math.floor(rH * 6);
  } else if (part === "midday") {
    // 12..16
    hour = 12 + Math.floor(rH * 5);
  } else if (part === "evening") {
    // 17..21
    hour = 17 + Math.floor(rH * 5);
  } else {
    // late: 22..23 OR 0..5 (wrap)
    const wrap = rand01(`${seed}:wrap`) < 0.45; // tune wrap rate
    hour = wrap ? Math.floor(rH * 6) : 22 + Math.floor(rH * 2); // 0..5 or 22..23
  }

  // Minutes: 0..59 (full randomness)
  const minute = Math.floor(rM * 60);

  return { hour, minute };
}

function tsAtDayPart(daysAgo: number, part: DayPartKey, seed: string) {
  const { hour, minute } = pickHourMinuteInDayPart(part, seed);
  const now = Date.now();

  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);

  let t = d.getTime();

  // Prevent “today in the future” from collapsing into the wrong bucket.
  // For daysAgo=0 only: clamp into the past by backing off a deterministic number of minutes.
  if (daysAgo === 0 && t > now - 60_000) {
    const backMin = 10 + (stableHash(seed) % 240); // 10..249 minutes
    t = now - backMin * 60_000;
  }

  return t;
}


function makePlans(userKey: string): SeedPlan[] {


  const plans: SeedPlan[] = [];
  let i = 0;

  function mk(modeKey: SeedPlan["modeKey"], daysAgo: number): SeedPlan {
    const part = pickDayPart(modeKey, userKey, daysAgo, i);
const submittedAt = tsAtDayPart(daysAgo, part, `ts:${userKey}:${modeKey}:${daysAgo}:${i}`);


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
  // always at least 1 real-test/day
  plans.push(mk("real-test", daysAgo));

  // ~22% chance add a 2nd real-test that same day
  if (rand01(`extra-real:${userKey}:${daysAgo}`) < 0.22) {
    plans.push(mk("real-test", daysAgo));
  }

  // always 1 learning attempt/day
  const learningMode: SeedPlan["modeKey"] =
    daysAgo % 2 === 0 ? "half-test" : "ten-percent-test";

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

  const allowAll = DEMO_SEED_ALL && isDemoHost();

  // If not allowAll, keep your existing admin-only behavior
  if (!allowAll) {
    if (!ADMIN_EMAIL) return false;

    const adminUserKey = userKeyFromEmail(ADMIN_EMAIL);
    if (userKey !== adminUserKey) return false;
  }



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
