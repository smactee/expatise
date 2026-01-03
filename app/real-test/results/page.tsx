'use client';

import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './results.module.css';

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function RealTestResultsPage() {
  const router = useRouter();
  const sp = useSearchParams();

  // For now, pull basic numbers from query params (safe defaults match your mock)
  const score = Number(sp.get('score') ?? '50');
  const total = Number(sp.get('total') ?? '100');
  const timeMin = Number(sp.get('timeMin') ?? '40');

  const pct = useMemo(() => {
    const t = Number.isFinite(total) && total > 0 ? total : 100;
    const s = Number.isFinite(score) ? score : 0;
    return clamp(s / t, 0, 1);
  }, [score, total]);

  // Demo content to match the screenshot layout (swap with real data later)
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

  return (
    <div className={styles.viewport}>
      <main className={styles.screen}>
        {/* Background card (full screen) */}
        <div className={styles.card} />

        {/* Status bar is ignored visually in web build; your design has it, but we keep spacing. */}

        {/* Back row (Frame 2793) */}
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

        {/* Title */}
        <h1 className={styles.congrats}>Congratulation!</h1>

        {/* Radial ring */}
        <div className={styles.ringWrap} aria-label="Score progress">
          <div
            className={styles.ring}
            style={
              {
                // conic progress, remainder is track
                '--p': `${pct * 360}deg`,
              } as React.CSSProperties
            }
          />
          <div className={styles.ringCenterText}>You Win</div>
        </div>

        {/* Score/Time row container + divider lines */}
        <div className={styles.scoreBox} aria-hidden="true">
          <div className={styles.lineTop} />
          <div className={styles.lineBottom} />
          <div className={styles.lineMid} />

          <div className={styles.scoreLeft}>
            <div className={styles.scoreValue}>
              {Number.isFinite(score) ? score : 0}/{Number.isFinite(total) ? total : 100}
            </div>
            <div className={styles.scoreLabel}>Results</div>
          </div>

          <div className={styles.scoreRight}>
            <div className={styles.scoreValue}>{Number.isFinite(timeMin) ? timeMin : 0}Min</div>
            <div className={styles.scoreLabel}>Time</div>
          </div>
        </div>

        {/* Test Results title */}
        <div className={styles.testResultsTitle}>Test Results</div>

        {/* Incorrect row */}
        <div className={styles.incorrectRow}>
          <div className={styles.xIcon} aria-hidden="true">
            <span className={styles.xStroke1} />
            <span className={styles.xStroke2} />
          </div>
          <div className={styles.incorrectText}>Incorrect</div>
        </div>

        {/* Question */}
        <div className={styles.question}>{question}</div>

        {/* Small image placeholder (your design uses an image asset). Replace later with <Image />. */}
        <div className={styles.qImage} aria-hidden="true" />

        {/* Options */}
        <div className={styles.optA}>{a}</div>
        <div className={styles.optB}>{b}</div>
        <div className={styles.optC}>{c}</div>
        <div className={styles.optD}>{d}</div>

        {/* Explanation */}
        <div className={styles.exTitle}>{explanationTitle}</div>
        <div className={styles.exBody}>{explanation}</div>

        {/* Continue button */}
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

        {/* Home indicator */}
        <div className={styles.homeIndicator} aria-hidden="true" />
      </main>
    </div>
  );
}
