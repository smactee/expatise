//components/stats/ScreenTimeChart.client.tsx
'use client';

import { useEffect, useMemo, useRef, useState, useId, type CSSProperties } from 'react';
import { useOnceInView } from './useOnceInView.client';
import { useBootSweepOnce } from './useBootSweepOnce.client';
import styles from './ScreenTimeChart.module.css';

// ✅ Legend for Screen Time card header (moved out of StatsPage)
export function ScreenTimeLegend({
  animate = true,
  delayMs = 0,
}: {
  animate?: boolean;
  delayMs?: number;
}) {
  return (
    <div
      className={`${styles.statsLegend} ${animate ? styles.waterIn : styles.waterHidden}`}
      style={animate ? ({ animationDelay: `${delayMs}ms` } as CSSProperties) : undefined}
    >
      <span className={`${styles.statsLegendDot} ${styles.statsLegendDotYellow}`} />
      <span className={styles.statsLegendLabel}>Test</span>

      <span className={`${styles.statsLegendDot} ${styles.statsLegendDotBlue}`} />
      <span className={styles.statsLegendLabel}>Study</span>

      <span className={styles.statsLegend__screenTime__totalGradientSwatch} />
      <span className={styles.statsLegendLabel}>Total</span>

      <span className={styles.statsLegend__screenTime__avgDottedSwatch} />
      <span className={`${styles.statsLegendLabel} ${styles.statsLegendLabelAvg}`}>7D avg</span>
    </div>
  );
}



type DayPoint = {
  dayStart: number | string;
  deliberateMin: number;
  studyMin: number;
};

function fmtMin(min: number) {
  // Switch to hours when values get big, keeps axis labels compact
  if (min >= 120) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `${h}h${m}` : `${h}h`;
  }
  return `${min}m`;
}

function niceStep(rough: number) {
  // Pick a human-friendly step
  if (rough <= 2) return 1;
  if (rough <= 5) return 2;
  if (rough <= 10) return 5;
  if (rough <= 20) return 10;
  if (rough <= 45) return 15;
  if (rough <= 90) return 30;
  if (rough <= 180) return 60;
  return 120; // 2h steps
}


function dayKeyFromDate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function startOfLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function buildLastNDays(n: number) {
  const today = startOfLocalDay(new Date());
  const days: { key: string; date: Date; dayStartISO: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(today);
    dt.setDate(today.getDate() - i);
    days.push({ key: dayKeyFromDate(dt), date: dt, dayStartISO: dt.toISOString() });
  }
  return days;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Consistency score: 0..100
 * High if daily totals are even (low variance).
 * Uses coefficient of variation (std/mean) -> mapped to score.
 */
function consistencyScore(totals: number[]) {
  const mean = totals.reduce((a, b) => a + b, 0) / Math.max(1, totals.length);
  if (mean <= 0) return 0;
  const variance =
    totals.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / Math.max(1, totals.length);
  const std = Math.sqrt(variance);
  const cv = std / mean; // 0 = perfectly consistent

  // Map CV to score: CV 0 => 100, CV >= 1.2 => ~0
  const score = Math.round(100 * (1 - clamp(cv / 1.2, 0, 1)));
  return clamp(score, 0, 100);
}

type Pt = { x: number; y: number };

function smoothPathCatmullRom(points: Pt[], clampMin = 0, clampMax = 100) {
  if (points.length < 2) return '';
  const d: string[] = [`M ${points[0].x} ${points[0].y}`];

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    // Catmull-Rom → Bezier
    let cp1x = p1.x + (p2.x - p0.x) / 6;
    let cp1y = p1.y + (p2.y - p0.y) / 6;
    let cp2x = p2.x - (p3.x - p1.x) / 6;
    let cp2y = p2.y - (p3.y - p1.y) / 6;

    // Clamp control points to avoid overshoot
    cp1x = clamp(cp1x, clampMin, clampMax);
    cp2x = clamp(cp2x, clampMin, clampMax);
    cp1y = clamp(cp1y, clampMin, clampMax);
    cp2y = clamp(cp2y, clampMin, clampMax);

    d.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`);
  }

  

  return d.join(' ');
}

function smoothPathCatmullRomXY(points: Pt[], xMin: number, xMax: number, yMin: number, yMax: number) {
  if (points.length < 2) return '';
  const d: string[] = [`M ${points[0].x} ${points[0].y}`];

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    let cp1x = p1.x + (p2.x - p0.x) / 6;
    let cp1y = p1.y + (p2.y - p0.y) / 6;
    let cp2x = p2.x - (p3.x - p1.x) / 6;
    let cp2y = p2.y - (p3.y - p1.y) / 6;

    // Clamp control points separately for x and y
    cp1x = clamp(cp1x, xMin, xMax);
    cp2x = clamp(cp2x, xMin, xMax);
    cp1y = clamp(cp1y, yMin, yMax);
    cp2y = clamp(cp2y, yMin, yMax);

    d.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`);
  }

  return d.join(' ');
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function pathLinear(points: Pt[]) {
  if (points.length < 2) return '';
  return (
    `M ${points[0].x} ${points[0].y}` +
    points.slice(1).map((p) => ` L ${p.x} ${p.y}`).join('')
  );
}




export default function ScreenTimeChart({
  data,
  height = 80,
  timedTestMinutesEstimate,
  streakDays,
  onLegendReveal,
}: {
  data: DayPoint[];
  height?: number;
  timedTestMinutesEstimate?: number;
  streakDays?: number;
  onLegendReveal?: () => void;
}) {

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const totalStrokeId = useId().replace(/:/g, '');
const totalFillId = useId().replace(/:/g, '');

const { ref: inViewRef, seen } = useOnceInView<HTMLDivElement>({
  threshold: 0.2,
  rootMargin: '0px 0px -15% 0px',
});

  const model = useMemo(() => {
    const daySlots = buildLastNDays(7);

    // normalize incoming data by local day key
    const byKey = new Map<string, DayPoint>();
    for (const d of data || []) {
      const k = dayKeyFromDate(new Date(d.dayStart));
      byKey.set(k, d);
    }

    const points = daySlots.map((slot) => {
      const found = byKey.get(slot.key);
      const deliberateMin = found?.deliberateMin ?? 0;
      const studyMin = found?.studyMin ?? 0;
      const total = deliberateMin + studyMin;

      return {
        key: slot.key,
        dayStartISO: slot.dayStartISO,
        date: slot.date,
        deliberateMin,
        studyMin,
        total,
      };
    });

    const totals = points.map((p) => p.total);
    const maxTotal = Math.max(1, ...totals);
    const weekTotal = totals.reduce((a, b) => a + b, 0);
    const avgTotal = weekTotal / 7;

    const bestTotal = Math.max(...totals);
    const bestIdx = bestTotal > 0 ? totals.indexOf(bestTotal) : -1;

    const todayIdx = points.length - 1;
    const consScore = consistencyScore(totals);

    // Tooltip percent-of-week
    const weekTotalSafe = Math.max(1, weekTotal);

    // Optional compare overlay: only if we have 14+ days of real data
    // (We keep it gated; currently your computeStats provides 7.)
    const hasCompare = (data?.length ?? 0) >= 14;

    return {
      points,
      maxTotal,
      weekTotal,
      avgTotal,
      bestIdx,
      todayIdx,
      consScore,
      weekTotalSafe,
      hasCompare,
    };
  }, [data]);

const animateIn = seen && model.points.length > 0;

const SPEED = 0.9; // 30% faster
const ms = (n: number) => Math.round(n * SPEED);

// timing (single source of truth)
const lineDelayMs = ms(120);
const lineDurMs   = ms(850);

const areaDelayMs = lineDelayMs + lineDurMs + ms(120);
const areaDurMs   = ms(550);

const barDelayMs  = areaDelayMs + areaDurMs + ms(120);
const barStaggerMs = ms(90);
const barDurMs     = ms(650);

const nDays = model.points.length || 7;
const avgDelayMs = barDelayMs + (nDays - 1) * barStaggerMs + barDurMs + ms(140);
const avgDurMs = ms(650);
const avgLabelDelayMs = avgDelayMs + avgDurMs;

// Legend should appear AFTER the chart sequence finishes
const legendRevealMs = avgLabelDelayMs;

// Bottom details should start AFTER the legend begins
const detailsStartMs = legendRevealMs;
const detailsStaggerMs = ms(60);





const onLegendRevealRef = useRef(onLegendReveal);
useEffect(() => {
  onLegendRevealRef.current = onLegendReveal;
}, [onLegendReveal]);

const legendFiredRef = useRef(false);

useEffect(() => {
  if (!animateIn) {
    legendFiredRef.current = false; // allow re-run if user scrolls away and back
    return;
  }
  if (legendFiredRef.current) return;

  legendFiredRef.current = true;

  const id = window.setTimeout(() => {
    onLegendRevealRef.current?.();
  }, legendRevealMs);

  return () => window.clearTimeout(id);
}, [animateIn, legendRevealMs]);







const xLabelH = 16;
const plotH = Math.max(10, height - xLabelH);
const plotPx = Math.max(1, plotH - 1); // ✅ shared pixel height used by axis + bars


// ---- Y axis scale (responsive, never "breaks") ----
const rawMax = Math.max(1, model.maxTotal);
const tickCount = 4; // 0, 1/3, 2/3, top (nice)

const { scaleMax, ticks } = useMemo(() => {
  const roughStep = rawMax / (tickCount - 1);
  const step = niceStep(roughStep);
  const top = step * (tickCount - 1);

  // If top is still below rawMax (rare), bump one step
  const finalTop = top < rawMax ? top + step : top;

  const tks = Array.from({ length: tickCount }, (_, i) => i * step);
  // Make sure last tick matches finalTop
  tks[tks.length - 1] = finalTop;

  return { scaleMax: finalTop, ticks: tks };
}, [rawMax]);

const yForMin = (min: number) => {
  const y01 = 1 - clamp(min / scaleMax, 0, 1);
  return Math.round(y01 * plotPx);
};

const avgLineY = Math.round((1 - clamp(model.avgTotal / scaleMax, 0, 1)) * plotPx);


// Routine = number of days (out of 7) with any logged time
const activeDays = useMemo(() => {
  return model.points.reduce((acc, p) => acc + (p.total > 0 ? 1 : 0), 0);
}, [model.points]);

  // --- Total line (polyline) points in 0..100 SVG space ---
const padX = 1;     // keeps the ends from touching the edges
const padTop = 3;   // keeps the peak from clipping (top only)

const totalLinePts = useMemo<Pt[]>(() => {
  const n = model.points.length;
  if (!n) return [];

  const w = 100 - padX * 2;
  const h = 100 - padTop;

  const totals = model.points.map((p) => p.total);

  // 3-point weighted smoothing (display only)
  const totalsSmooth = totals.map((v, i) => {
    const prev = totals[i - 1] ?? v;
    const next = totals[i + 1] ?? v;
    return 0.2 * prev + 0.6 * v + 0.2 * next;
  });

  return model.points.map((p, i) => {
    const x = padX + (n === 1 ? w / 2 : (i / (n - 1)) * w);

    const totalForLine = totalsSmooth[i]; // ✅ use smoothed value for the overlay
    const y = padTop + (1 - clamp(totalForLine / scaleMax, 0, 1)) * h;

    return { x, y };
  });
}, [model.points, scaleMax]);





function smoothPathTensionXY(
  points: Pt[],
  tension: number,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number
) {
  if (points.length < 2) return '';

  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    let c1x = p1.x + (p2.x - p0.x) * tension;
    let c1y = p1.y + (p2.y - p0.y) * tension;
    let c2x = p2.x - (p3.x - p1.x) * tension;
    let c2y = p2.y - (p3.y - p1.y) * tension;

    // clamp control points to keep them inside the plot bounds
    c1x = clamp(c1x, xMin, xMax);
    c2x = clamp(c2x, xMin, xMax);
    c1y = clamp(c1y, yMin, yMax);
    c2y = clamp(c2y, yMin, yMax);

    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  return d;
}

const totalLineD = useMemo(() => {
  // lower tension tends to look better with only 7 points
  const tension = 0.18; // try 0.16–0.22 if you want more/less curve
  return smoothPathTensionXY(totalLinePts, tension, padX, 100 - padX, padTop, 100);
}, [totalLinePts]);

const totalAreaD = useMemo(() => {
  if (!totalLineD || totalLinePts.length < 2) return '';
  const first = totalLinePts[0];
  const last = totalLinePts[totalLinePts.length - 1];

  // close shape to the bottom of the SVG
  const baseY = 100;

  return `${totalLineD} L ${last.x} ${baseY} L ${first.x} ${baseY} Z`;
}, [totalLineD, totalLinePts]);

// ----- Total line draw (dash reveal) -----
const totalPathRef = useRef<SVGPathElement | null>(null);
const [totalLen, setTotalLen] = useState(0);

useEffect(() => {
  if (totalPathRef.current) setTotalLen(totalPathRef.current.getTotalLength());
}, [totalLineD]);

const totalReady = !!totalLineD && totalLen > 0;

const totalReveal = useBootSweepOnce({
  target: 1,
  seen,
  enabled: totalReady,
  segments: () => [
    { from: 0, to: 0, durationMs: lineDelayMs, ease: (t) => t },
    { from: 0, to: 1, durationMs: lineDurMs, ease: easeOutCubic },
  ],
});

const tLine = clamp(totalReveal, 0, 1);
const dashLen = Math.max(1, totalLen + 2);         // no ceil needed
const dashArray = `${dashLen} ${dashLen}`;         // IMPORTANT: paired dash+gap
const dashOffset = (1 - tLine) * dashLen;
const lineDone = tLine > 0.999;



// ----- Area fill follows the line tip -----
const areaClipId = useId().replace(/:/g, '');

// slight lag so fill feels like it trails behind the stroke (tweak 0.06–0.12)
const areaLag = 0.08;
const tAreaFollow = clamp((tLine - areaLag) / (1 - areaLag), 0, 1);

const areaClipW = useMemo(() => {
  if (!totalPathRef.current || totalLen <= 0) return 0;

  const pt = totalPathRef.current.getPointAtLength(totalLen * tAreaFollow);

  // +2 so the fill slightly leads under the stroke cap (feels tighter)
  return clamp(pt.x + 2, 0, 100);
}, [tAreaFollow, totalLen]);


  const weekTestTotal = model.points.reduce((a, p) => a + p.deliberateMin, 0);
  const weekStudyTotal = model.points.reduce((a, p) => a + p.studyMin, 0);

  const bestPoint = model.bestIdx >= 0 ? model.points[model.bestIdx] : null;
  const bestLabel = bestPoint
    ? bestPoint.date.toLocaleDateString(undefined, { weekday: 'short' })
    : '—';

  // Confidence triggers
  const lowConfidenceStudy = weekStudyTotal === 0;
  const lowConfidenceTimed = (timedTestMinutesEstimate ?? 0) > 0 && (timedTestMinutesEstimate ?? 0) < 10;
  const tooLittleOverall = model.weekTotal < 15;

  const confidenceNote =
    tooLittleOverall
      ? `Low confidence: only ${model.weekTotal} minutes logged this week.`
      : lowConfidenceStudy
      ? 'Low confidence: study tracking not enabled yet (showing 0m study).'
      : lowConfidenceTimed
      ? `Low confidence: only ${timedTestMinutesEstimate} timed-test minutes detected.`
      : null;

  const hover = hoverIdx != null ? model.points[hoverIdx] : null;

    return (
    <div className={styles.wrap}>
      {/* TOP AREA: only the chart */}
      <div className={styles.topArea}>
        <div className={styles.chart} style={{ height }} ref={inViewRef}>
          {/* ROW 1: Y axis + plot */}
          <div className={styles.plotRow}>
            {/* Y AXIS */}
            <div className={styles.yAxis} style={{ height: plotH }}>
              {ticks
                .slice()
                .reverse()
                .map((t) => {
                  const y = yForMin(t);
                  return (
                    <div key={t} className={styles.yTick} style={{ top: y }}>
                      {fmtMin(t)}
                    </div>
                  );
                })}
            </div>

            {/* PLOT */}
            <div className={styles.plot} style={{ height: plotH }}>
              {/* ✅ everything inside this wrapper shares the exact same plot box */}
              <div className={styles.plotStack}>
                {/* grid lines */}
                {ticks.map((t) => {
                  const y = yForMin(t);
                  return <div key={`g-${t}`} className={styles.hGrid} style={{ top: y }} />;
                })}

                {/* TOTAL area (mountain) */}
                {totalAreaD ? (
                  <svg
                    className={styles.totalAreaSvg}
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                    style={{ overflow: 'visible' }}
                  >
                    <defs>
                      <linearGradient id={totalFillId} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#2B7CAF" stopOpacity="0.28" />
                        <stop offset="100%" stopColor="#3D8CD5" stopOpacity="0" />
                      </linearGradient>

                      <clipPath id={areaClipId} clipPathUnits="userSpaceOnUse">
                        <rect x="0" y="0" width={areaClipW} height="100" />
                      </clipPath>
                    </defs>

                    <path
                      d={totalAreaD}
                      fill={`url(#${totalFillId})`}
                      clipPath={`url(#${areaClipId})`}
                      style={{ opacity: areaClipW > 0 ? 1 : 0 }}
                    />
                  </svg>
                ) : null}

                {/* TOTAL line */}
                {totalLineD ? (
                  <svg
                    className={styles.totalLineSvg}
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                    style={{ overflow: 'visible' }}
                  >
                    <defs>
                      <linearGradient id={totalStrokeId} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="var(--chart-grad-warm)" stopOpacity="1" />
                        <stop offset="100%" stopColor="var(--chart-grad-cool)" stopOpacity="1" />
                      </linearGradient>
                    </defs>

                    <path
                      ref={totalPathRef}
                      d={totalLineD}
                      className={`${styles.totalLine} ${lineDone ? styles.totalLineFinal : ''}`}
                      stroke={`url(#${totalStrokeId})`}
                      strokeDasharray={totalReady ? dashArray : undefined}
                      strokeDashoffset={totalReady ? dashOffset : undefined}
                      style={{ opacity: totalReady ? 1 : 0 }}
                    />
                  </svg>
                ) : null}

                {/* bars */}
                <div className={styles.cols}>
                  {model.points.map((p, idx) => {
                    const barDelay = barDelayMs + idx * barStaggerMs;

                    const testH =
                      p.deliberateMin > 0
                        ? Math.max(2, Math.round((p.deliberateMin / scaleMax) * plotPx))
                        : 0;

                    const studyH =
                      p.studyMin > 0
                        ? Math.max(2, Math.round((p.studyMin / scaleMax) * plotPx))
                        : 0;

                    const isToday = idx === model.todayIdx;
                    const dayLabel = p.date.toLocaleDateString(undefined, { weekday: 'short' });
                    const pctOfWeek = Math.round((p.total / model.weekTotalSafe) * 100);

                    const colClass = [
                      styles.col,
                      isToday ? styles.today : '',
                      p.total === 0 ? styles.zero : '',
                    ]
                      .filter(Boolean)
                      .join(' ');

                    return (
                      <div
                        key={p.key}
                        className={colClass}
                        onMouseEnter={() => setHoverIdx(idx)}
                        onMouseLeave={() => setHoverIdx(null)}
                      >
                        <div className={styles.barArea}>
                          <div className={styles.group}>
                            <div
                              className={`${styles.test} ${animateIn ? styles.barRise : styles.barHidden}`}
                              style={
                                animateIn
                                  ? { height: testH, animationDelay: `${barDelay}ms` }
                                  : { height: testH }
                              }
                            />
                            <div
                              className={`${styles.study} ${animateIn ? styles.barRise : styles.barHidden}`}
                              style={
                                animateIn
                                  ? { height: studyH, animationDelay: `${barDelay}ms` }
                                  : { height: studyH }
                              }
                            />
                          </div>

                          {hoverIdx === idx ? (
                            <div className={styles.tooltip} role="tooltip">
                              <div className={styles.tipTitle}>{isToday ? 'Today' : dayLabel}</div>
                              <div className={styles.tipBody}>
                                <div>
                                  Test: <b>{p.deliberateMin}m</b>
                                </div>
                                <div>
                                  Study: <b>{p.studyMin}m</b>
                                </div>
                                <div>
                                  Total: <b>{p.total}m</b> · {pctOfWeek}% of week
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* avg line */}
                <div
                  className={`${styles.avgLine} ${animateIn ? styles.avgLineDraw : styles.avgLineHidden}`}
                  style={
                    animateIn
                      ? { top: avgLineY, animationDelay: `${avgDelayMs}ms` }
                      : { top: avgLineY }
                  }
                />

                <div
                  className={`${styles.avgLabel} ${animateIn ? styles.avgLabelIn : styles.avgLabelHidden}`}
                  style={
                    animateIn
                      ? {
                          top: clamp(avgLineY - 12, 0, plotPx - 14),
                          animationDelay: `${avgLabelDelayMs}ms`,
                        }
                      : { top: clamp(avgLineY - 12, 0, plotPx - 14) }
                  }
                >
                  7D avg
                </div>
              </div>
            </div>
          </div>

          {/* ROW 2: X labels */}
          <div className={styles.xRow} style={{ height: xLabelH }}>
            <div className={styles.yAxisSpacer} />
            <div className={styles.xLabels}>
              {model.points.map((p, idx) => {
                const isToday = idx === model.todayIdx;
                const dayLabel = p.date.toLocaleDateString(undefined, { weekday: 'short' });

                return (
                  <div
                    key={`x-${p.key}`}
                    className={`${styles.dayLabel} ${isToday ? styles.dayLabelToday : ''}`}
                  >
                    {isToday ? 'Today' : dayLabel.slice(0, 3)}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom text */}
      <div className={styles.bottomStack}>
        <div
          className={`${styles.summaryRow} ${animateIn ? styles.waterIn : styles.waterHidden}`}
          style={
            animateIn
              ? ({ animationDelay: `${detailsStartMs}ms` } as CSSProperties)
              : undefined
          }
        >
          <div className={styles.summaryTop}>
            <b>7D total</b>: {weekTestTotal}m test · {weekStudyTotal}m study
          </div>

          <div className={styles.summaryRow2}>
            <span>
              <b>Avg/day</b>: {Math.round(model.avgTotal)}m
            </span>
            <span className={styles.sep} aria-hidden="true" />
            <span>
              <b>Best</b>: {bestLabel} ({bestPoint?.total ?? 0}m)
            </span>
          </div>
        </div>

        <div
          className={`${styles.footerRow} ${animateIn ? styles.waterIn : styles.waterHidden}`}
          style={
            animateIn
              ? ({ animationDelay: `${detailsStartMs + detailsStaggerMs}ms` } as CSSProperties)
              : undefined
          }
        >
          <span>
            <b>Routine</b>: {activeDays}/7 days
            <span className={styles.sep}></span>
            <b>Streak</b>: {streakDays ?? 0}d
          </span>

          {model.hasCompare ? <span className={styles.muted}>Compare overlay: enabled</span> : null}
        </div>

        {confidenceNote ? (
          <div
            className={`${styles.confidenceNote} ${animateIn ? styles.waterIn : styles.waterHidden}`}
            style={
              animateIn
                ? ({ animationDelay: `${detailsStartMs + detailsStaggerMs * 2}ms` } as CSSProperties)
                : undefined
            }
          >
            {confidenceNote}
          </div>
        ) : null}
      </div>
    </div>
  );
}