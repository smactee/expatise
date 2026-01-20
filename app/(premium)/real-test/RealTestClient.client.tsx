// app/real-test/RealTestClient.client.tsx

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

import styles from './real-test.module.css';

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

console.log("USING RealTestClient from app/(premium)/real-test");



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




export default function AllTestClient({
  modeKey,
  datasetId,
  datasetVersion,
  questionCount,
  timeLimitMinutes,
  preflightRequiredQuestions,
  routeBase,
}: {
  modeKey: string;
  datasetId: DatasetId;
  datasetVersion: string;
  questionCount: number;
  timeLimitMinutes: number;
  preflightRequiredQuestions?: number;
  routeBase: string;
}) {

  console.log("[RealTestClient] mounted", {
    modeKey,
    routeBase,
    questionCount,
    timeLimitMinutes,
  });


  const router = useRouter();

  const required = preflightRequiredQuestions ?? questionCount;

  const hasTimer = timeLimitMinutes > 0;


  const [items, setItems] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  

  const [index, setIndex] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const total = items.length || questionCount;
  const currentNo = Math.min(index + 1, total);

  const [timeLeft, setTimeLeft] = useState(hasTimer ? timeLimitMinutes * 60 : 0);
  const endAtRef = useRef<number>(hasTimer ? Date.now() + timeLimitMinutes * 60 * 1000 : 0);

const { isPremium } = useEntitlements();
const enforceCaps = !isPremium; // premium users should not hit free caps


const { loading: authLoading, email } = useAuthStatus();
const userKey = normalizeUserKey(email ?? "") || "guest";

const { toggle, isBookmarked } = useBookmarks(datasetId, userKey);

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

const allIds = ds.map((q) => q.id);

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



const { attempt: a, reused } = await attemptStore.getOrCreateAttempt({
  userKey,
  modeKey,
  datasetId,
  datasetVersion,
  allQuestionIds: allIds,
  questionCount,
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
const picked = a.questionIds.map((id) => byId.get(id)).filter(Boolean) as Question[];

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

const advancingRef = useRef(false);

// More reliable than e.detail: works even if state hasn’t re-rendered yet
const lastTapRef = useRef<{ key: string; at: number } | null>(null);

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


const onOptionTap = (key: string) => {
  const now = Date.now();
  const last = lastTapRef.current;

  // If same option tapped twice quickly -> auto next
  if (last && last.key === key && now - last.at < 450) {
    lastTapRef.current = null;
    void commitAndAdvance(key);
    return;
  }

  lastTapRef.current = { key, at: now };
  setSelectedKey(key);
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

  if (!item) {
    return (
      <main className={styles.page}>
        <div className={styles.frame}>
          <div className={styles.loading}>No questions found.</div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <BackButton />
        {/* Top bar */}
        <div className={styles.topBar}>
<div className={styles.topLeftSpacer} aria-hidden="true" />
          <div className={styles.topRight}>
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


          </div>
        </div>

        {/* Progress row */}
        <div className={styles.progressRow}>
          <div className={styles.progressTrack} aria-hidden="true">
            <div
              className={styles.progressFill}
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className={styles.progressText}>{currentNo}/{total}</div>
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
            {/* NOTE: this is where your class rename matters */}
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
          onClick={(e) => {
  // first click selects
  if (selectedKey !== key) {
    setSelectedKey(key);
    return;
  }

  // second click on same option advances
  // e.detail is 1,2,3... for click count (works great on desktop)
  if (e.detail >= 2) {
   void commitAndAdvance(key);
  }
}}

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
