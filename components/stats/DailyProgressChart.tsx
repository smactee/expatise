'use client';

import styles from './DailyProgressChart.module.css';
import { useOnceInMidView } from './useOnceInView.client';
import { useEffect, useRef, useState } from 'react';
import { useBootSweepOnce } from './useBootSweepOnce.client';

type DayRow = {
  dayStart: number;
  testsCompleted: number;
  questionsAnswered: number;
  avgScore: number;
};

function fmtDay(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}


export default function DailyProgressChart(props: {
  series: DayRow[];
  bestDayQuestions: number;
  streakDays: number;
  rows?: number; // default 7/30 controlled by parent
}) {
  const { series, bestDayQuestions, streakDays, rows = 7 } = props;

  const shown = series.slice(-rows);

  const maxAnsweredData = shown.reduce((m, d) => {
    const v = Number.isFinite(d.questionsAnswered) ? d.questionsAnswered : 0;
    return v > m ? v : m;
  }, 0);

  const maxAnswered = Math.max(1, maxAnsweredData);
  const midAnswered = Math.round(maxAnswered / 2);

  const { ref: inViewRef, seen } = useOnceInMidView<HTMLDivElement>();


  const animateIn = seen && shown.length > 0;

  // animation timing (single source of truth)
  const barStaggerMs = 90;
  const lineDelayMs = 140;
  const lineDurMs = 850; // must match CSS .avgLineDraw duration
  const dotDelayMs = lineDelayMs + lineDurMs;

  // geometry
  const W = 340;
  const H = 110;

  const padT = 10;
  const padB = 26;

  const padL = 0;
  const padR = 0;

  const xAxisL = padL + 0.5;
  const xAxisR = W - padR - 0.5;

  const plotW = xAxisR - xAxisL;
  const plotH = H - padT - padB;

  const slot = shown.length ? plotW / shown.length : plotW;
  const barW = Math.max(8, slot * 0.55);

  const xFor = (i: number) => xAxisL + i * slot + (slot - barW) / 2;
  const cxFor = (i: number) => xFor(i) + barW / 2;
  

  const barHFor = (answered: number) => (answered / maxAnswered) * plotH;

  const yForAnswered = (answered: number) => {
    const y01 = 1 - clamp(answered / maxAnswered, 0, 1);
    return padT + y01 * plotH;
  };

  const y0 = yForAnswered(0);
  const yMid = yForAnswered(midAnswered);
  const yMax = yForAnswered(maxAnswered);

  const yForAvg = (pct: number) => {
    const y01 = 1 - clamp(pct / 100, 0, 1);
    return padT + y01 * plotH;
  };

  const avgPathD =
    shown.length === 0
      ? ''
      : shown
          .map((d, i) => {
            const pct = clamp(Number.isFinite(d.avgScore) ? d.avgScore : 0, 0, 100);
            return `${i === 0 ? 'M' : 'L'} ${cxFor(i).toFixed(2)} ${yForAvg(pct).toFixed(2)}`;
          })
          .join(' ');

  const avgPoints = shown.map((d, i) => {
  const pct = clamp(Number.isFinite(d.avgScore) ? d.avgScore : 0, 0, 100);
  return {
    dayStart: d.dayStart,
    pct,                 // ✅ keep it
    cx: cxFor(i),
    cy: yForAvg(pct),
  };
});


const avgPathRef = useRef<SVGPathElement | null>(null);
const [avgLen, setAvgLen] = useState(0);
const lensReady = avgLen > 0;

useEffect(() => {
  if (avgPathRef.current) setAvgLen(avgPathRef.current.getTotalLength());
}, [avgPathD]);

const hasAnyLine = avgPathD.length > 0;

const reveal = useBootSweepOnce({
  target: 1,
  seen, // from your useOnceInView
  enabled: hasAnyLine && lensReady,
  segments: () => [
    { from: 0, to: 0, durationMs: lineDelayMs, ease: (t) => t }, // wait
    { from: 0, to: 1, durationMs: lineDurMs, ease: easeOutCubic }, // draw
  ],
});

const tReveal = clamp(reveal, 0, 1);
const dashLen = Math.max(1, Math.ceil(avgLen) + 2); // +2 prevents tiny tail gap
const avgDashOffset = (1 - tReveal) * dashLen;


  // label density (30 days gets crowded)
  const labelEvery =
    shown.length <= 8 ? 1 :
    shown.length <= 14 ? 2 :
    shown.length <= 30 ? 5 :
    10;

  const showLabel = (i: number) =>
    i === 0 || i === shown.length - 1 || i % labelEvery === 0;

  return (
    <div className={styles.wrap}>
      <div className={styles.box}>
        <div className={styles.chartShell} ref={inViewRef}>
          <svg className={styles.svg} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
            {/* LEFT axis */}
            <line x1={xAxisL} y1={padT} x2={xAxisL} y2={padT + plotH} className={styles.yAxisLine} />

            {[
              { label: String(maxAnswered), y: yMax },
              { label: String(midAnswered), y: yMid },
              { label: '0', y: y0 },
            ].map((t, i) => (
              <g key={`yl-${i}`}>
                <line x1={xAxisL} y1={t.y} x2={xAxisL + 4} y2={t.y} className={styles.yAxisTick} />
                <text x={xAxisL + 6} y={t.y + 3} textAnchor="start" className={styles.yAxisText}>
                  {t.label}
                </text>
              </g>
            ))}

            {/* RIGHT axis */}
            <line x1={xAxisR} y1={padT} x2={xAxisR} y2={padT + plotH} className={styles.yAxisLine} />

            {[
              { label: '100', y: yForAvg(100) },
              { label: '50', y: yForAvg(50) },
              { label: '0', y: yForAvg(0) },
            ].map((t, i) => (
              <g key={`yr-${i}`}>
                <line x1={xAxisR - 4} y1={t.y} x2={xAxisR} y2={t.y} className={styles.yAxisTick} />
                <text x={xAxisR - 6} y={t.y + 3} textAnchor="end" className={styles.yAxisTextRight}>
                  {t.label}
                </text>
              </g>
            ))}

            {/* grid */}
            <line x1={xAxisL} y1={yMax} x2={xAxisR} y2={yMax} className={styles.grid} />
            <line x1={xAxisL} y1={yMid} x2={xAxisR} y2={yMid} className={styles.grid} />
            <line x1={xAxisL} y1={y0} x2={xAxisR} y2={y0} className={styles.gridBase} />

            {/* corner labels */}
            <text x={xAxisL + 6} y={y0 + 12} textAnchor="start" className={styles.yAxisText}>
              Questions
            </text>
            <text x={xAxisR - 6} y={y0 + 12} textAnchor="end" className={styles.yAxisTextRight}>
              Score
            </text>

            {/* bars */}
            {shown.map((d, i) => {
              const h = barHFor(d.questionsAnswered);
              const x = xFor(i);
              const y = padT + (plotH - h);
              const isLast = i === shown.length - 1;
              const label = fmtDay(d.dayStart);

              return (
                <g key={d.dayStart}>
                  <rect
                    x={x}
                    y={y}
                    width={barW}
                    height={h}
                    rx={8}
                    className={`${isLast ? styles.barActive : styles.bar} ${styles.barHidden} ${animateIn ? styles.barRise : ''}`}
                    style={animateIn ? { animationDelay: `${i * barStaggerMs}ms` } : undefined}
                  >
                    <title>{`Day of ${label}\n${d.questionsAnswered} answered · ${d.testsCompleted} tests · Avg ${d.avgScore}%`}</title>
                  </rect>

                  {showLabel(i) ? (() => {
  const cx = cxFor(i);

  const isFirst = i === 0;
  const isLast = i === shown.length - 1;

  // keep labels inside the viewport
  const padText = 4;
  const xSafe = isFirst ? xAxisL + padText
            : isLast ? xAxisR - padText
            : cx;

  const anchor = isFirst ? "start" : isLast ? "end" : "middle";

  return (
    <text x={xSafe} y={H - 4} textAnchor={anchor} className={styles.axisText}>
      {label}
    </text>
  );
})() : null}

                </g>
              );
            })}

            {/* avgScore line + dots */}
{avgPathD ? (
  <>
    {/* line reveal (ScoreChart method: real length + dashoffset) */}
    <path
      ref={avgPathRef}
      d={avgPathD}
      className={styles.avgLine}
      strokeDasharray={lensReady ? dashLen : undefined}
      strokeDashoffset={lensReady ? avgDashOffset : undefined}
      style={{ opacity: lensReady ? 1 : 0 }}
    />

    {/* dots for EVERY point (appear after the line draw finishes) */}
    {avgPoints
  .filter((p) => p.pct > 0)
  .map((p) => (
    <circle
      key={`avgpt-${p.dayStart}`}
      cx={p.cx}
      cy={p.cy}
      r={3.25}
      className={`${styles.avgDot} ${styles.dotHidden} ${animateIn ? styles.popIn : ''}`}
      style={animateIn ? { animationDelay: `${dotDelayMs}ms` } : undefined}
    />
))}


    {/* pulse halo ONLY for latest point */}
    {avgPoints.length > 0 ? (
      <circle
        cx={avgPoints[avgPoints.length - 1].cx}
        cy={avgPoints[avgPoints.length - 1].cy}
        r={7}
        className={`${styles.avgHaloPulse} ${animateIn ? '' : styles.pulseHidden}`}
        style={animateIn ? { animationDelay: `${dotDelayMs}ms` } : undefined}
      />
    ) : null}
  </>
) : null}

          </svg>
        </div>
      </div>
      <div className={styles.metaRow}>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Best day:</span> <b>{bestDayQuestions}</b> questions
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Consistency streak:</span> <b>{streakDays}</b> days
        </div>
      </div>
    </div>
  );
}
