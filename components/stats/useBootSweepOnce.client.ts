// components/stats/useBootSweepOnce.client.ts
'use client';

import { useEffect, useRef, useState } from 'react';

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

type Segment = {
  from: number;
  to: number;
  durationMs: number;
  ease: (t: number) => number;
};

function animateSegment(seg: Segment, onUpdate: (v: number) => void, onDone: () => void) {
  let raf = 0;
  const start = performance.now();

  const frame = (now: number) => {
    const tRaw = (now - start) / seg.durationMs;
    const t = Math.max(0, Math.min(1, tRaw));
    const v = seg.from + (seg.to - seg.from) * seg.ease(t);
    onUpdate(v);

    if (t >= 1) {
      onDone();
      return;
    }
    raf = requestAnimationFrame(frame);
  };

  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}

export function useBootSweepOnce(opts: {
  target: number;
  seen: boolean;
  enabled: boolean;
  segments?: (target: number) => Segment[];
}) {
  const { seen, enabled } = opts;

  const safeTarget = Number.isFinite(opts.target) ? opts.target : 0;

  const [display, setDisplay] = useState<number>(0);

const finishedTargetRef = useRef<number | null>(null);
  const cancelRef = useRef<null | (() => void)>(null);

  const setDisplaySafe = (v: number) => setDisplay(Number.isFinite(v) ? v : 0);

  // If you disable (eg after reset/loading), allow replay later.
  useEffect(() => {
    if (!enabled) {
      finishedTargetRef.current = null;
      cancelRef.current?.();
      cancelRef.current = null;
      setDisplay(0);
    }
  }, [enabled]);

useEffect(() => {
  if (!seen || !enabled) return;

  // ✅ Only skip if we FINISHED this target already
  if (finishedTargetRef.current === safeTarget) return;

  // reduced motion => snap and mark finished
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
    setDisplaySafe(safeTarget);
    finishedTargetRef.current = safeTarget;
    return;
  }

  // cancel any in-flight animation
  cancelRef.current?.();
  cancelRef.current = null;

  const segs =
    opts.segments?.(safeTarget) ?? [
      { from: 0, to: 100, durationMs: 600, ease: easeOutCubic },
      { from: 100, to: safeTarget, durationMs: 300, ease: easeOutCubic },
    ];

  const totalMs = segs.reduce((s, seg) => s + (seg.durationMs || 0), 0);

  // ✅ Failsafe: if RAF never progresses, snap to target
  const timeoutId = window.setTimeout(() => {
    if (finishedTargetRef.current !== safeTarget) {
      setDisplaySafe(safeTarget);
      finishedTargetRef.current = safeTarget;
    }
  }, totalMs + 250);

  let i = 0;

  const runNext = () => {
    if (i >= segs.length) {
      // ✅ Mark finished ONLY when done
      window.clearTimeout(timeoutId);
      setDisplaySafe(safeTarget);
      finishedTargetRef.current = safeTarget;
      cancelRef.current = null;
      return;
    }

    const seg = segs[i++];
    cancelRef.current = animateSegment(seg, setDisplaySafe, runNext);
  };

  runNext();

  return () => {
    window.clearTimeout(timeoutId);
    cancelRef.current?.();
    cancelRef.current = null;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [seen, enabled, safeTarget]);

  return display;
}