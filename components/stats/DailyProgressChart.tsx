'use client';

import styles from './DailyProgressChart.module.css';
import { useOnceInMidView } from './useOnceInView.client';
import { useEffect, useMemo, useRef, useState, useId } from 'react';
import { useBootSweepOnce } from './useBootSweepOnce.client';
import { createPortal } from 'react-dom';

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

  const shown = useMemo(() => series.slice(-rows), [series, rows]);


  const maxAnsweredData = shown.reduce((m, d) => {
    const v = Number.isFinite(d.questionsAnswered) ? d.questionsAnswered : 0;
    return v > m ? v : m;
  }, 0);

  const maxAnswered = Math.max(1, maxAnsweredData);
  const midAnswered = Math.round(maxAnswered / 2);

  const { ref: inViewRef, seen } = useOnceInMidView<HTMLDivElement>();

  const avgGradId = useId().replace(/:/g, '');



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

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);

  const hitRefs = useRef<(SVGRectElement | null)[]>([]);

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [pinnedIdx, setPinnedIdx] = useState<number | null>(null);

  const [pointerType, setPointerType] = useState<'mouse' | 'touch' | 'pen'>('mouse');

  const activeIdx = pinnedIdx ?? hoverIdx;

  const isCoarse =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(hover: none)').matches || window.matchMedia?.('(pointer: coarse)').matches);

useEffect(() => {
    function onDocDown(e: PointerEvent) {
      if (pinnedIdx == null) return;

      const t = e.target as Node | null;
      const inWrap = !!wrapRef.current && !!t && wrapRef.current.contains(t);
      const inTip = !!tipRef.current && !!t && tipRef.current.contains(t);

      if (!inWrap && !inTip) setPinnedIdx(null);
    }

    window.addEventListener('pointerdown', onDocDown, { passive: true });
    return () => window.removeEventListener('pointerdown', onDocDown);
  }, [pinnedIdx]);

    const [tipPos, setTipPos] = useState<{
    left: number;
    top: number;
    placement: 'top' | 'bottom';
  } | null>(null);

  useEffect(() => {
    if (activeIdx == null) {
      setTipPos(null);
      return;
    }

    const d = shown[activeIdx];
    const hasData = !!d && ((d.testsCompleted ?? 0) > 0 || (d.questionsAnswered ?? 0) > 0);
    if (!hasData) {
      setTipPos(null);
      return;
    }

    const el = hitRefs.current?.[activeIdx];
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const TIP_W = 260;
    const M = 10;

    const centerX = rect.left + rect.width / 2;
    const left = clamp(centerX, M + TIP_W / 2, vw - M - TIP_W / 2);

    const preferTop = rect.top > 140;
    const placement: 'top' | 'bottom' = preferTop ? 'top' : 'bottom';

    const top =
      placement === 'top'
        ? clamp(rect.top - 12, M, vh - M)
        : clamp(rect.bottom + 12, M, vh - M);

    // prevent pointless state updates (nice-to-have)
    setTipPos((prev) => {
      if (prev && prev.left === left && prev.top === top && prev.placement === placement) return prev;
      return { left, top, placement };
    });
  }, [activeIdx, shown]);




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
    <div className={styles.wrap} ref={wrapRef}>
      <div className={styles.box}>
        <div className={styles.chartShell} ref={inViewRef}>

<svg className={styles.svg} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">


  <defs>
  <linearGradient id={avgGradId} x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" style={{ stopColor: 'var(--chart-grad-warm)' }} />
    <stop offset="100%" style={{ stopColor: 'var(--chart-grad-cool)' }} />
  </linearGradient>
</defs>




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
                <text x={xAxisR - 6} y={t.y + 3} textAnchor="end" className={styles.yAxisTextRight}  style={{ fill: `url(#${avgGradId})` }}>
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
            <text x={xAxisR - 6} y={y0 + 12} textAnchor="end" className={styles.yAxisTextRight}  style={{ fill: `url(#${avgGradId})` }}>
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
                    rx={2}
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
{/* avgScore line + dots */}
{avgPathD ? (
  <>
    {/* line reveal */}
    <path
      ref={avgPathRef}
      d={avgPathD}
      className={styles.avgLine}
      stroke={`url(#${avgGradId})`}
      strokeDasharray={lensReady ? dashLen : undefined}
      strokeDashoffset={lensReady ? avgDashOffset : undefined}
      style={{ opacity: lensReady ? 1 : 0 }}
    />

    {/* dots for EVERY point */}
    {avgPoints
      .filter((p) => p.pct > 0)
      .map((p) => (
        <circle
          key={`avgpt-${p.dayStart}`}
          cx={p.cx}
          cy={p.cy}
          r={2.00}
          className={`${styles.avgDot} ${styles.dotHidden} ${animateIn ? styles.popIn : ''}`}
          style={{
            ...(animateIn ? { animationDelay: `${dotDelayMs}ms` } : null),
            fill: `url(#${avgGradId})`,
          }}
        />
      ))}

    {/* pulse halo ONLY for latest point */}
    {avgPoints.length > 0 ? (
      <circle
        cx={avgPoints[avgPoints.length - 1].cx}
        cy={avgPoints[avgPoints.length - 1].cy}
        r={7}
        className={`${styles.avgHaloPulse} ${animateIn ? '' : styles.pulseHidden}`}
        style={{
          ...(animateIn ? { animationDelay: `${dotDelayMs}ms` } : null),
          stroke: `url(#${avgGradId})`,
          strokeOpacity: 0.45,
        }}
      />
    ) : null}
  </>
) : null}



{/* HIT TARGETS (top layer): make tooltip easy to trigger */}
{shown.map((d, i) => {
  const hasData = d.testsCompleted > 0 || d.questionsAnswered > 0;

  // one “slot” spans the whole day column
  const xSlot = xAxisL + i * slot;

  return (
    <rect
      key={`hit-${d.dayStart}`}
      ref={(node) => {
        hitRefs.current[i] = node;
      }}
      x={xSlot}
      y={padT}
      width={slot}
      height={plotH}
      rx={10}
      fill="rgba(0,0,0,0)"
      pointerEvents={hasData ? 'all' : 'none'}
      style={{ cursor: hasData ? 'pointer' : 'default' }}
      onPointerDown={(e) => setPointerType((e.pointerType as any) ?? 'mouse')}
      onMouseEnter={() => setHoverIdx(i)}
      onMouseLeave={() => setHoverIdx(null)}
      onClick={() => {
        const allowPin = pointerType !== 'mouse' || isCoarse;
        if (!allowPin) return;
        setPinnedIdx((prev) => (prev === i ? null : i));
      }}
    />
  );
})}
</svg>



{activeIdx != null && tipPos ? (() => {
  const d = shown[activeIdx];
  const hasData = (d.testsCompleted > 0 || d.questionsAnswered > 0);
  if (!hasData) return null;

  const label = fmtDay(d.dayStart);
  const score = clamp(Number.isFinite(d.avgScore) ? d.avgScore : 0, 0, 100);

  return createPortal(
    <div
      ref={tipRef}
      className={styles.tooltip}
      data-placement={tipPos.placement}
      style={{ left: tipPos.left, top: tipPos.top }}
      role="tooltip"
    >
      <div className={styles.tipTitle}>{label}</div>
      <div className={styles.tipSub}>
        {d.questionsAnswered} answered · {d.testsCompleted} tests
      </div>
      <div className={styles.tipBody}>
        Avg score: <span className={styles.tipStrong}>{score}%</span>
      </div>
      <div className={styles.tipArrow} aria-hidden="true" />
    </div>,
    document.body
  );
})() : null}
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

