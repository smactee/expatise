//components/stats/ScoreChart.client.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './ScoreChart.module.css';
import { useBootSweepOnce } from '@/components/stats/useBootSweepOnce.client';
import { useOnceInMidView } from '@/components/stats/useOnceInView.client';


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

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

type XY = { x: number; y: number };

function smoothPath(points: XY[], tension = 0.25) {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    const c1x = p1.x + (p2.x - p0.x) * tension;
    const c1y = p1.y + (p2.y - p0.y) * tension;
    const c2x = p2.x - (p3.x - p1.x) * tension;
    const c2y = p2.y - (p3.y - p1.y) * tension;

    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  return d;
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


  // Reveal animation 0..1, once.
// Start reveal only when there is at least 1 point.
// (Do NOT use `model` here because model doesn't exist yet.)
const hasAnyData = (series?.length ?? 0) > 0;
const { ref, seen } = useOnceInMidView<HTMLDivElement>();

const scorePathRef = useRef<SVGPathElement | null>(null);
const avgPathRef = useRef<SVGPathElement | null>(null);
const [scoreLen, setScoreLen] = useState(0);
const [avgLen, setAvgLen] = useState(0);
const lensReady = scoreLen > 0 && avgLen > 0;

const reveal = useBootSweepOnce({
  target: 1,
  seen,
  enabled: hasAnyData && lensReady,
  segments: () => [
    { from: 0, to: 1, durationMs: 1200, ease: easeOutCubic },
    { from: 1, to: 1, durationMs: 250, ease: (t) => t },
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
  const pts = model.pts.map((p, i) => ({ x: xFor(i), y: yForScore(p.scorePct) }));
  return smoothPath(pts);
}, [model.hasData, model.pts]);


  const trendVals = useMemo(() => {
  if (!model.hasData) return [];
  let sum = 0;
  return model.pts.map((p, i) => {
    sum += p.scorePct;
    return sum / (i + 1);
  });
}, [model.hasData, model.pts]);

  const avgTrendD = useMemo(() => {
  if (!model.hasData) return '';
  const pts = trendVals.map((v, i) => ({ x: xFor(i), y: yForScore(v) }));
  return smoothPath(pts);
}, [model.hasData, trendVals]);





useEffect(() => {
  // measure after paths update
  if (scorePathRef.current) setScoreLen(scorePathRef.current.getTotalLength());
  if (avgPathRef.current) setAvgLen(avgPathRef.current.getTotalLength());
}, [pathD, avgTrendD]);




  // Use stroke-dash to reveal line (no pause)
  const tReveal = clamp(reveal, 0, 1);

const scoreDashOffset = (1 - tReveal) * scoreLen;
const avgDashOffset = (1 - tReveal) * avgLen;



  

  const hover = hoverIdx === null ? null : model.pts[hoverIdx];


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
    {/* Average (yellow) — ghost optional */}

    <path
      ref={avgPathRef}
      d={avgTrendD}
      className={styles.avgTrend}
      strokeDasharray={lensReady ? avgLen : undefined}
strokeDashoffset={lensReady ? avgDashOffset : undefined}
style={{ opacity: lensReady ? 1 : 0 }}


    />

    {/* Score (blue) ghost + revealed */}

    <path
      ref={scorePathRef}
      d={pathD}
      className={styles.line}
      strokeDasharray={lensReady ? scoreLen : undefined}
strokeDashoffset={lensReady ? scoreDashOffset : undefined}
style={{ opacity: lensReady ? 1 : 0 }}


    />

    {/* Yellow trend dots (LATEST ONLY) */}
{(() => {
  if (!model.hasData) return null;

  const i = model.latestIdx;
  const v = trendVals[i];

  // (optional safety) if v is missing for some reason
  if (typeof v !== 'number') return null;

  const x = xFor(i);
  const y = yForScore(v);

  const nPts = Math.max(1, model.pts.length);
  const step = 1 / nPts;
  const start = i * step;
  const local = clamp((tReveal - start) / (step * 0.9), 0, 1);
  const pop = easeOutCubic(local);

  const r = 2.5 * (0.25 + 0.75 * pop);

  return (
    <g key={`avgpt-${model.pts[i]?.t ?? i}`} aria-hidden="true" style={{ opacity: pop }}>
      <circle cx={x} cy={y} r={r} className={styles.avgDot} />
      {/* Yellow halo starts AFTER reveal */}
      {pop > 0.98 ? <circle cx={x} cy={y} r="7" className={styles.avgHaloPulse} /> : null}
    </g>
  );
})()}

  </>
) : null}



          {/* Points + hover targets */}
{/* Points + hover targets (LATEST ONLY) */}
{(() => {
  if (!model.hasData) return null;

  const i = model.latestIdx;
  const p = model.pts[i];

  const x = xFor(i);
  const y = yForScore(p.scorePct);

  // same reveal timing you already use (so it appears after line reveal)
  const nPts = Math.max(1, model.pts.length);
  const step = 1 / nPts;
  const start = i * step;
  const local = clamp((tReveal - start) / (step * 0.9), 0, 1);
  const pop = easeOutCubic(local);

  return (
    <g
      key={`pt-${p.t}`}
      onMouseEnter={() => setHoverIdx(i)}
      style={{ cursor: 'default' }}
    >
      <circle cx={x} cy={y} r="10" className={styles.hit} />

      <circle
        cx={x}
        cy={y}
        r={3.5 * (0.25 + 0.75 * pop)}
        className={styles.dot}
        style={{ opacity: pop }}
      />

      {/* Blue halo starts AFTER reveal */}
      {pop > 0.98 ? (
        <>
          <circle cx={x} cy={y} r="3.0" className={styles.halo} />
          <circle cx={x} cy={y} r="7" className={styles.haloPulse} />
        </>
      ) : null}
    </g>
  );
})()}


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
