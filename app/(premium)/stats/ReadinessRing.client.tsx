//app/(premium)/stats/ReadinessRing.client.tsx

'use client';

import styles from './stats.module.css';
import { useOnceInView } from '@/components/stats/useOnceInView.client';
import { useBootSweepOnce } from '@/components/stats/useBootSweepOnce.client';

export default function ReadinessRing(props: {
  valuePct: number;          // final readiness 0..100
  enabled: boolean;          // gate until data ready (e.g., !loading && questions loaded)
  c1?: string;
  c2?: string;
}) {
  const {
  valuePct,
  enabled,
  c1 = 'rgba(255, 197, 66, 0.4)', // yellow first
  c2 = 'rgba(43, 124, 175, 0.4)', // blue second
} = props;


  const { ref, seen } = useOnceInView<HTMLDivElement>(0.35);
  const pctFloat = useBootSweepOnce({
  target: valuePct,
  seen,
  enabled,
  segments: (target) => {
    const gap = Math.abs(100 - target);
    const settleMs = gap < 10 ? 500 : 900;

    return [
      { from: 0, to: 100, durationMs: 450, ease: (t) => 1 - Math.pow(1 - t, 3) }, // easeOutCubic
      { from: 100, to: target, durationMs: settleMs, ease: (t) => 1 - Math.pow(1 - t, 3) },
    ];
  },
});


  const pct = Math.round(pctFloat);
  const fillDeg = (pctFloat / 100) * 360;

  return (
    <div ref={ref} className={styles.statsGaugeWrapper}>
      <div
        className={styles.statsGaugeCircleOuter}
        style={{
          transform: 'scaleX(-1)',
          background: `conic-gradient(
  from 0deg,
  ${c1} 0deg,
  ${c2} ${fillDeg}deg,
  var(--stats-ring-track) ${fillDeg}deg,
  var(--stats-ring-track) 360deg
)`,

        }}
        aria-label={`License Exam Readiness ${pct}%`}
      >
        <div
          className={styles.statsGaugeCircleInner}
          style={{ transform: 'scaleX(-1)' }}
        >
          <div className={styles.statsGaugeNumber}>{pct}</div>
          <div className={styles.statsGaugeLabel}>
            License Exam
            <br />
            Readiness
          </div>
        </div>
      </div>
    </div>
  );
}
