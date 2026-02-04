//components/stats/TopicMasteryChart.client.tsx
'use client';

import styles from './TopicMasteryChart.module.css';
import { labelForTag } from '@/lib/qbank/tagTaxonomy';
import type { TopicMasteryVM } from '@/lib/stats/computeStats';
import DragScrollRow from "@/components/DragScrollRow";
import { useEffect, useRef, useState, useMemo } from 'react';
import { useOnceInMidView } from '@/components/stats/useOnceInView.client';
import type { CSSProperties } from 'react';



function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function confOpacity(attempted: number, maxAttempted: number) {
  const t = clamp(attempted / Math.max(1, maxAttempted), 0, 1);
  return 0.45 + 0.55 * t;
}

/**
 * 0% => more yellow, 100% => more blue
 * (matches “yellow first, then blue as it gets closer to 100%”)
 */
function chipBgFromPct(pct: number) {
  const t = clamp(pct / 100, 0, 1);

  // yellow -> blue
  const y = { r: 255, g: 197, b: 66 };
  const b = { r: 43, g: 124, b: 175 };

  const r = Math.round(y.r + (b.r - y.r) * t);
  const g = Math.round(y.g + (b.g - y.g) * t);
  const bb = Math.round(y.b + (b.b - y.b) * t);

  // soft fill
  return `rgb(${r} ${g} ${bb} / 0.22)`;
}

export default function TopicMasteryChart({ data }: { data: TopicMasteryVM }) {
  // show all (scrollable)
  // all topics
const topics = data.topics ?? [];

// ✅ hero pills: 4 lowest-accuracy subtopics (even if attempted < minAttempted)
const topSub = useMemo(() => {
  const all = topics.flatMap((t) => t.subtopics ?? []);

  // optional: de-dupe by tag (keeps the lowest accuracy if duplicates exist)
  const byTag = new Map<string, (typeof all)[number]>();
  for (const s of all) {
    const prev = byTag.get(s.tag);
    const sPct = Number.isFinite(s.accuracyPct) ? s.accuracyPct : 0;
    const pPct = prev && Number.isFinite(prev.accuracyPct) ? prev.accuracyPct : 0;

    if (!prev || sPct < pPct) byTag.set(s.tag, s);
  }

  const arr = Array.from(byTag.values());

  // lowest % first (0% will be first), tie-breaker: fewer attempts first
  arr.sort((a, b) => {
    const ap = Number.isFinite(a.accuracyPct) ? a.accuracyPct : 0;
    const bp = Number.isFinite(b.accuracyPct) ? b.accuracyPct : 0;
    if (ap !== bp) return ap - bp;
    return (a.attempted ?? 0) - (b.attempted ?? 0);
  });

  return arr.slice(0, 4);
}, [topics]);


//useOnceInMidView hooks for hero and list
const { ref: heroRef, seen: heroInView } = useOnceInMidView<HTMLDivElement>();
const { ref: listRef, seen: listInView } = useOnceInMidView<HTMLDivElement>();

  const maxAttempted = Math.max(
    1,
    ...topSub.map((x) => x.attempted),
    ...topics.map((t) => t.attempted),
    ...topics.flatMap((t) => t.subtopics.map((s) => s.attempted))
  );

  return (
    <div className={styles.wrap}>
      {/* Top “wow” pills */}
      <div ref={heroRef} className={styles.hero}>
        <div className={styles.heroTitle}>Weakest right now</div>

        {topSub.length === 0 ? (
          <div className={styles.empty}>
            Not enough topic data yet (need at least {data.minAttempted} answered per subtopic).
          </div>
        ) : (
          <DragScrollRow className={styles.heroScroller}>
            {topSub.map((s, i) => {
              const low = s.attempted < data.minAttempted;
              const op = confOpacity(s.attempted, maxAttempted) * (low ? 0.75 : 1);
              const bg = chipBgFromPct(s.accuracyPct);
              const heroDelay = i * 70;
              return (
                <div
                  key={s.tag}
                  className={`${styles.pill} ${heroInView ? styles.pillIn : styles.pillHidden}`}
                  style={{ 
                    background: bg,
              ['--op' as any]: op,
              ['--d' as any]: `${heroDelay}ms`,
            } as CSSProperties}
                  title={`${labelForTag(s.tag)} · ${s.accuracyPct}% · ${s.attempted} answered`}
                >
<div className={styles.pillTop}>
  <span className={styles.pillTitle}>
    <span className={styles.pillLabel}>{labelForTag(s.tag)}</span>
    <span className={styles.pillPct}>{s.accuracyPct}%</span>
  </span>
</div>
 <div className={styles.pillMeta}>{s.attempted} answered</div>
</div>
              );
            })}
 </DragScrollRow>
          
        )}
      </div>
      

      {/* Topic list */}
      <div ref={listRef} className={styles.list}>
        {topics.map((t, ti) => {
          const topicLabel = labelForTag(t.topicKey);

// topic-level confidence (no `s` here; `s` doesn't exist in this scope)
const lowTopic = t.attempted < data.minAttempted;
const op = confOpacity(t.attempted, maxAttempted) * (lowTopic ? 0.75 : 1);

const subs = t.subtopics ?? [];


           const rowDelay = 220 + ti * 90;      // rows come in after hero settles
  const barDelay = rowDelay + 120;     // bar follows row
  const chipBase = rowDelay + 170;     // chips follow bar
  const chipStep = 55;                // chip stagger
  const meterOffset = 120;            // meter follows chip


          return (
    <div
      key={t.topicKey}
      className={`${styles.row} ${listInView ? styles.rowIn : styles.rowHidden}`}
      style={{ ['--d' as any]: `${rowDelay}ms` } as CSSProperties}
    >
      <div className={styles.rowHead}>
        <div className={styles.topicName}>{topicLabel}</div>
        <div className={styles.rightMeta}>
          <span className={styles.topicPct}>{t.accuracyPct}%</span>
          <span className={styles.dot} style={{ opacity: op }} />
          <span className={styles.answered}>{t.attempted} answered</span>
        </div>
      </div>

      <div className={styles.barTrack}>
        <div
          className={`${styles.barFill} ${listInView ? styles.barFillGrow : styles.barFillHidden}`}
          style={{
            ['--w' as any]: `${clamp(t.accuracyPct, 0, 100)}%`,
            ['--d' as any]: `${barDelay}ms`, // ✅ bar anim delay
          } as CSSProperties}
        />
      </div>

      {subs.length > 0 ? (
        <DragScrollRow className={styles.subRow}>
          {subs.map((s, si) => {
            const low = s.attempted < data.minAttempted;
  const sop = confOpacity(s.attempted, maxAttempted) * (low ? 0.75 : 1);

  const chipDelay = chipBase + si * chipStep;
  const meterDelay = chipDelay + meterOffset;

            return (
              <div
                key={s.tag}
                className={`${styles.subChip} ${listInView ? styles.chipIn : styles.chipHidden}`}
                style={{
                  ['--op' as any]: sop,
                  ['--d' as any]: `${chipDelay}ms`, // ✅ chip delay
                } as CSSProperties}
                title={`${labelForTag(s.tag)} · ${s.accuracyPct}% · ${s.attempted} answered`}
              >
                <span className={styles.subText}>
                  <span className={styles.subLabel}>{labelForTag(s.tag)}</span>
                  <span className={styles.subPct}>{s.accuracyPct}%</span>
                </span>

                <span className={styles.subMeterTrack}>
                  <span
                    className={`${styles.subMeterFill} ${
                      listInView ? styles.subMeterGrow : styles.subMeterHidden
                    }`}
                    style={{
                      ['--w' as any]: `${clamp(s.accuracyPct, 0, 100)}%`,
                      ['--d' as any]: `${meterDelay}ms`, // ✅ meter follows chip
                    } as CSSProperties}
                  />
                </span>
              </div>
            );
          })}
        </DragScrollRow>
      ) : (
        <div className={styles.subEmpty}>Need more answers in this topic to rank subtopics.</div>
      )}
    </div>
  );
})}
      </div>
    </div>
  );
}