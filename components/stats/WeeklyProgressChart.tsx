// components/stats/WeeklyProgressChart.tsx
'use client';

import styles from './WeeklyProgressChart.module.css';

type WeekRow = {
  weekStart: number;
  testsCompleted: number;
  questionsAnswered: number;
  avgScore: number;
};

function fmtWeekStart(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}


export default function WeeklyProgressChart(props: {
  series: WeekRow[];
  bestWeekQuestions: number;
  streakWeeks: number;
  rows?: number; // default 6
}) {
  const { series, bestWeekQuestions, streakWeeks, rows = 6 } = props;

  const shown = series.slice(-rows);
  const maxAnswered = Math.max(1, ...shown.map((w) => w.questionsAnswered));
    const midAnswered = Math.round(maxAnswered / 2);

// --- chart geometry (same 340-ish scale as your ScoreChart) ---
const W = 340;
const H = 110;

const padL = 12;
const padR = 12;
const padT = 10;
const padB = 26; // room for week labels

const plotW = W - padL - padR;
const plotH = H - padT - padB;

const slot = shown.length ? plotW / shown.length : plotW;
const barW = Math.max(10, slot * 0.55);

const xFor = (i: number) => padL + i * slot + (slot - barW) / 2;
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
    ? ""
    : shown
        .map((w, i) => `${i === 0 ? "M" : "L"} ${cxFor(i).toFixed(2)} ${yForAvg(w.avgScore).toFixed(2)}`)
        .join(" ");

  return (
    <div className={styles.wrap}>
      <div className={styles.metaRow}>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Best week:</span> <b>{bestWeekQuestions}</b> questions
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Consistency streak:</span> <b>{streakWeeks}</b> weeks
        </div>
      </div>

      <div className={styles.box}>
  <div className={styles.chartShell}>
    <svg className={styles.svg} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {/* Y axis for "questions answered" */}
<line x1={padL} y1={padT} x2={padL} y2={padT + plotH} className={styles.yAxisLine} />

{[
  { v: maxAnswered, y: yMax },
  { v: midAnswered, y: yMid },
  { v: 0, y: y0 },
].map((t) => (
  <g key={`yt-${t.v}`}>
    <line x1={padL - 4} y1={t.y} x2={padL} y2={t.y} className={styles.yAxisTick} />
    <text x={padL - 6} y={t.y + 3} textAnchor="end" className={styles.yAxisText}>
      {t.v}
    </text>
  </g>
))}

      {/* subtle grid */}
      <line x1={padL} y1={yMax} x2={W - padR} y2={yMax} className={styles.grid} />
<line x1={padL} y1={yMid} x2={W - padR} y2={yMid} className={styles.grid} />
<line x1={padL} y1={y0}  x2={W - padR} y2={y0}  className={styles.gridBase} />


      {/* bars: questionsAnswered */}
      {shown.map((w, i) => {
        const h = barHFor(w.questionsAnswered);
        const x = xFor(i);
        const y = padT + (plotH - h);
        const isLast = i === shown.length - 1;
        const label = fmtWeekStart(w.weekStart);

        return (
          <g key={w.weekStart}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={8}
              className={isLast ? styles.barActive : styles.bar}
            >
              <title>{`Week of ${label}\n${w.questionsAnswered} answered · ${w.testsCompleted} tests · Avg ${w.avgScore}%`}</title>
            </rect>

            <text x={cxFor(i)} y={H - 10} textAnchor="middle" className={styles.axisText}>
              {label}
            </text>
          </g>
        );
      })}

      {/* thin line: avgScore */}
      {avgPathD ? (
        <>
          <path d={avgPathD} className={styles.avgLine} />
          {/* latest dot only */}
          <circle
            cx={cxFor(shown.length - 1)}
            cy={yForAvg(shown[shown.length - 1].avgScore)}
            r={3.5}
            className={styles.avgDot}
          />
        </>
      ) : null}
    </svg>
  </div>
</div>

    </div>
  );
}
