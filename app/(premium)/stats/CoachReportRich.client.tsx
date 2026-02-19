'use client';

import React from 'react';
import styles from './stats.module.css';

export default function CoachReportRich({ report }: { report: string }) {
  const sections = parseSections(report);

  if (!sections.length) return null;

  return (
    <div className={styles.coachReportRich}>
      {sections.map((s, idx) => {
        const blocks = toBlocks(s.lines);
        const isTarget = s.key === 'F';

        return (
          <section
            key={`${s.key}-${idx}`}
            className={`${styles.coachSection} ${isTarget ? styles.coachTargetCallout : ''}`}
          >
            <h3 className={styles.coachSectionTitle}>{s.title}</h3>

            <div className={styles.coachSectionBody}>
              {blocks.map((b, i) => {
                if (b.kind === 'p') {
                  return (
                    <p key={i} className={styles.coachP}>
                      {renderInline(b.text)}
                    </p>
                  );
                }

                if (b.kind === 'ul') {
                  return (
                    <ul key={i} className={styles.coachList}>
                      {b.items.map((it, j) => (
                        <li key={j} className={styles.coachLi}>
                          {renderItem(it)}
                        </li>
                      ))}
                    </ul>
                  );
                }

                return (
                  <ol key={i} className={styles.coachList}>
                    {b.items.map((it, j) => (
                      <li key={j} className={styles.coachLi}>
                        {renderItem(it)}
                      </li>
                    ))}
                  </ol>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** -----------------------------
 *  Parsing: A) ... → sections
 *  ----------------------------- */
type Section = { key: string; title: string; lines: string[] };
const SECTION_RE = /^([A-F])\)\s*(.+)\s*$/;

function parseSections(report: string): Section[] {
  const text = (report ?? '').replace(/\r\n/g, '\n').trim();
  if (!text) return [];

  const lines = text.split('\n');
  const out: Section[] = [];

  let cur: Section | null = null;

  for (const raw of lines) {
    const line = raw.trimEnd();
    const m = line.trim().match(SECTION_RE);

    if (m) {
      if (cur) out.push(cur);
      cur = { key: m[1], title: m[2].trim(), lines: [] };
      continue;
    }

    if (!cur) cur = { key: '', title: 'Coach', lines: [] };
    if (line.trim().length) cur.lines.push(line);
    else cur.lines.push(''); // preserve blank line for block separation
  }

  if (cur) out.push(cur);
  return out;
}

/** --------------------------------
 *  Turn section lines into blocks
 *  -------------------------------- */
type Block =
  | { kind: 'p'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] };

function toBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let pBuf: string[] = [];
  let listKind: 'ul' | 'ol' | null = null;
  let listItems: string[] = [];

  const flushP = () => {
    const t = pBuf.join(' ').trim();
    if (t) blocks.push({ kind: 'p', text: t });
    pBuf = [];
  };

  const flushList = () => {
    if (listKind && listItems.length) blocks.push({ kind: listKind, items: listItems });
    listKind = null;
    listItems = [];
  };

  for (const raw of lines) {
    const t = raw.trim();
    if (!t) {
      flushP();
      flushList();
      continue;
    }

    const bullet = t.match(/^[-•]\s+(.*)$/);
    const ordered = t.match(/^\d+[\).\]]\s+(.*)$/);

    if (bullet) {
      flushP();
      if (listKind && listKind !== 'ul') flushList();
      listKind = 'ul';
      listItems.push(bullet[1]);
      continue;
    }

    if (ordered) {
      flushP();
      if (listKind && listKind !== 'ol') flushList();
      listKind = 'ol';
      listItems.push(ordered[1]);
      continue;
    }

    flushList();
    pBuf.push(t);
  }

  flushP();
  flushList();
  return blocks;
}

/** --------------------------------
 *  Premium-ish deterministic chips
 *  -------------------------------- */
const TIME_PREFIX_RE = /^(\d+\s*min)\s*:\s*(.*)$/i;
const DAY_PREFIX_RE = /^(Day\s+\d+(?:\s*[–-]\s*\d+)?)\s*:\s*(.*)$/i;

function renderItem(text: string) {
  const t = text.trim();

  const tm = t.match(TIME_PREFIX_RE);
  if (tm) {
    return (
      <>
        <span className={styles.coachChip}>{tm[1]}</span> {renderInline(tm[2])}
      </>
    );
  }

  const dm = t.match(DAY_PREFIX_RE);
  if (dm) {
    return (
      <>
        <span className={styles.coachChip}>{dm[1]}</span> {renderInline(dm[2])}
      </>
    );
  }

  return <>{renderInline(t)}</>;
}

/**
 * Deterministic emphasis:
 * - (30d)/(7d)/(all-time) → chip
 * - Why:/Next action:/Target: → key
 * - numbers (supports "3,200", "3, 200", "3, 200", "3，200") → metric
 */
function renderInline(text: string): React.ReactNode {
  const WINDOW_RE = /\(\s*(30d|7d|all-time)\s*\)/gi;

  // ✅ Match numbers robustly:
  // - comma groups with optional whitespace + full-width comma
  // - plain integers/decimals
  // - percents
  // - ranges like 40–60
  const METRIC_RE =
    /\b\d{1,3}(?:[,\uFF0C]\s*\d{3})+(?:\.\d+)?%?\b|\b\d+(?:\.\d+)?%?\b|\b\d+\s*[–-]\s*\d+\b|\b\d+-day\b/gi;

  // ✅ include "Next action:"
  const KEY_RE = /\b(Why|Next(?:\s+action)?|Target)\b:/gi;

  const TOKEN_RE = new RegExp(
    `${WINDOW_RE.source}|${KEY_RE.source}|${METRIC_RE.source}`,
    'gi'
  );

  const out: React.ReactNode[] = [];
  let last = 0;

  for (const m of text.matchAll(TOKEN_RE)) {
    const start = m.index ?? 0;
    const match = m[0];

    if (start > last) out.push(text.slice(last, start));

    // window chip
    const w = match.match(WINDOW_RE);
    if (w) {
      const inner = match.replace(/[()]/g, '').replace(/\s+/g, '');
      out.push(
        <span key={`${start}-w`} className={styles.coachChip}>
          {inner}
        </span>
      );
      last = start + match.length;
      continue;
    }

    // key label
    if (match.endsWith(':') && match.match(KEY_RE)) {
      out.push(
        <span key={`${start}-k`} className={styles.coachKey}>
          {match}
        </span>
      );
      last = start + match.length;
      continue;
    }

    // metric
    if (match.match(METRIC_RE)) {
      out.push(
        <strong key={`${start}-m`} className={styles.coachMetric}>
          {match}
        </strong>
      );
      last = start + match.length;
      continue;
    }

    out.push(match);
    last = start + match.length;
  }

  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}
