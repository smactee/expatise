// app/real-test/RealTestClient.client.tsx

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

import styles from './real-test.module.css';

import { loadDataset } from '../../lib/qbank/loadDataset';
import type { DatasetId } from '../../lib/qbank/datasets';
import type { Question } from '../../lib/qbank/types';
import { useBookmarks } from '../../lib/bookmarks/useBookmarks';
import BackButton from '../../components/BackButton';
import { useAuthStatus } from '../../components/useAuthStatus';
import {
  computeNextUnansweredIndex,
  getOrCreateAttempt,
  normalizeUserKey,
  writeAttempt,
  closeAttemptById,
  type TestAttemptV1,
} from '../../lib/test-engine/attemptStorage';


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




export default function RealTestClient({
  datasetId,
  datasetVersion,
  questionCount,
  timeLimitMinutes,
}: {
  datasetId: DatasetId;
  datasetVersion: string;
  questionCount: number;
  timeLimitMinutes: number;
}) {
  const router = useRouter();

  const [items, setItems] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  

  const [index, setIndex] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const total = items.length || 100;
  const currentNo = Math.min(index + 1, total);

  const [timeLeft, setTimeLeft] = useState(timeLimitMinutes * 60);
  const endAtRef = useRef<number>(Date.now() + timeLimitMinutes * 60 * 1000);


  const { toggle, isBookmarked } = useBookmarks(datasetId);

  const [answers, setAnswers] = useState<Record<string, string>>({});

const finishedRef = useRef(false);

const finishTest = (reason: 'time' | 'completed') => {
  if (finishedRef.current) return;
  finishedRef.current = true;

  // If attempt exists, close it BEFORE leaving this page
  if (attempt?.attemptId) {
    closeAttemptById(attempt.attemptId, { remainingSec: timeLeft });
  }

  if (!attempt) {
    router.push('/real-test/results?reason=' + reason);
    return;
  }

  const limitSeconds = timeLimitMinutes * 60;
  const usedSeconds = Math.min(limitSeconds, Math.max(0, limitSeconds - timeLeft));

  const params = new URLSearchParams({
    attemptId: attempt.attemptId,
    reason,
    usedSeconds: String(usedSeconds),
    limitSeconds: String(limitSeconds),
  });

  router.push(`/real-test/results?${params.toString()}`);
};



const { loading: authLoading, email } = useAuthStatus();
const userKey = normalizeUserKey(email);
const [attempt, setAttempt] = useState<TestAttemptV1 | null>(null);


  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
const ds = await loadDataset(datasetId);
if (!mounted) return;

// If auth is still loading, don't create attempts yet.
if (authLoading) return;

const allIds = ds.map((q) => q.id);

const { attempt: a } = getOrCreateAttempt({
  userKey,
  modeKey: 'real-test',
  datasetId,
  datasetVersion,
  allQuestionIds: allIds,
  questionCount,
  timeLimitSec: timeLimitMinutes * 60,
});

// Build the picked subset in the frozen random order
const byId = new Map(ds.map((q) => [q.id, q] as const));
const picked = a.questionIds.map((id) => byId.get(id)).filter(Boolean) as Question[];

setAttempt(a);
setItems(picked);

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
  }, [datasetId, datasetVersion, questionCount, timeLimitMinutes, authLoading, userKey]);


  useEffect(() => {
  endAtRef.current = Date.now() + timeLimitMinutes * 60 * 1000;
  setTimeLeft(timeLimitMinutes * 60);
}, [datasetId, timeLimitMinutes]);


  // countdown
  useEffect(() => {
  const tick = () => {
    const left = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
    setTimeLeft(left);
  };

  tick(); // run once immediately so UI updates instantly

  const id = window.setInterval(tick, 250);
  return () => window.clearInterval(id);
}, [datasetId, timeLimitMinutes]);

useEffect(() => {
  if (loading) return;
  if (items.length === 0) return;

  if (timeLeft <= 0) {
    finishTest('time');
  }
}, [timeLeft, loading, items.length]); // intentionally NOT including finishTest



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

const commitAndAdvance = (choiceKey: string) => {
  if (!items.length || !item) return;
  if (!choiceKey) return;

  if (advancingRef.current) return;
  advancingRef.current = true;

  const now = Date.now();

  // 1) commit to UI state
  setAnswers((prev) => {
    if (prev[item.id] === choiceKey) return prev;
    return { ...prev, [item.id]: choiceKey };
  });

  // 2) commit to attempt storage (so Results/Stats stay correct)
  if (attempt) {
    const updated: TestAttemptV1 = {
      ...attempt,
      status: 'in_progress',
      lastActiveAt: now,
      answersByQid: {
        ...attempt.answersByQid,
        [item.id]: { choice: choiceKey, answeredAt: now },
      },
    };
    setAttempt(updated);
    writeAttempt(updated);
  }

  // 3) move forward or finish
  const next = index + 1;
  if (next >= items.length) {
    finishTest('completed');
    return;
  }

  setIndex(next);

  // release the guard next tick
  setTimeout(() => {
    advancingRef.current = false;
  }, 0);
};

const onOptionTap = (key: string) => {
  const now = Date.now();
  const last = lastTapRef.current;

  // If same option tapped twice quickly -> auto next
  if (last && last.key === key && now - last.at < 450) {
    lastTapRef.current = null;
    commitAndAdvance(key);
    return;
  }

  lastTapRef.current = { key, at: now };
  setSelectedKey(key);
};


useEffect(() => {
  if (!item) return;
  setSelectedKey(answers[item.id] ?? null);
}, [item?.id, answers]);


  const progressPct = useMemo(() => {
    if (!items.length) return 0;
    return ((index + 1) / items.length) * 100;
  }, [index, items.length]);

  const onNext = () => {
  if (!items.length || !item) return;
  if (!selectedKey) return;

  // 1) commit the answer for the current question
  setAnswers((prev) => {
    // avoid extra renders if unchanged
    if (prev[item.id] === selectedKey) return prev;
    return { ...prev, [item.id]: selectedKey };
  });

if (attempt && item) {
  const now = Date.now();

  const updated: TestAttemptV1 = {
    ...attempt,
    status: 'in_progress',
    lastActiveAt: now,
    answersByQid: {
      ...attempt.answersByQid,
      [item.id]: { choice: selectedKey, answeredAt: now },
    },
  };

  setAttempt(updated);
  writeAttempt(updated);
}


  // 2) move forward or finish
  const next = index + 1;

  if (next >= items.length) {
    // IMPORTANT: finish after committing the last answer
    finishTest('completed');
    return;
  }

  setIndex(next);
  // do NOT manually setSelectedKey(null) here;
  // the "restore selection" effect will set it for the next question.
};


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
            <div className={styles.timer}>
              <span className={styles.timerIcon} aria-hidden="true" />
              <span className={styles.timerText}>{formatTime(timeLeft)}</span>
            </div>
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

          <div className={styles.progressText}>{currentNo}/{items.length}</div>
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
    commitAndAdvance(key);
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
          onClick={() => selectedKey && commitAndAdvance(selectedKey)}
          disabled={!selectedKey}
        >
          Next <span className={styles.nextArrow} aria-hidden="true">→</span>
        </button>
      </div>
    </main>
  );
}
