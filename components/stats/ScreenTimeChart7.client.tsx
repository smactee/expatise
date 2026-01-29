'use client';

import { useMemo, useState } from 'react';
import styles from './ScreenTimeChart7.module.css';

type DayPoint = {
  dayStart: number | string;
  deliberateMin: number;
  studyMin: number;
};


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

export default function ScreenTimeChart7({
  data,
  height = 80,
  timedTestMinutesEstimate,
  streakDays,
}: {
  data: DayPoint[];
  height?: number;
  timedTestMinutesEstimate?: number; // optional
  streakDays?: number;              // optional (you already compute)
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

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

  const avgLineY = Math.round((1 - model.avgTotal / model.maxTotal) * height);

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
  

      {/* Summary row (footer summary under chart, but we can also keep it above; this version puts it above the chart) */}
<div className={styles.summaryRow}>
  <div className={styles.summaryTop}>
    <b>7D total</b>: {weekTestTotal}m test · {weekStudyTotal}m study
  </div>

  <div className={styles.summaryRow2}>
    <span><b>Avg/day</b>: {Math.round(model.avgTotal)}m</span>
    <span className={styles.sep}></span>
    <span><b>Best</b>: {bestLabel} ({bestPoint?.total ?? 0}m)</span>
    <span className={styles.sep}></span>
    <span><b>Streak</b>: {streakDays ?? 0}d</span>
  </div>
</div>



      {/* Chart */}
      <div className={styles.chart} style={{ height }}>
        {/* Avg line */}
        <div className={styles.avgLine} style={{ top: avgLineY }} />
        <div className={styles.avgLabel} style={{ top: clamp(avgLineY - 12, 0, height - 14) }}>
          7D avg
        </div>

        <div className={styles.cols}>
          {model.points.map((p, idx) => {
            const ghostH = Math.round((p.total / model.maxTotal) * height);

            // Ensure tiny values still visible
            const testH = p.deliberateMin > 0 ? Math.max(2, Math.round((p.deliberateMin / model.maxTotal) * height)) : 0;
            const studyH = p.studyMin > 0 ? Math.max(2, Math.round((p.studyMin / model.maxTotal) * height)) : 0;

            const isBest = idx === model.bestIdx && p.total > 0;
            const isToday = idx === model.todayIdx;

            const dayLabel = p.date.toLocaleDateString(undefined, { weekday: 'short' });
            const pctOfWeek = Math.round((p.total / model.weekTotalSafe) * 100);

            const colClass = [
              styles.col,
              isToday ? styles.today : '',
              isBest ? styles.best : '',
              p.total === 0 ? styles.zero : '',
            ].filter(Boolean).join(' ');

            return (
              <div
                key={p.key}
                className={colClass}
                onMouseEnter={() => setHoverIdx(idx)}
                onMouseLeave={() => setHoverIdx(null)}
              >
                <div className={styles.barArea}>
                  {/* Ghost total */}
                  {p.total > 0 ? (
                    <div className={styles.ghost} style={{ height: ghostH }} aria-hidden="true" />
                  ) : (
                    <div className={styles.zeroOutline} aria-hidden="true" />
                  )}

                  {/* Grouped bars (NOT stacked) */}
                  <div className={styles.group}>
                    <div className={styles.test} style={{ height: testH }} />
                    <div className={styles.study} style={{ height: studyH }} />
                  </div>

                  {/* Best badge */}
                  {isBest ? <div className={styles.badge} title="Best day">★</div> : null}

                  {/* Tooltip */}
                  {hoverIdx === idx ? (
                    <div className={styles.tooltip} role="tooltip">
                      <div className={styles.tipTitle}>
                        {isToday ? 'Today' : dayLabel}
                      </div>
                      <div className={styles.tipBody}>
                        <div>Test: <b>{p.deliberateMin}m</b></div>
                        <div>Study: <b>{p.studyMin}m</b></div>
                        <div>Total: <b>{p.total}m</b> · {pctOfWeek}% of week</div>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className={styles.day}>
                  {isToday ? 'Today' : dayLabel.slice(0, 3)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer micro-metrics */}
      <div className={styles.footerRow}>
        <span><b>Consistency</b>: {model.consScore}/100</span>
        {/* Compare overlay gated: only show when we have 14+ days. */}
        {model.hasCompare ? (
  <span className={styles.muted}>Compare overlay: enabled</span>
) : null}

      </div>

      {/* Confidence note */}
      {confidenceNote ? (
        <div className={styles.confidenceNote}>{confidenceNote}</div>
      ) : null}
    </div>
  );
}
