'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './results.module.css';

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

  // Your real-test currently pushes usedSeconds/limitSeconds (not timeMin)
  const usedSeconds = Number(sp.get('usedSeconds') ?? '0');
  const timeMin = Math.max(0, Math.round(usedSeconds / 60));

  const [attempt, setAttempt] = useState<TestAttemptV1 | null>(null);
  const [computed, setComputed] = useState<{ correct: number; total: number }>({
    correct: 0,
    total: 0,
  });

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
    })();
  }, [attemptId]);

  const pct = useMemo(() => {
    const t = computed.total > 0 ? computed.total : 1;
    return clamp(computed.correct / t, 0, 1);
  }, [computed.correct, computed.total]);

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
            <button type="button" className={styles.backBtn} onClick={() => router.back()}>
              <span className={styles.backChevron} aria-hidden="true" />
              <span className={styles.backLabel}>Back</span>
            </button>
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

        <div className={styles.backRow}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => router.back()}
            aria-label="Back"
          >
            <span className={styles.backChevron} aria-hidden="true" />
            <span className={styles.backLabel}>Back</span>
          </button>
        </div>

        <h1 className={styles.congrats}>Congratulation!</h1>

        <div className={styles.ringWrap} aria-label="Score progress">
          <div
            className={styles.ring}
            style={
              {
                '--p': `${pct * 360}deg`,
              } as React.CSSProperties
            }
          />
          <div className={styles.ringCenterText}>You Win</div>
        </div>

        <div className={styles.scoreBox} aria-hidden="true">
          <div className={styles.lineTop} />
          <div className={styles.lineBottom} />
          <div className={styles.lineMid} />

          <div className={styles.scoreLeft}>
            <div className={styles.scoreValue}>
              {computed.correct}/{computed.total || 0}
            </div>
            <div className={styles.scoreLabel}>Results</div>
          </div>

          <div className={styles.scoreRight}>
            <div className={styles.scoreValue}>{timeMin}Min</div>
            <div className={styles.scoreLabel}>Time</div>
          </div>
        </div>

        <div className={styles.testResultsTitle}>Test Results</div>

        <div className={styles.incorrectRow}>
          <div className={styles.xIcon} aria-hidden="true">
            <span className={styles.xStroke1} />
            <span className={styles.xStroke2} />
          </div>
          <div className={styles.incorrectText}>Incorrect</div>
        </div>

        <div className={styles.question}>{question}</div>

        <div className={styles.qImage} aria-hidden="true" />

        <div className={styles.optA}>{a}</div>
        <div className={styles.optB}>{b}</div>
        <div className={styles.optC}>{c}</div>
        <div className={styles.optD}>{d}</div>

        <div className={styles.exTitle}>{explanationTitle}</div>
        <div className={styles.exBody}>{explanation}</div>

        <button
          type="button"
          className={styles.continueBtn}
          onClick={() => router.push('/real-test')}
        >
          <span className={styles.continueText}>Continue</span>
          <span className={styles.continueArrow} aria-hidden="true">
            <span className={styles.arrowStem} />
            <span className={styles.arrowHead} />
          </span>
        </button>

        <div className={styles.homeIndicator} aria-hidden="true" />
      </main>
    </div>
  );
}
