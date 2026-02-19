//components/stats/useBootSweepOnce.client.ts
'use client';

import { useEffect, useRef, useState } from 'react';

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}
function easeInCubic(t: number) {
  return t * t * t;
}

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

type Segment = {
  from: number;
  to: number;
  durationMs: number;
  ease: (t: number) => number;
};

function animateTimeline(
  segs: Segment[],
  onUpdate: (v: number) => void
) {
  let raf = 0;
  const start = performance.now();
  const total = segs.reduce((sum, s) => sum + s.durationMs, 0);

  // set first value immediately (no initial wait)
  if (segs.length > 0) onUpdate(segs[0].from);

  const frame = (now: number) => {
    const elapsed = now - start;

    // End: snap to final exactly
    if (elapsed >= total) {
      onUpdate(segs[segs.length - 1]?.to ?? 0);
      return;
    }

    // Find which segment we are in
    let acc = 0;
    for (const seg of segs) {
      const end = acc + seg.durationMs;
      if (elapsed <= end) {
        const local =
          seg.durationMs <= 0 ? 1 : (elapsed - acc) / seg.durationMs;
        const u = Math.max(0, Math.min(1, local));
        const eased = seg.ease(u);
        const v = seg.from + (seg.to - seg.from) * eased;
        onUpdate(v);
        break;
      }
      acc = end;
    }

    raf = requestAnimationFrame(frame);
  };

  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}


export function useBootSweepOnce(opts: {
  target: number;
  seen: boolean;
  enabled: boolean; // gate until data is ready
  segments?: (target: number) => Segment[];
}) {
  const { target, seen, enabled } = opts;

  const safeTarget = Number.isFinite(target) ? target : 0;
const setDisplaySafe = (v: number) => setDisplay(Number.isFinite(v) ? v : 0);

const [display, setDisplay] = useState<number>(0);  
const playedRef = useRef(false);

  // After played, keep display synced to target without replay.
  useEffect(() => {
    if (playedRef.current) setDisplay(safeTarget);
  }, [target]);

  useEffect(() => {
    if (!seen || !enabled) return;
    if (playedRef.current) return;

    // reduced motion => no animation
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
      playedRef.current = true;
      setDisplay(safeTarget);
      return;
    }

    playedRef.current = true;

    const segs = opts.segments?.(safeTarget) ?? [
  { from: 0, to: 100, durationMs: 600, ease: easeOutCubic },
  { from: 100, to: safeTarget, durationMs: 300, ease: easeOutCubic },
];


    let cancel: null | (() => void) = null;
    let i = 0;

    const runNext = () => {
      if (i >= segs.length) return;
      const seg = segs[i++];
      cancel = animateSegment(seg, setDisplaySafe, runNext);
    };

    runNext();

    return () => cancel?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen, enabled]);

  return display;
}