// app/(premium)/stats/ReadinessRing.client.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './stats.module.css';
import { useOnceInView } from '@/components/stats/useOnceInView.client';
import { useBootSweepOnce } from '@/components/stats/useBootSweepOnce.client';
import InfoTip from '@/components/InfoTip.client';

export default function ReadinessRing(props: {
  valuePct: number;
  enabled: boolean;
  c1?: string;
  c2?: string;

  onDone?: () => void;
}) {
  const {
    valuePct,
    enabled,
    c1 = 'rgba(255, 197, 66, 0.4)',
    c2 = 'rgba(43, 124, 175, 0.4)',
    onDone,
  } = props;

const { ref, seen } = useOnceInView<HTMLDivElement>({
  threshold: 0,
  rootMargin: "0px",
});

// If iOS Safari fails to fire IntersectionObserver, still run after a short delay.
const [forceSeen, setForceSeen] = useState(false);
useEffect(() => {
  if (seen) return;

  // Start next frame instead of waiting 800ms
  const raf = window.requestAnimationFrame(() => setForceSeen(true));
  return () => window.cancelAnimationFrame(raf);
}, [seen]);

const seenReady = seen || forceSeen;

// Clamp + sanitize so CSS gradients never get NaN
const safeTarget =
  Number.isFinite(valuePct) ? Math.max(0, Math.min(100, valuePct)) : 0;

const safeValuePct = Number.isFinite(valuePct) ? valuePct : 0;

  const pctFloat = useBootSweepOnce({
  target: safeTarget,
  seen: seenReady,
  enabled,
  segments: (target) => {

      const gap = Math.abs(100 - target);
      const settleMs = gap < 10 ? 500 : 900;

      return [
        { from: 0, to: 100, durationMs: 450, ease: (t) => 1 - Math.pow(1 - t, 3) },
        { from: 100, to: target, durationMs: settleMs, ease: (t) => 1 - Math.pow(1 - t, 3) },
      ];
    },
  });

const pctSafe = Number.isFinite(pctFloat) ? pctFloat : 0;
const pct = Math.round(pctSafe);
const fillDeg = (pctSafe / 100) * 360;


  // fire onDone once when ring finishes
  const firedRef = useRef(false);
 useEffect(() => {
  firedRef.current = false;
}, [safeTarget, enabled, seenReady]);


  useEffect(() => {
    if (!enabled || !seenReady || !onDone) return;
    if (firedRef.current) return;

    const EPS = 0.01;
    if (Math.abs(pctSafe - safeTarget) <= EPS) {

      firedRef.current = true;
      // tiny delay lets the final frame paint before revealing below content
      window.setTimeout(() => onDone(), 50);
    }
  }, [pctSafe, safeTarget, enabled, seenReady, onDone]);

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
        <div className={styles.statsGaugeCircleInner} style={{ transform: 'scaleX(-1)' }}>
          {/* ✅ always visible (counts up during sweep) */}
          <div className={styles.statsGaugeCenter}>
            <div className={styles.statsGaugeNumber}>{pct}</div>
            <div className={styles.statsGaugeLabel}>
  License Exam
  <br />
  <span className={styles.readinessLabelWithInfo}>
    Readiness<InfoTip text="Includes: Real Test only." />
  </span>
</div>

          </div>
        </div>
      </div>
    </div>
  );
}
