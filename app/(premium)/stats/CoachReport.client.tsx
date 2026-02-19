'use client';

import React, { useMemo } from 'react';
import styles from './stats.module.css';

type Section = { title: string; lines: string[] };

function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatInline(line: string) {
  // Safe HTML baseline
  let s = escapeHtml(line);

  // Consistent emphasis (deterministic, not model-dependent)
  // Bold: percentages, mins, tests, questions, streak-ish numbers
  s = s.replace(
    /\b(\d{1,3}%|\d+\s?(?:min|mins|tests?|questions?|days?|sessions?))\b/gi,
    `<strong class="${styles.coachMetric}">$1</strong>`
  );

  // Bold the "Why/Next/Target/Close" keys
  s = s.replace(
    /\b(Why|Next|Target|Close)\s*:/g,
    `<span class="${styles.coachKey}">$1:</span>`
  );

  return s;
}

function parseCoachReport(report: string): Section[] {
  const lines = report.replace(/\r/g, '').split('\n');

  const sections: Section[] = [];
  let cur: Section | null = null;

  for (const raw of lines) {
    const line = raw.trimEnd();

    const m = line.match(/^###\s+(.+)\s*$/);
    if (m) {
      if (cur) sections.push(cur);
      cur = { title: m[1].trim(), lines: [] };
      continue;
    }

    if (!cur) cur = { title: 'Coach', lines: [] };
    cur.lines.push(line);
  }

  if (cur) sections.push(cur);

  // Drop empty trailing lines per section
  for (const s of sections) {
    while (s.lines.length && s.lines[s.lines.length - 1].trim() === '') s.lines.pop();
  }

  return sections.filter((s) => s.title || s.lines.some((l) => l.trim()));
}

export default function CoachReport({ report }: { report: string }) {
  const sections = useMemo(() => parseCoachReport(report), [report]);

  return (
    <div className={styles.coachReportRich}>
      {sections.map((sec) => {
        const isTarget = sec.title.toLowerCase().includes('one target');

        return (
          <section
            key={sec.title}
            className={`${styles.coachSection} ${isTarget ? styles.coachTargetCallout : ''}`}
          >
            <h3 className={styles.coachSectionTitle}>{sec.title}</h3>

            <div className={styles.coachSectionBody}>
              {renderLines(sec.lines)}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function renderLines(lines: string[]) {
  // Group consecutive bullets into a single <ul>
  const out: React.ReactNode[] = [];
  let bulletBuf: string[] = [];

  const flushBullets = (key: string) => {
    if (!bulletBuf.length) return;
    out.push(
      <ul key={key} className={styles.coachList}>
        {bulletBuf.map((b, i) => (
          <li
            key={i}
            className={styles.coachLi}
            dangerouslySetInnerHTML={{ __html: formatInline(b) }}
          />
        ))}
      </ul>
    );
    bulletBuf = [];
  };

  lines.forEach((raw, idx) => {
    const line = raw.trim();
    const isBullet =
      line.startsWith('- ') ||
      line.startsWith('• ') ||
      /^\d+\)\s+/.test(line);

    if (isBullet) {
      bulletBuf.push(line.replace(/^[-•]\s+/, '').replace(/^\d+\)\s+/, ''));
      return;
    }

    flushBullets(`b-${idx}`);

    if (!line) {
      out.push(<div key={`sp-${idx}`} className={styles.coachSpacer} />);
      return;
    }

    out.push(
      <p
        key={`p-${idx}`}
        className={styles.coachP}
        dangerouslySetInnerHTML={{ __html: formatInline(line) }}
      />
    );
  });

  flushBullets(`b-end`);
  return out;
}
