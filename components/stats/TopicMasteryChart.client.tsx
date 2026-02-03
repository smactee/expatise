'use client';

import styles from './TopicMasteryChart.module.css';
import { labelForTag } from '@/lib/qbank/tagTaxonomy';
import type { TopicMasteryVM } from '@/lib/stats/computeStats';

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
  const topSub = data.weakestSubtopics ?? [];
  const topics = data.topics ?? [];

  const maxAttempted = Math.max(
    1,
    ...topSub.map((x) => x.attempted),
    ...topics.map((t) => t.attempted),
    ...topics.flatMap((t) => t.subtopics.map((s) => s.attempted))
  );

  return (
    <div className={styles.wrap}>
      {/* Top “wow” pills */}
      <div className={styles.hero}>
        <div className={styles.heroTitle}>Weakest right now</div>

        {topSub.length === 0 ? (
          <div className={styles.empty}>
            Not enough topic data yet (need at least {data.minAttempted} answered per subtopic).
          </div>
        ) : (
          <div className={styles.heroScroller}>
            {topSub.map((s) => {
              const op = confOpacity(s.attempted, maxAttempted);
              const bg = chipBgFromPct(s.accuracyPct);

              return (
                <div
                  key={s.tag}
                  className={styles.pill}
                  style={{ background: bg, opacity: op }}
                  title={`${labelForTag(s.tag)} · ${s.accuracyPct}% · ${s.attempted} answered`}
                >
                  <div className={styles.pillTop}>
                    <span className={styles.pillLabel}>{labelForTag(s.tag)}</span>
                    <span className={styles.pillPct}>{s.accuracyPct}%</span>
                  </div>
                  <div className={styles.pillMeta}>{s.attempted} answered</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Topic list */}
      <div className={styles.list}>
        {topics.map((t) => {
          const topicLabel = labelForTag(t.topicKey);
          const op = confOpacity(t.attempted, maxAttempted);
          const subs = t.subtopics ?? [];

          return (
            <div key={t.topicKey} className={styles.row}>
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
                  className={styles.barFill}
                  style={{ width: `${clamp(t.accuracyPct, 0, 100)}%` }}
                />
              </div>

              {subs.length > 0 ? (
                <div className={styles.subRow}>
                  {subs.map((s) => (
                    <div
                      key={s.tag} // ✅ fixes React key warning
                      className={styles.subChip}
                      style={{ opacity: confOpacity(s.attempted, maxAttempted) }}
                      title={`${labelForTag(s.tag)} · ${s.accuracyPct}% · ${s.attempted} answered`}
                    >
                      <span className={styles.subLabel}>{labelForTag(s.tag)}</span>
                      <span className={styles.subPct}>{s.accuracyPct}%</span>

                      <span className={styles.subMeterTrack}>
                        <span
                          className={styles.subMeterFill}
                          style={{ width: `${clamp(s.accuracyPct, 0, 100)}%` }}
                        />
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.subEmpty}>Need more answers in this topic to rank subtopics.</div>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.note}>
        Confidence increases as you answer more questions in each subtopic (min {data.minAttempted}).
      </div>
    </div>
  );
}
