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

function getQuestionNumber(q: any): number {
  // 1) prefer q.number (can be number OR string)
  const raw = q?.number;

  const fromNumber = Number(raw);
  if (Number.isFinite(fromNumber) && fromNumber > 0) return Math.floor(fromNumber);

  // 2) fallback: extract digits from id (q0231 -> 231)
  const idStr = String(q?.id ?? "");
  const idMatch = idStr.match(/\d+/);
  if (idMatch) {
    const n = parseInt(idMatch[0], 10);
    if (Number.isFinite(n) && n > 0) return n;
  }

  // 3) last resort: 0 (means “unknown”)
  return 0;
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
  testNo: number;
  prompt: string;
  imageSrc?: string;
  options: { key: string; text: string; tone: "neutral" | "correct" | "wrong" }[];
  explanation?: string;
};

const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});


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

      for (let i = 0; i < picked.length; i++) {
  const q = picked[i];
  const testNo = i + 1;          // ✅ position in THIS test
  const bankNo = getQuestionNumber(q); // ✅ global/bank number

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
// Prepare review items (WRONG ONLY)
const items: ReviewItem[] = [];

for (let i = 0; i < picked.length; i++) {
  const q = picked[i];
  const testNo = i + 1;

  const chosenKey = a.answersByQid[q.id]?.choice ?? null;
  const qType = String((q as any).type ?? "").toUpperCase();

  // image
  const assets = (q as any).assets;
  const imageAsset = Array.isArray(assets)
    ? assets.find((a: any) => a?.kind === "image" && typeof a?.src === "string")
    : null;
  const imageSrc = imageAsset?.src as string | undefined;

  // -------------------------
  // 1) ROW questions (Right/Wrong)
  // -------------------------
  if (qType === "ROW") {
    const correctRow = normalizeRowChoice((q as any).correctRow ?? null);
    const chosenRow = normalizeRowChoice(chosenKey);

    const isCorrect = !!(chosenRow && correctRow && chosenRow === correctRow);
    if (isCorrect) continue; // show only WRONG

    const options: ReviewItem["options"] = [
      {
        key: "R",
        text: "R. Right",
        tone:
          correctRow === "R"
            ? "correct"
            : chosenRow === "R"
            ? "wrong"
            : "neutral",
      },
      {
        key: "W",
        text: "W. Wrong",
        tone:
          correctRow === "W"
            ? "correct"
            : chosenRow === "W"
            ? "wrong"
            : "neutral",
      },
    ];

    items.push({
      qid: (q as any).id,
      testNo,
      prompt: (q as any).prompt,
      imageSrc,
      options,
      explanation: (q as any).explanation,
    });

    continue;
  }

  // -------------------------
  // 2) MCQ questions
  // -------------------------
  const correctOptionId = (q as any).correctOptionId as string | undefined;
  const opts = Array.isArray((q as any).options) ? (q as any).options : [];

  const chosenOpt =
    chosenKey
      ? opts.find((opt: any, idx: number) => {
          const k = opt?.originalKey ?? String.fromCharCode(65 + idx);
          return k === chosenKey;
        })
      : null;

  const isCorrect = !!(chosenOpt && correctOptionId && chosenOpt.id === correctOptionId);
  if (isCorrect) continue; // show only WRONG

  const correctIndex = opts.findIndex((opt: any) => opt?.id === correctOptionId);
  const correctKey =
    correctIndex >= 0
      ? (opts[correctIndex].originalKey ?? String.fromCharCode(65 + correctIndex))
      : null;

  const options: ReviewItem["options"] = opts.map((opt: any, idx: number) => {
    const key = opt?.originalKey ?? String.fromCharCode(65 + idx);
    const text = `${key}. ${opt?.text ?? ""}`;

    let tone: "neutral" | "correct" | "wrong" = "neutral";
    if (correctKey && key === correctKey) tone = "correct";
    if (chosenKey && key === chosenKey && key !== correctKey) tone = "wrong";

    return { key, text, tone };
  });

  items.push({
    qid: (q as any).id,
    testNo,
    prompt: (q as any).prompt,
    imageSrc,
    options,
    explanation: (q as any).explanation,
  });
}

setBrokenImages({});
items.sort((a, b) => a.testNo - b.testNo);
setReviewItems(items);




    })();
  }, [attemptId]);

  const pct = useMemo(() => {
    const t = computed.total > 0 ? computed.total : 1;
    return clamp(computed.correct / t, 0, 1);
  }, [computed.correct, computed.total]);

  const percent = useMemo(() => Math.round(pct * 100), [pct]);


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
    <p className={styles.question}>Expatise! No incorrect questions! 🎉</p>
  ) : (
    reviewItems.map((item, idx) => (
      <article key={item.qid} style={{ marginBottom: 18 }}>
       <p className={styles.question}>
  {item.testNo}. {item.prompt}
</p>

<div className={styles.qaRow}>
  {item.imageSrc && !brokenImages[item.qid] ? (
    <div className={styles.imageWrap}>
      <Image
        src={item.imageSrc}
        alt="Question image"
        fill
        sizes="120px"
        className={styles.image}
        unoptimized
        onError={() => setBrokenImages((p) => ({ ...p, [item.qid]: true }))}
      />
    </div>
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
</div>


        {(item.explanation ?? "").trim().length > 0 && (
  <>
    <div className={styles.exTitle}>Explanation:</div>
    <div className={styles.exBody}>{item.explanation}</div>
  </>
)}

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
