/* app/real-test/results/page.tsx */
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './results.module.css';
import Image from 'next/image';

import { loadDataset } from '../../../lib/qbank/loadDataset';
import type { DatasetId } from '../../../lib/qbank/datasets';
import type { Question } from '../../../lib/qbank/types';
import { readAttemptById, type TestAttemptV1 } from '../../../lib/test-engine/attemptStorage';

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalizeRowChoice(v: string | null | undefined): 'R' | 'W' | null {
  if (!v) return null;
  const t = v.trim().toLowerCase();
  if (t === 'r' || t === 'right') return 'R';
  if (t === 'w' || t === 'wrong') return 'W';
  return null;
}

export default function RealTestResultsPage() {
  const router = useRouter();
  const sp = useSearchParams();

  // ✅ Option B: Results is driven by attemptId
  const attemptId = sp.get('attemptId');

// Your real-test currently pushes usedSeconds/limitSeconds
const usedSecondsRaw = Number(sp.get('usedSeconds') ?? '0');
const usedSeconds = Number.isFinite(usedSecondsRaw) && usedSecondsRaw > 0
  ? Math.floor(usedSecondsRaw)
  : 0;

const timeMin = Math.floor(usedSeconds / 60);
const timeSec = usedSeconds % 60;

const timeText = `${timeMin}min ${timeSec}sec`;


  const [attempt, setAttempt] = useState<TestAttemptV1 | null>(null);
  const [computed, setComputed] = useState<{ correct: number; total: number }>({
    correct: 0,
    total: 0,
  });
  

  type ReviewItem = {
  qid: string;
  prompt: string;
  imageSrc?: string;
  options: { key: string; text: string; tone: "neutral" | "correct" | "wrong" }[];
  explanation?: string;
};

const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);


  useEffect(() => {
    if (!attemptId) return;

    const a = readAttemptById(attemptId);
    setAttempt(a);

    if (!a) return;

    (async () => {
      const ds = await loadDataset(a.datasetId as DatasetId);
      const byId = new Map(ds.map((q) => [q.id, q] as const));

      // Keep the attempt's frozen random order
      const picked = a.questionIds.map((id) => byId.get(id)).filter(Boolean) as Question[];

      // Compute score using attempt answers
      let correct = 0;

      for (const q of picked) {
        const chosenKey = a.answersByQid[q.id]?.choice ?? null;

        // Your rule: unanswered at timeout = wrong
        // Score counts only correct; total remains full picked length
        if (!chosenKey) continue;

        if (q.type === 'ROW') {
          const chosen = normalizeRowChoice(chosenKey);
          const expected = normalizeRowChoice((q as any).correctRow ?? null);
          if (chosen && expected && chosen === expected) correct += 1;
          continue;
        }

        // MCQ
        const chosenOpt = q.options.find((opt, idx) => {
          const k = opt.originalKey ?? String.fromCharCode(65 + idx);
          return k === chosenKey;
        });

        if (chosenOpt && (q as any).correctOptionId && chosenOpt.id === (q as any).correctOptionId) {
          correct += 1;
        }
      }

      setComputed({ correct, total: picked.length });
      // Prepare review items (simple version: first incorrect only)
      const items: ReviewItem[] = [];

for (const q of picked) {
  const chosenKey = a.answersByQid[q.id]?.choice ?? null;

  // Find correct option key for MCQ
  if (q.type !== "ROW") {
    const correctOptionId = (q as any).correctOptionId as string | undefined;

    const correctIndex = q.options.findIndex(opt => opt.id === correctOptionId);
    const correctKey =
      correctIndex >= 0
        ? (q.options[correctIndex].originalKey ?? String.fromCharCode(65 + correctIndex))
        : null;

    const isCorrect = chosenKey && correctKey && chosenKey === correctKey;

    // If you only want WRONG questions on results page:
    if (isCorrect) continue;

    const options = q.options.map((opt, idx) => {
      const key = opt.originalKey ?? String.fromCharCode(65 + idx);
      const text = `${key}. ${opt.text}`;

      let tone: "neutral" | "correct" | "wrong" = "neutral";
      if (correctKey && key === correctKey) tone = "correct";
      if (chosenKey && key === chosenKey && key !== correctKey) tone = "wrong";

      return { key, text, tone };
    });

const imageAsset = q.assets?.find((a: any) => a.kind === "image");

// Use ONLY .src (same as real-test)
const imageSrc = imageAsset?.src;


    items.push({
      qid: q.id,
      prompt: q.prompt,
      imageSrc,
      options,
      explanation: q.explanation, // optional future field
    });
  }

  // ROW questions can be added later similarly (R/W)
}

console.log(
  "RESULTS image src sample:",
  items.slice(0, 5).map((i) => ({ qid: i.qid, imageSrc: i.imageSrc }))
);


setReviewItems(items);

    })();
  }, [attemptId]);

  const pct = useMemo(() => {
    const t = computed.total > 0 ? computed.total : 1;
    return clamp(computed.correct / t, 0, 1);
  }, [computed.correct, computed.total]);

  const percent = useMemo(() => Math.round(pct * 100), [pct]);


  // Demo content to match your screenshot layout (keep this mock for now)
  const question =
    sp.get('q') ??
    'When skidding, if the rear end of the car is skidding to the right, turn your wheel to the:';

  const explanationTitle = sp.get('exTitle') ?? 'Explanation:';
  const explanation =
    sp.get('ex') ??
    "When your vehicle begins to skid, especially if the rear end is skidding to the right, you should turn the steering wheel in the direction of the skid (to the right, in this case). This action helps to regain control of the car and align the wheels with the direction of travel. It's crucial not to overcorrect, as that can lead to a counter-skid.";

  const a =
    sp.get('a') ??
    'A. Slowly and safely accelerate while steering in the direction of the skid';
  const b =
    sp.get('b') ??
    'B. Turn your front wheels in the same direction that the rear of the vehicle is sliding';
  const c =
    sp.get('c') ??
    'C. If your car does start to skid, take your foot off the gas, keep both hands on the wheel';
  const d =
    sp.get('d') ??
    'D. Turn your front wheels in the same direction that the rear of the vehicle is sliding';

  // Simple guard: if someone opens results without an attemptId
  if (!attemptId) {
    return (
      <div className={styles.viewport}>
        <main className={styles.screen}>
          <div className={styles.card} />
          <div className={styles.backRow}>
          </div>
          <div style={{ padding: 16 }}>Missing attemptId. Please re-take the test.</div>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.viewport}>
      <main className={styles.screen}>
        <div className={styles.card} />
<div className={styles.shiftUp}>
        <h1 className={styles.congrats}>Congratulations!</h1>

        <div className={styles.ringWrap} aria-label="Score progress">
          <div
            className={styles.ring}
            style={
              {
                '--p': `${pct * 360}deg`,
              } as React.CSSProperties
            }
          />
          <div className={styles.ringCenterText}>{percent}</div>
        </div>

        <div className={styles.scoreBox} aria-hidden="true">
          <div className={styles.lineTop} />
          <div className={styles.lineBottom} />
          <div className={styles.lineMid} />

          <div className={styles.scoreLeft}>
            <div className={styles.scoreValue}>
              {computed.correct}/{computed.total || 0}
            </div>
            <div className={styles.scoreLabel}>Score</div>
          </div>

          <div className={styles.scoreRight}>
            <div className={styles.scoreValue}>{timeText}</div>
            <div className={styles.scoreLabel}>Time</div>
          </div>
        </div>

        <div className={styles.testResultsTitle}>Test Results</div>

        <div className={styles.incorrectRow}>
<Image
    src="/images/test/red-x-icon.png"
    alt="Red X Icon"
    width={24}
    height={24}
    className={styles.btnIcon}
  />
          <div className={styles.incorrectText}>Incorrect</div>
        </div>

<section className={styles.reviewArea}>
  {reviewItems.length === 0 ? (
    <p className={styles.question}>No incorrect questions 🎉</p>
  ) : (
    reviewItems.map((item, idx) => (
      <article key={item.qid} style={{ marginBottom: 18 }}>
        <p className={styles.question}>
          {idx + 1}. {item.prompt}
        </p>

        {item.imageSrc ? (
          <Image
            src={item.imageSrc}
            alt="Question image"
            width={120}
            height={120}
            className={styles.qImage}
          />
        ) : null}

        <div className={styles.options}>
          {item.options.map((o) => (
            <div
              key={o.key}
              className={[
                styles.option,
                o.tone === "correct"
                  ? styles.optionCorrect
                  : o.tone === "wrong"
                  ? styles.optionWrong
                  : styles.optionNeutral,
              ].join(" ")}
            >
              {o.text}
            </div>
          ))}
        </div>

        <div className={styles.exTitle}>Explanation:</div>
        <div className={styles.exBody}>
          {item.explanation ?? "Explanation coming soon."}
        </div>
      </article>
    ))
  )}
</section>



        <button
          type="button"
          className={styles.continueBtn}
          onClick={() => router.push('/real-test')}
        >

          <span className={styles.continueText}>Home</span>
          <Image
    src="/images/other/right-arrow.png"
    alt="Home"
    width={18}
    height={18}
    className={styles.btnIcon}
  />
        </button>
</div>
      </main>
    </div>
  );
}
