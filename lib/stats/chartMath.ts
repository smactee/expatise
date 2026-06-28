// lib/stats/chartMath.ts
// Shared pure math helpers for the stats chart components.
// Behavior-preserving consolidation of the per-file `clamp` / `easeOutCubic`
// reimplementations. Numeric output is byte-identical to the originals.

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
