// app/(premium)/all-test/AllTestClient.client.tsx

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

import styles from './all-test.module.css';

import { loadDataset } from '@/lib/qbank/loadDataset';
import type { DatasetId } from '@/lib/qbank/datasets';
import type { Question } from '@/lib/qbank/types';
import { useBookmarks } from '@/lib/bookmarks/useBookmarks';
import BackButton from '@/components/BackButton';
import { useAuthStatus } from '@/components/useAuthStatus';
import { attemptStore } from "@/lib/attempts/store";
import { computeNextUnansweredIndex, normalizeUserKey, type TestAttemptV1 } from "@/lib/attempts/engine";
import {
  canStartExam,
  incrementExamStart,
  canShowQuestion,
  markQuestionShown,
} from "@/lib/freeAccess/localUsageCap";
import { useEntitlements } from '@/components/EntitlementsProvider.client';
import { useClearedMistakes } from '@/lib/mistakes/useClearedMistakes';
import { deriveTopicSubtags } from '@/lib/qbank/deriveTopicSubtags';



function formatTime(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function normalizeRowChoice(v: string | null | undefined): 'R' | 'W' | null {
  if (!v) return null;

  const t = v.trim().toLowerCase();

  if (t === 'r' || t === 'right') return 'R';
  if (t === 'w' || t === 'wrong') return 'W';

  return null;
}

function compileMistakeIds(
  questions: Question[],
  submittedAttempts: Array<Pick<TestAttemptV1, "answersByQid" | "submittedAt">>,
  cleared: Set<string>
): string[] {
  const byId = new Map(questions.map((q) => [q.id, q] as const));
  const mistakes = new Set<string>();

  for (const a of submittedAttempts) {
    for (const [qid, rec] of Object.entries(a.answersByQid ?? {})) {
      if (cleared.has(qid)) continue;

      const question = byId.get(qid);
      if (!question) continue;

      const chosenKey = rec?.choice ?? null;
      if (!chosenKey) continue;

      let isCorrect = false;

      if (question.type === "ROW") {
        const chosen = normalizeRowChoice(chosenKey);
        const expected = normalizeRowChoice((question as any).correctRow ?? null);
        isCorrect = !!(chosen && expected && chosen === expected);
      } else {
        const expected = (question as any).correctOptionId as string | undefined;
        const opts = (question as any).options as any[] | undefined;

        if (!expected || !opts?.length) {
          isCorrect = false;
        } else {
          const idx = opts.findIndex((opt, i) => {
            const letter = String.fromCharCode(65 + i);
            const key = opt.originalKey ?? letter;
            return chosenKey === key || chosenKey === letter || chosenKey === opt.id;
          });

          if (idx >= 0) {
            const opt = opts[idx];
            const letter = String.fromCharCode(65 + idx);
            const key = opt.originalKey ?? letter;
            isCorrect = expected === opt.id || expected === key || expected === letter;
          }
        }
      }

      if (!isCorrect) mistakes.add(qid);
    }
  }

  return Array.from(mistakes);
}

// =========================
// Topic Quiz (weak subtopics: v1)
// =========================

// ✅ Accept BOTH keys (your Stats currently writes the old one)
const TOPIC_QUIZ_KEYS = ["expatise:topicQuiz:v1", "topicQuiz:v1"] as const;

type TopicQuizV1 = {
  schemaVersion: 1;
  createdAt: number;
  tags: string[]; // weakest -> strongest
};

function normalizeTag(s: unknown) {
  return String(s ?? "").trim().replace(/^#/, "").toLowerCase();
}

/**
 * Accepts BOTH shapes:
 * - New: { schemaVersion: 1, createdAt, tags: [...] }
 * - Old: { v: 1, createdAt, rankedTags: [...] }
 */
function readTopicQuizV1(): TopicQuizV1 | null {
  if (typeof window === "undefined") return null;

  for (const key of TOPIC_QUIZ_KEYS) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw);

      // New format
      if (parsed?.schemaVersion === 1 && Array.isArray(parsed.tags)) {
        const tags = parsed.tags.map(normalizeTag).filter(Boolean);
        return { schemaVersion: 1, createdAt: Number(parsed.createdAt ?? Date.now()), tags };
      }

      // Old format (your Stats page)
      if (parsed?.v === 1 && Array.isArray(parsed.rankedTags)) {
        const tags = parsed.rankedTags.map(normalizeTag).filter(Boolean);
        return { schemaVersion: 1, createdAt: Number(parsed.createdAt ?? Date.now()), tags };
      }
    } catch {
      // ignore and keep trying
    }
  }

  return null;
}

/**
 * Build a pool that stays as "weak" as possible while still having enough questions.
 * - rankedTags: weakest -> strongest
 * - each question gets bestRank = smallest index among its topic subtags
 * - choose the smallest cutoff rank that yields >= desiredCount questions
 */
function compileTopicQuizIds(questions: Question[], desiredCount: number): string[] {
  const payload = readTopicQuizV1();
  const rankedTags = payload?.tags ?? [];
  if (rankedTags.length === 0) return [];

  const rankIndex = new Map<string, number>();
  for (let i = 0; i < rankedTags.length; i++) {
    const tag = normalizeTag(rankedTags[i]);
    if (tag && !rankIndex.has(tag)) rankIndex.set(tag, i);
  }

  const ranked: Array<{ id: string; best: number }> = [];

  for (const q of questions) {
    // ✅ be generous: consider deriveTopicSubtags + manual tags + autoTags
    const derived = (deriveTopicSubtags(q) ?? []).map(normalizeTag);
    const manual = (q.tags ?? []).map(normalizeTag);
    const auto = (q.autoTags ?? []).map(normalizeTag);


    const allTags = Array.from(new Set([...derived, ...manual, ...auto])).filter(Boolean);

    let best = Infinity;
    for (const t of allTags) {
      const idx = rankIndex.get(t);
      if (idx !== undefined && idx < best) best = idx;
    }

    if (best !== Infinity) ranked.push({ id: q.id, best });
  }

  if (ranked.length === 0) return [];

  ranked.sort((a, b) => a.best - b.best);

  const k = Math.min(ranked.length - 1, Math.max(0, desiredCount - 1));
  const cutoff = ranked[k].best;

  const pool = ranked.filter((x) => x.best <= cutoff).map((x) => x.id);
  return Array.from(new Set(pool));
}



export default function AllTestClient({
  modeKey,
  datasetId,
  datasetVersion,
  questionCount,
  timeLimitMinutes,
  preflightRequiredQuestions,
  routeBase,
  autoAdvanceSeconds,
}: {
  modeKey: string;
  datasetId: DatasetId;
  datasetVersion: string;
  questionCount: number;
  timeLimitMinutes: number;
  preflightRequiredQuestions?: number;
  routeBase: string;
  autoAdvanceSeconds?: number;
}) {


  const router = useRouter();

  const required = preflightRequiredQuestions ?? questionCount;

  const hasTimer = timeLimitMinutes > 0;


  const [items, setItems] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  

  const [index, setIndex] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
const [autoLeft, setAutoLeft] = useState<number | null>(null);

const showAutoAdvance =
  modeKey === "rapid-test" && (autoAdvanceSeconds ?? 0) > 0;

const autoAdvanceMs = showAutoAdvance ? (autoAdvanceSeconds! * 1000) : 0;

// so the timer can read the latest selection without resetting the timer
const selectedKeyRef = useRef<string | null>(null);
useEffect(() => {
  selectedKeyRef.current = selectedKey;
}, [selectedKey]);


  const total = items.length || questionCount;
  const currentNo = Math.min(index + 1, total);

  const [timeLeft, setTimeLeft] = useState(hasTimer ? timeLimitMinutes * 60 : 0);
  const endAtRef = useRef<number>(hasTimer ? Date.now() + timeLimitMinutes * 60 * 1000 : 0);

const { isPremium } = useEntitlements();
const enforceCaps = !isPremium; // premium users should not hit free caps


const { loading: authLoading, email } = useAuthStatus();
const userKey = normalizeUserKey(email ?? "") || "guest";


// ✅ put it RIGHT HERE (top-level hook, not inside useEffect)
const { idSet: bookmarkedSet, toggle, isBookmarked } = useBookmarks(datasetId, userKey);

// (keep your mistakes cleared set too if you're using it)
const { idSet: clearedMistakesSet } = useClearedMistakes(datasetId, userKey);

const advancingRef = useRef(false);

// More reliable than e.detail: works even if state hasn’t re-rendered yet
const lastTapRef = useRef<{ key: string; at: number } | null>(null);



const [answers, setAnswers] = useState<Record<string, string>>({});

const finishedRef = useRef(false);

const finishTest = async (reason: "time" | "completed") => {
  if (finishedRef.current) return;
  finishedRef.current = true;

  const a = attemptRef.current;

  // If we somehow don't have an attempt, do NOT go to results (results needs attemptId)
  if (!a?.attemptId) {
    router.replace(routeBase); // send them back to the test start
    return;
  }

  // close attempt before leaving (optional but good)
await attemptStore.closeAttemptById(a.attemptId, { remainingSec: hasTimer ? timeLeft : 0 });

  const limitSeconds = hasTimer ? timeLimitMinutes * 60 : 0;
  const usedSeconds = hasTimer
  ? Math.min(limitSeconds, Math.max(0, limitSeconds - timeLeft))
  : 0;


  const params = new URLSearchParams({
    attemptId: a.attemptId,
    reason,
    usedSeconds: String(usedSeconds),
    limitSeconds: String(limitSeconds),
  });

  // IMPORTANT: routeBase must start with "/" (ex: "/test/real" or "/real-test")
  router.push(`${routeBase}/results?${params.toString()}`);
};



const [attempt, setAttempt] = useState<TestAttemptV1 | null>(null);


  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
const ds = await loadDataset(datasetId);
if (!mounted) return;

// If auth is still loading, don't create attempts yet.
if (authLoading) {
  setLoading(true);
  return;
}

let poolIds = ds.map((q) => q.id);

if (modeKey === "bookmarks-test") {
  poolIds = Array.from(bookmarkedSet);
}

if (modeKey === "mistakes-test") {
  const mistakeIds = compileMistakeIds(
    ds,
    await attemptStore.listAttempts(userKey, datasetId),
    clearedMistakesSet
  );
  poolIds = mistakeIds;
}

if (modeKey === "topics-test") {
  // Pull weakest-topic quiz tags from localStorage (set from Stats page)
  const ids = compileTopicQuizIds(ds, questionCount);

  // ✅ never allow empty pool (keeps your emptyMsg as a “true” safety only)
  poolIds = ids.length ? ids : ds.map((q) => q.id);
}


// ✅ Preflight gate ONLY if there is no resumable attempt (so resume is always allowed)
const existing = await attemptStore.listAttempts(userKey, datasetId);
const hasResumable = existing.some(
  (t) =>
    t.modeKey === modeKey &&
    t.datasetVersion === datasetVersion &&
    (t.status === "in_progress" || t.status === "paused")
);

if (enforceCaps && !hasResumable && !canStartExam(userKey, { requiredQuestions: required })) {
  router.replace(`/premium?next=${encodeURIComponent(routeBase)}`);
  return;
}

if (poolIds.length === 0) {
  setAttempt(null);
  setItems([]);
  setLoading(false);
  return;
}

const effectiveCount = Math.min(questionCount, poolIds.length);


const { attempt: a, reused } = await attemptStore.getOrCreateAttempt({
  userKey,
  modeKey,
  datasetId,
  datasetVersion,
  allQuestionIds: poolIds,
  questionCount: effectiveCount,
  timeLimitSec: hasTimer ? timeLimitMinutes * 60 : 0,
});

// Only block *new* starts. Allow resuming even if cap is hit.
if (!reused) {
  if (enforceCaps && !canStartExam(userKey, { requiredQuestions: required })) {
    router.replace(`/premium?next=${encodeURIComponent(routeBase)}`);
    return;
  }
  if (enforceCaps) incrementExamStart(userKey);
}




// Build the picked subset in the frozen random order
const byId = new Map(ds.map((q) => [q.id, q] as const));

let picked = a.questionIds
  .map((id) => byId.get(id))
  .filter(Boolean) as Question[];

// Safety: never allow empty picked set
if (picked.length === 0) {
  picked = ds.slice(0, effectiveCount);
}

setAttempt(a);
setItems(picked);


// Restore timer from attempt storage (prevents refresh extending time)
if (hasTimer) {
  setTimeLeft(a.remainingSec);
  endAtRef.current = Date.now() + a.remainingSec * 1000;
} else {
  setTimeLeft(0);
  endAtRef.current = 0;
}



// Restore answers into your existing UI answers state
const restored: Record<string, string> = {};
for (const [qid, rec] of Object.entries(a.answersByQid)) {
  restored[qid] = rec.choice;
}
setAnswers(restored);

// Resume to next unanswered
const nextIdx = computeNextUnansweredIndex(a);
setIndex(Math.min(nextIdx, Math.max(0, picked.length - 1)));

setSelectedKey(null);
setLoading(false);

    })();

    return () => {
      mounted = false;
    };
  }, [
  modeKey,
  datasetId,
  datasetVersion,
  questionCount,
  timeLimitMinutes,
  preflightRequiredQuestions,
  authLoading,
  userKey,
  router,
  routeBase,
  clearedMistakesSet,
  bookmarkedSet,
]);


useEffect(() => {
  if (attempt) return;

  if (!hasTimer) {
    endAtRef.current = 0;
    setTimeLeft(0);
    return;
  }

  endAtRef.current = Date.now() + timeLimitMinutes * 60 * 1000;
  setTimeLeft(timeLimitMinutes * 60);
}, [datasetId, timeLimitMinutes, attempt, hasTimer]);




  // countdown
useEffect(() => {
  if (!hasTimer) return;

  const tick = () => {
    const left = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
    setTimeLeft(left);
  };

  tick();
  const id = window.setInterval(tick, 250);
  return () => window.clearInterval(id);
}, [hasTimer, datasetId, timeLimitMinutes]);


useEffect(() => {
  if (!hasTimer) return;
  if (loading) return;
  if (items.length === 0) return;

  if (timeLeft <= 0) {
    void finishTest("time");
  }
}, [hasTimer, timeLeft, loading, items.length]);
 // intentionally NOT including finishTest

useEffect(() => {
  finishedRef.current = false;
  advancingRef.current = false;
  lastTapRef.current = null;
}, [datasetId, datasetVersion]);

const attemptRef = useRef<TestAttemptV1 | null>(null);
useEffect(() => {
  attemptRef.current = attempt;
}, [attempt]);

const lastPersistRef = useRef(0);

useEffect(() => {
  if (loading) return;

  const a = attemptRef.current;
  if (!a?.attemptId) return;
  if (a.status === "submitted" || a.status === "expired") return;

  const now = Date.now();
  // throttle: persist at most once every 3 seconds
  if (now - lastPersistRef.current < 3000) return;
  lastPersistRef.current = now;

  const patched: TestAttemptV1 = {
    ...a,
    remainingSec: hasTimer ? timeLeft : 0,
    lastActiveAt: now,
  };

  attemptRef.current = patched;
  void attemptStore.writeAttempt(patched);
}, [timeLeft, loading, hasTimer]);


useEffect(() => {
  return () => {
    const a = attemptRef.current;
    if (!a?.attemptId) return;
    if (a.status === "submitted" || a.status === "expired") return;

    const now = Date.now();
    const paused: TestAttemptV1 = {
      ...a,
      status: "paused",
      pausedAt: now,
      lastActiveAt: now,
      remainingSec: hasTimer ? timeLeft : 0,
    };

    attemptRef.current = paused;
    // fire-and-forget persist
    void attemptStore.writeAttempt(paused);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [timeLeft]);


const item = items[index];
const imageAsset = item?.assets?.find((a) => a.kind === 'image');

useEffect(() => {
  if (items.length > 0 && index >= items.length) {
    setIndex(items.length - 1);
  }
}, [items.length, index]);

// ✅ prevent lastTapRef carryover between questions (avoids accidental auto-advance)
useEffect(() => {
  lastTapRef.current = null;
}, [item?.id, index]);



const correctCount = useMemo(() => {
  let correct = 0;

  for (const q of items) {
    const chosenKey = answers[q.id];
    if (!chosenKey) continue;

    if (q.type === 'ROW') {
      const chosen = normalizeRowChoice(chosenKey);
      const expected = normalizeRowChoice(q.correctRow ?? null);
      if (chosen && expected && chosen === expected) correct += 1;
      continue;
    }

    // MCQ
    const chosenOpt = q.options.find((opt, idx) => {
      const k = opt.originalKey ?? String.fromCharCode(65 + idx);
      return k === chosenKey;
    });

    if (chosenOpt && q.correctOptionId && chosenOpt.id === q.correctOptionId) {
      correct += 1;
    }
  }

  return correct;
}, [items, answers]);



const commitAndAdvance = async (choiceKey: string) => {
  if (!items.length || !item) return;
  if (!choiceKey) return;
  if (advancingRef.current) return;

  advancingRef.current = true;

  try {
    const now = Date.now();

    setAnswers((prev) => (prev[item.id] === choiceKey ? prev : { ...prev, [item.id]: choiceKey }));

    const base = attemptRef.current;
if (base) {
  const updated: TestAttemptV1 = {
    ...base,
    status: "in_progress",
    lastActiveAt: now,
    remainingSec: hasTimer ? timeLeft : 0, // 👈 keep it consistent
    answersByQid: {
      ...base.answersByQid,
      [item.id]: { choice: choiceKey, answeredAt: now },
    },
  };

  attemptRef.current = updated;   // 👈 important
  setAttempt(updated);            // keep UI in sync
  await attemptStore.writeAttempt(updated);
}


const next = index + 1;

if (next >= items.length) {
  void finishTest("completed");
  return;
}


setIndex(next);

  } finally {
    setTimeout(() => {
      advancingRef.current = false;
    }, 0);
  }
};

const skipAndAdvance = async () => {
  if (!items.length || !item) return;
  if (advancingRef.current) return;

  advancingRef.current = true;

  try {
    const now = Date.now();

    // Mark as "answered" but with empty choice => counts as skipped.
    setAnswers((prev) => (prev[item.id] === "" ? prev : { ...prev, [item.id]: "" }));

    const base = attemptRef.current;
    if (base) {
      const updated: TestAttemptV1 = {
        ...base,
        status: "in_progress",
        lastActiveAt: now,
        remainingSec: hasTimer ? timeLeft : 0,
        answersByQid: {
          ...base.answersByQid,
          [item.id]: { choice: "", answeredAt: now }, // ✅ skip record
        },
      };

      attemptRef.current = updated;
      setAttempt(updated);
      await attemptStore.writeAttempt(updated);
    }

    const next = index + 1;
    if (next >= items.length) {
      void finishTest("completed");
      return;
    }

    setIndex(next);
  } finally {
    setTimeout(() => {
      advancingRef.current = false;
    }, 0);
  }
};

useEffect(() => {
  // rapid mode only
  if (!showAutoAdvance) {
  setAutoLeft(null);
  return;
}

  if (loading) {
    setAutoLeft(null);
    return;
  }
  if (!item?.id) {
    setAutoLeft(null);
    return;
  }
  if (finishedRef.current) {
    setAutoLeft(null);
    return;
  }

  const endAt = Date.now() + autoAdvanceMs;

  const tick = () => {
    const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    setAutoLeft(left);
  };

  tick();
  const intervalId = window.setInterval(tick, 250);

  const timeoutId = window.setTimeout(() => {
    if (finishedRef.current) return;
    if (advancingRef.current) return;

    const key = selectedKeyRef.current;
    if (key) void commitAndAdvance(key);
    else void skipAndAdvance();
  }, autoAdvanceMs);

  return () => {
    window.clearInterval(intervalId);
    window.clearTimeout(timeoutId);
  };
}, [showAutoAdvance, autoAdvanceMs, loading, item?.id, index]);
 // ✅ do NOT include selectedKey


const DOUBLE_MS = 250;

const onOptionTap = (key: string) => {
  const now = Date.now();
  const last = lastTapRef.current;

  // 1) If tapping a DIFFERENT option => select it (preview)
  if (selectedKey !== key) {
    lastTapRef.current = { key, at: now };
    setSelectedKey(key);
    return;
  }

  // 2) Same option tapped again:
  //    Fast repeat => confirm + advance
  if (last && last.key === key && now - last.at < DOUBLE_MS) {
    lastTapRef.current = null;
    void commitAndAdvance(key);
    return;
  }

  // 3) Slow repeat => toggle OFF (unselect)
  lastTapRef.current = null;
  setSelectedKey(null);
};


useEffect(() => {
  if (!item?.id) return;

  // Build sig FIRST (so TS is happy, and so debounce works)
  const viewSig = `${modeKey}:${datasetId}:${datasetVersion}:${attempt?.attemptId ?? "na"}:${index}:${item.id}`;

  // Block showing the 421st question
  if (enforceCaps && !canShowQuestion(userKey)) {
  router.replace(`/premium?next=${encodeURIComponent(routeBase)}`);
  return;
}
  // Count on DISPLAY (even if unanswered, even if repeated later)
  if (enforceCaps) markQuestionShown(userKey, viewSig);

}, [
  item?.id,
  userKey,
  datasetId,
  datasetVersion,
  attempt?.attemptId,
  index,
  router,
  routeBase,
  enforceCaps,
  modeKey,
  

]);



useEffect(() => {
  if (!item) return;
  setSelectedKey(answers[item.id] ?? null);
}, [item?.id, answers]);


  const progressPct = useMemo(() => {
    if (!items.length) return 0;
    return ((index + 1) / items.length) * 100;
  }, [index, items.length]);


  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.frame}>
          <div className={styles.loading}>Loading…</div>
        </div>
      </main>
    );
  }

  const emptyMsg =
  modeKey === "bookmarks-test"
    ? "No bookmarks yet. Bookmark questions first — then come back to practice them here."
    : modeKey === "mistakes-test"
    ? "No mistakes yet. Take a test first — then come back to retest and clear them by answering correctly."
    : modeKey === "topics-test"
    ? "No questions found for your weakest topics. Please make sure you've taken some tests and have weak topics to practice."
    : "No questions found.";


if (!item) {
  const msg = items.length === 0 ? emptyMsg : "Loading…";

  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <BackButton />
        <div className={styles.loading}>{msg}</div>
      </div>
    </main>
  );
}



  return (
  <main className={styles.page}>
    <div className={styles.frame}>
      {/* Top bar */}
      <div className={styles.topBar}>
        {/* LEFT: Back */}
        <div className={styles.topLeft}>
          <BackButton />
        </div>

        {/* CENTER: Progress (moved here, same markup you already had) */}
        <div className={styles.progressInline}>
          <div className={styles.progressTrack} aria-hidden="true">
            <div
              className={styles.progressFill}
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className={styles.progressText}>
            {currentNo}/{total}
          </div>
        </div>

        {/* RIGHT: Timer (your existing code unchanged) */}
        <div className={styles.topRight}>
          <div className={styles.topRightStack}>
            {hasTimer ? (
              <div className={styles.timer}>
                <span className={styles.timerIcon} aria-hidden="true" />
                <span className={styles.timerText}>{formatTime(timeLeft)}</span>
              </div>
            ) : (
              <div className={styles.timer}>
                <span className={styles.timerIcon} aria-hidden="true" />
                <span className={styles.timerText}>No time limit</span>
              </div>
            )}

            {/* ✅ Rapid-only auto-advance countdown */}
            {showAutoAdvance && (
              <div className={styles.timer}>
                <span className={styles.timerIcon} aria-hidden="true" />
                <span className={styles.timerText}>
                  Next in {autoLeft ?? autoAdvanceSeconds}s
                </span>
              </div>
            )}
          </div>
        </div>
      </div>



        {/* Question row (with bookmark icon on the right) */}
        <div className={styles.questionRow}>
          <p className={styles.questionText}>{item.prompt}</p>

          <button
            type="button"
            className={styles.bookmarkBtn}
            onClick={(e) => {
              e.stopPropagation();
              toggle(item.id);
            }}
            aria-label={isBookmarked(item.id) ? 'Remove bookmark' : 'Add bookmark'}
            title={isBookmarked(item.id) ? 'Bookmarked' : 'Bookmark'}
            data-bookmarked={isBookmarked(item.id) ? 'true' : 'false'}
          >
            <span className={styles.bookmarkIcon} aria-hidden="true" />
          </button>
        </div>

        {/* Image (if exists) */}
        {imageAsset && (
  <div className={styles.imageWrap}>
    <Image
      src={imageAsset.src}
      alt="Question image"
      fill
      className={styles.image}
      priority
      unoptimized
    />
  </div>
)}


{/* Answers */}
<div className={styles.answers}>
  {item.type === 'ROW' && (
  <>
    <button
      type="button"
      className={`${styles.optionBtn} ${styles.rowBtn} ${
        selectedKey === 'R' ? styles.optionActive : ''
      }`}
      onClick={() => onOptionTap('R')}
    >
      <span className={styles.optionText}>Right</span>
    </button>

    <button
      type="button"
      className={`${styles.optionBtn} ${styles.rowBtn} ${
        selectedKey === 'W' ? styles.optionActive : ''
      }`}
     onClick={() => onOptionTap('W')}
    >
      <span className={styles.optionText}>Wrong</span>
    </button>
  </>
)}
  {item.type === 'MCQ' &&
  item.options.map((opt, idx) => {
    const key = opt.originalKey ?? String.fromCharCode(65 + idx);
    const active = selectedKey === key;

    return (
      <button
        key={opt.id}
        type="button"
        className={`${styles.optionBtn} ${active ? styles.optionActive : ''}`}
        onClick={() => onOptionTap(key)}
      >
        <span className={styles.optionKey}>{key}.</span>
        <span className={styles.optionText}>{opt.text}</span>
      </button>
    );
  })}
</div>

        {/* Next */}
        <button
          type="button"
          className={styles.nextBtn}
          onClick={() => selectedKey && void commitAndAdvance(selectedKey)}
          disabled={!selectedKey}
        >
          Next <span className={styles.nextArrow} aria-hidden="true">→</span>
        </button>
      </div>
    </main>
  );
}
