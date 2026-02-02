'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './RhythmHeatmap.module.css';

type HeatmapVM = {
  weekdays: string[];
  dayParts: Array<{ key: string; label: string }>;
  // stays as [dayPart][weekday]
  cells: Array<Array<{ avgScore: number; attemptsCount: number }>>;
  best: {
    weekdayLabel: string;
    dayPartLabel: string;
    avgScore: number;
    attemptsCount: number;
  } | null;
  lowConfidenceNote: string | null;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function cellBg(avgScore: number, attemptsCount: number) {
  const s01 = clamp(avgScore / 100, 0, 1);
  const hue = 210 - 155 * s01;

  let sat = 62;
  let light = 86;
  let alpha = 0.85;

  if (attemptsCount <= 0) {
    sat = 12;
    light = 94;
    alpha = 0.95;
  } else if (attemptsCount === 1) {
    sat *= 0.55;
    alpha *= 0.70;
  } else if (attemptsCount === 2) {
    sat *= 0.75;
    alpha *= 0.82;
  }

  return `hsla(${hue.toFixed(0)}, ${sat.toFixed(0)}%, ${light.toFixed(0)}%, ${clamp(alpha, 0.55, 0.98)})`;
}

export default function RhythmHeatmap({ data }: { data: HeatmapVM }) {
  // r = weekday row index, c = dayPart col index (swapped UI)
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);
  const [pinned, setPinned] = useState<{ r: number; c: number } | null>(null);

  const [pointerType, setPointerType] = useState<'mouse' | 'touch' | 'pen'>('mouse');
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);

  // refs: rows = weekdays, cols = dayParts
  const cellRefs = useRef<(HTMLDivElement | null)[][]>([]);
  const ensureRef = (r: number, c: number) => {
    if (!cellRefs.current[r]) cellRefs.current[r] = [];
    if (!cellRefs.current[r][c]) cellRefs.current[r][c] = null;
  };

  const flat = useMemo(() => data.cells.flat(), [data.cells]);
  const maxCount = useMemo(() => Math.max(1, ...flat.map((x) => x.attemptsCount)), [flat]);

  const bestRC = useMemo(() => {
    if (!data.best) return null;
    const r = data.weekdays.findIndex((w) => w === data.best!.weekdayLabel);
    const c = data.dayParts.findIndex((p) => p.label === data.best!.dayPartLabel);
    if (r < 0 || c < 0) return null;
    return { r, c };
  }, [data.best, data.weekdays, data.dayParts]);

  const active = pinned ?? hover;

  const tip =
    active != null
      ? {
          r: active.r,
          c: active.c,
          weekday: data.weekdays[active.r],
          part: data.dayParts[active.c]?.label ?? '',
          // IMPORTANT: data is still [dayPart][weekday]
          cell: data.cells[active.c]?.[active.r] ?? { avgScore: 0, attemptsCount: 0 },
        }
      : null;

  // Close pinned tooltip when tapping outside (mobile)
  useEffect(() => {
    function onDocDown(e: PointerEvent) {
      if (!pinned) return;

      const t = e.target as Node | null;
      const inWrap = !!wrapRef.current && !!t && wrapRef.current.contains(t);
      const inTip = !!tipRef.current && !!t && tipRef.current.contains(t);

      if (!inWrap && !inTip) setPinned(null);
    }
    window.addEventListener('pointerdown', onDocDown, { passive: true });
    return () => window.removeEventListener('pointerdown', onDocDown);
  }, [pinned]);

  // Compute portal tooltip position (clamped to viewport)
  const [tipPos, setTipPos] = useState<{ left: number; top: number; placement: 'top' | 'bottom' } | null>(null);

  useEffect(() => {
    if (!active) {
      setTipPos(null);
      return;
    }

    const el = cellRefs.current?.[active.r]?.[active.c];
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const TIP_W = 300; // keep in sync with CSS width
    const M = 10;

    const centerX = rect.left + rect.width / 2;
    const left = clamp(centerX, M + TIP_W / 2, vw - M - TIP_W / 2);

    // Prefer above; if not enough space, place below
    const preferTop = rect.top > 140;
    const placement: 'top' | 'bottom' = preferTop ? 'top' : 'bottom';

    const top =
      placement === 'top'
        ? clamp(rect.top - 12, M, vh - M) // actual translation handled in CSS
        : clamp(rect.bottom + 12, M, vh - M);

    setTipPos({ left, top, placement });
  }, [active]);

  const isCoarse =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(hover: none)').matches || window.matchMedia?.('(pointer: coarse)').matches);

  return (
    <div className={styles.wrap} ref={wrapRef}>
      {/* Callout pill */}
      <div className={styles.calloutPill}>
        <div className={styles.starBadge} aria-hidden="true">★</div>
        <div className={styles.calloutText}>
          {data.best ? (
            <>
              Your best window: <b>{data.best.weekdayLabel} {data.best.dayPartLabel}</b> — avg{' '}
              <b>{data.best.avgScore}%</b>{' '}
              <span className={styles.calloutMuted}>
                ({data.best.attemptsCount} test{data.best.attemptsCount === 1 ? '' : 's'})
              </span>
            </>
          ) : (
            <>Not enough data yet.</>
          )}
        </div>
      </div>

      {/* Soft panel */}
      <div className={styles.panel}>
        <div className={styles.matrix}>
          <div className={styles.corner} />

          {/* TOP: Day parts */}
          {data.dayParts.map((p, c) => (
            <div
              key={`col-${p.key}`}
              className={styles.colLabel}
              style={{ gridColumn: c + 2, gridRow: 1 }}
            >
              {p.label}
            </div>
          ))}

          {/* LEFT: Weekdays */}
          {data.weekdays.map((d, r) => (
            <div
              key={`row-${d}`}
              className={styles.rowLabel}
              style={{ gridColumn: 1, gridRow: r + 2 }}
            >
              {d}
            </div>
          ))}

          {/* CELLS: rows=weekdays, cols=dayParts */}
          {data.weekdays.map((weekday, r) =>
            data.dayParts.map((part, c) => {
              ensureRef(r, c);

              const cell = data.cells[c]?.[r] ?? { avgScore: 0, attemptsCount: 0 };
              const bg = cellBg(cell.avgScore, cell.attemptsCount);
              const dotA = clamp(cell.attemptsCount / maxCount, 0, 1);

              const isBest = !!bestRC && bestRC.r === r && bestRC.c === c;
              const canPulse = isBest && cell.attemptsCount >= 3;

              return (
                <div
                  key={`cell-${r}-${c}`}
                  ref={(node) => {
                    cellRefs.current[r][c] = node;
                  }}
                  className={[
                    styles.cell,
                    isBest ? styles.bestCell : '',
                    canPulse ? styles.bestPulse : '',
                    cell.attemptsCount === 0 ? styles.emptyCell : '',
                    pinned?.r === r && pinned?.c === c ? styles.pinnedCell : '',
                  ].filter(Boolean).join(' ')}
                  style={{ gridColumn: c + 2, gridRow: r + 2, background: bg }}
                  onPointerDown={(e) => setPointerType((e.pointerType as any) ?? 'mouse')}
                  onMouseEnter={() => setHover({ r, c })}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => {
                    // Tap-to-pin (coarse pointers), optional for mouse too
                    const allowPin = pointerType !== 'mouse' || isCoarse;
                    if (!allowPin) return;

                    setPinned((prev) => (prev?.r === r && prev?.c === c ? null : { r, c }));
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className={styles.cellValue}>
                    {cell.attemptsCount > 0 ? `${cell.avgScore}%` : '—'}
                  </div>

                  {cell.attemptsCount > 0 ? (
                    <>
                      <span className={styles.dot} style={{ opacity: dotA }} />
                      <span className={styles.count}>{cell.attemptsCount}</span>
                    </>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        {/* Tiny legend (see section 2) */}
        <div className={styles.legend}>
          <div className={styles.legendRow}>
            <span className={styles.legendLabel}>Score</span>
            <span className={`${styles.swatch} ${styles.swLow}`} />
            <span className={`${styles.swatch} ${styles.swMid}`} />
            <span className={`${styles.swatch} ${styles.swHigh}`} />
            <span className={styles.legendText}>low → high</span>
          </div>

          <div className={styles.legendRow}>
            <span className={styles.legendLabel}>Confidence</span>
            <span className={styles.legendDot} style={{ opacity: 0.35 }} />
            <span className={styles.legendDot} style={{ opacity: 0.65 }} />
            <span className={styles.legendDot} style={{ opacity: 1 }} />
            <span className={styles.legendText}>more tests = stronger</span>
          </div>
        </div>

        {data.lowConfidenceNote ? (
          <div className={styles.confidenceNote}>{data.lowConfidenceNote}</div>
        ) : null}
      </div>

      {/* PORTAL TOOLTIP (not clipped) */}
      {tip && tipPos
        ? createPortal(
            <div
              ref={tipRef}
              className={styles.tooltip}
              data-placement={tipPos.placement}
              style={{ left: tipPos.left, top: tipPos.top }}
              role="tooltip"
            >
              <div className={styles.tipTitle}>
                {tip.weekday} {tip.part}
              </div>

              <div className={styles.tipSub}>
                Avg {tip.cell.avgScore}% · {tip.cell.attemptsCount} test{tip.cell.attemptsCount === 1 ? '' : 's'}
              </div>

              <div className={styles.tipRule} />

              <div className={styles.tipBody}>
                <div className={styles.tipMuted}>
                  {tip.cell.attemptsCount < 3 ? 'Low confidence' : 'Good confidence'}
                </div>
              </div>

              <div className={styles.tipArrow} aria-hidden="true" />
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
