'use client';

import { useMemo, useState } from 'react';
import styles from './ScoreChart.module.css';
import { useOnceInView } from '@/components/stats/useOnceInView.client';
import { useBootSweepOnce } from '@/components/stats/useBootSweepOnce.client';

type Point = {
  t: number;
  scorePct: number;
  answered: number;
  totalQ: number;
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function fmtDayTime(t: number) {
  const d = new Date(t);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ScoreChart(props: {
  series: Point[];
  scoreAvg: number;
  scoreBest: number;
  scoreLatest: number;
  attemptsCount: number;
  attemptedTotal: number;
  passLine?: number;   // default 90
  height?: number;     // px
}) {
  const {
    series,
    scoreAvg,
    scoreBest,
    scoreLatest,
    attemptsCount,
    attemptedTotal,
    passLine = 90,
    height = 140,
  } = props;

  const { ref, seen } = useOnceInView<HTMLDivElement>(0.35);

  // Reveal animation 0..1, once.
  const reveal = useBootSweepOnce({
    target: 1,
    seen,
    enabled: true,
    segments: () => [
      { from: 0, to: 1, durationMs: 650, ease: (t) => 1 - Math.pow(1 - t, 3) }, // easeOutCubic
    ],
  });

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const model = useMemo(() => {
    const pts = [...(series ?? [])].sort((a, b) => a.t - b.t);

    // Keep it readable: last 12 attempts (tweakable)
    const maxN = 12;
    const sliced = pts.length > maxN ? pts.slice(pts.length - maxN) : pts;

    const maxQ = Math.max(1, ...sliced.map(p => p.totalQ || 0));
    const hasData = sliced.length > 0;

    const latestIdx = hasData ? sliced.length - 1 : -1;
    const bestIdx =
      hasData
        ? sliced.reduce((bi, p, i, arr) => (p.scorePct > arr[bi].scorePct ? i : bi), 0)
        : -1;

    const lowConfidence = attemptsCount < 3 || attemptedTotal < 60;

    return { pts: sliced, maxQ, latestIdx, bestIdx, hasData, lowConfidence };
  }, [series, attemptsCount, attemptedTotal]);

  // SVG coordinate system
const W = 340;     // total SVG width
const H = 100;     // plot height
const axisW = 27;  // left axis width (labels live here)
const padX = 5;
const padY = 5;

const plotLeft = axisW;
const padRight = 18;     // NEW (space for latest halo)
const plotRight = W - padRight;
const plotW = plotRight - plotLeft;



  const xFor = (i: number) => {
  const n = Math.max(1, model.pts.length - 1);
  return plotLeft + ((plotW - padX * 2) * i) / n + padX;
};


  const yForScore = (s: number) => {
    const y01 = 1 - clamp(s / 100, 0, 1);
    return padY + y01 * (H - padY * 2);
  };

  const passY = yForScore(passLine);
  const avgY = yForScore(scoreAvg);

  const pathD = useMemo(() => {
    if (!model.hasData) return '';
    return model.pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(2)} ${yForScore(p.scorePct).toFixed(2)}`)
      .join(' ');
  }, [model, series]);

  const avgTrendD = useMemo(() => {
  if (!model.hasData) return '';
  let sum = 0;
  return model.pts
    .map((p, i) => {
      sum += p.scorePct;
      const runAvg = sum / (i + 1);
      return `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(2)} ${yForScore(runAvg).toFixed(2)}`;
    })
    .join(' ');
}, [model]);


  // Use stroke-dash to reveal line (no pause)
  const dashTotal = 1000; // arbitrary
  const dashOffset = (1 - clamp(reveal, 0, 1)) * dashTotal;

  const hover = hoverIdx != null ? model.pts[hoverIdx] : null;

  return (
    <div ref={ref} className={styles.wrap}>
      {/* Top summary row (one line, premium scan) */}
      


      <div className={styles.chartShell} style={{ height }}>
        <svg
          className={styles.svg}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          onMouseLeave={() => setHoverIdx(null)}
        >

            {/* Y axis */}
<line x1={plotLeft} y1={padY} x2={plotLeft} y2={H - padY} className={styles.axisLine} />

{[
  { v: 100, strong: false },
  { v: 50, strong: false },
  { v: 0, strong: false },
].map((tick) => {
  const y = yForScore(tick.v);
  return (
    <g key={tick.v}>
      <line x1={plotLeft - 4} y1={y} x2={plotLeft} y2={y} className={styles.axisTick} />
      <text
        x={plotLeft - 6}
        y={y + 3}
        textAnchor="end"
        className={styles.axisText}
      >
        {tick.v}
      </text>
    </g>
  );
})}


          {/* Pass band (Pass..100) — clipped to the plot area */}
{(() => {
  const topY = yForScore(100);
  const bandH = Math.max(0, passY - topY);
  return (
    <rect
      x={plotLeft}
      y={topY}
      width={plotW}
      height={bandH}
      className={styles.passBand}
    />
  );
})()}


          {/* Light grid lines */}
          <line x1={plotLeft} y1={yForScore(100)} x2={plotRight} y2={yForScore(100)} className={styles.grid} />
<line x1={plotLeft} y1={yForScore(50)}  x2={plotRight} y2={yForScore(50)}  className={styles.grid} />
<line x1={plotLeft} y1={yForScore(0)}   x2={plotRight} y2={yForScore(0)}   className={styles.grid} />


          {/* Pass line */}
<line x1={plotLeft} y1={passY} x2={plotRight} y2={passY} className={styles.passLine} />
<text
  x={plotRight - 4}
  y={clamp(passY - 4, 10, H - 6)}
  textAnchor="end"
  className={styles.passLabel}
>
  Pass {passLine}%
</text>

          {/* Avg line (only if enough data) */}
         {model.hasData ? (
  <>
    <path d={avgTrendD} className={styles.avgTrend} />
    <path d={pathD} className={styles.lineGhost} />
    <path
      d={pathD}
      className={styles.line}
      strokeDasharray={dashTotal}
      strokeDashoffset={dashOffset}
    />
  </>
) : null}




          {/* Line (revealed) */}
          {model.hasData ? (
            <>
              <path d={pathD} className={styles.lineGhost} />
              <path
                d={pathD}
                className={styles.line}
                strokeDasharray={dashTotal}
                strokeDashoffset={dashOffset}
              />
            </>
          ) : null}

          {/* Points + hover targets */}
          {model.pts.map((p, i) => {
            const x = xFor(i);
            const y = yForScore(p.scorePct);
            const isLatest = i === model.latestIdx;
            const isBest = i === model.bestIdx;

            return (
              <g
                key={`pt-${p.t}`}
                onMouseEnter={() => setHoverIdx(i)}
                style={{ cursor: 'default' }}
              >
                {/* bigger invisible hit area */}
                <circle cx={x} cy={y} r="10" className={styles.hit} />

                {/* marker */}
                <circle cx={x} cy={y} r={isLatest ? 3.5 : 2.5} className={styles.dot} />

                {/* latest halo */}
                {isLatest ? <circle cx={x} cy={y} r="4" className={styles.halo} /> : null}

                {/* best badge */}
                {isBest ? <text x={x} y={y - 10} textAnchor="middle" className={styles.best}>★</text> : null}
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {hover ? (
          <div className={styles.tooltip}>
            <div className={styles.tipTitle}>{fmtDayTime(hover.t)}</div>
            <div className={styles.tipBody}>
              <div>Score: <b>{hover.scorePct}%</b></div>
              <div>Answered: <b>{hover.answered}</b></div>
              <div>Total Q: <b>{hover.totalQ}</b></div>
            </div>
          </div>
        ) : null}
      </div>
<div className={styles.summaryRow}>
        

  <span className={styles.metric}><b>Avg</b> {scoreAvg}%</span>
  <span className={styles.metric}><b>Best</b> {scoreBest}%</span>
  <span className={`${styles.metric} ${styles.metricHero}`}><b>Latest</b> {scoreLatest}%</span>
  <span className={`${styles.metric} ${styles.metricMuted}`}><b>Based on</b> {attemptedTotal} answers</span>
</div>
      {/* Confidence note (explicit honesty) */}
      {model.lowConfidence ? (
        <div className={styles.confidence}>
          Low confidence: only {attemptsCount} tests / {attemptedTotal} answers in this window.
        </div>
      ) : null}
    </div>
  );
}
