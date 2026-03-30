'use client';

import React, { useMemo } from 'react';
import styles from '@/app/(premium)/stats/stats.module.css';
import { useT } from '@/lib/i18n/useT';
import { COACH_LOCALE_REGISTRY } from '@/lib/coach/locale';
import {
  normalizeCoachReportData,
  parseCoachReportDataFromText,
  type CoachReportData,
  type CoachTodayPlan,
  type CoachTopLever,
} from '@/lib/coach/report';

type CoachReportRichProps = {
  report: CoachReportData | string;
};

type LegacySection = {
  key: string;
  title: string;
  lines: string[];
};

type LegacyBlock =
  | { kind: 'p'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] };

type SectionKey = keyof CoachReportData;

function unique(values: readonly string[]) {
  return Array.from(new Set(values));
}

const localeConfigs = Object.values(COACH_LOCALE_REGISTRY);

const LEGACY_SECTION_ALIASES: Record<SectionKey, string[]> = {
  summary: unique([
    ...localeConfigs.map((config) => config.sectionHeadings.summary),
    'Summary',
  ]),
  snapshot: unique([
    ...localeConfigs.map((config) => config.sectionHeadings.snapshot),
    'Snapshot',
  ]),
  topLevers: unique([
    ...localeConfigs.map((config) => config.sectionHeadings.topLevers),
    'Top levers',
  ]),
  today: unique([
    ...localeConfigs.map((config) => config.sectionHeadings.today),
    'Today',
    'Today (10 / 20 / 40)',
  ]),
  next7Days: unique([
    ...localeConfigs.map((config) => config.sectionHeadings.next7Days),
    'Next 7 days',
  ]),
  oneTarget: unique([
    ...localeConfigs.map((config) => config.sectionHeadings.oneTarget),
    'The One thing',
    'One target',
  ]),
};

const LEGACY_AF_SECTION_MAP: Record<string, SectionKey> = {
  A: 'summary',
  B: 'snapshot',
  C: 'topLevers',
  D: 'today',
  E: 'next7Days',
  F: 'oneTarget',
};

const WHY_LABELS = unique(localeConfigs.flatMap((config) => config.emphasisLabels.why));
const NEXT_LABELS = unique(localeConfigs.flatMap((config) => config.emphasisLabels.next));
const WINDOW_LABELS = unique(localeConfigs.flatMap((config) => Object.values(config.windowLabels)));

const AF_RE = /^([A-F])\)\s*(.+)\s*$/;
const H_RE = /^#{2,3}\s+(.*)$/;

const WINDOW_LABEL_PATTERN = WINDOW_LABELS
  .sort((a, b) => b.length - a.length)
  .map(escapeRegex)
  .join('|');

const TIME_PREFIX_PATTERNS: Array<{ key: keyof CoachTodayPlan; re: RegExp }> = [
  { key: 'ten', re: /^10\s*(?:min|mins?|minutes?|분)\s*[:：-]?\s*(.*)$/i },
  { key: 'twenty', re: /^20\s*(?:min|mins?|minutes?|분)\s*[:：-]?\s*(.*)$/i },
  { key: 'forty', re: /^40\s*(?:min|mins?|minutes?|분)\s*[:：-]?\s*(.*)$/i },
];

export default function CoachReportRich({ report }: CoachReportRichProps) {
  const { t } = useT();
  const reportData = useMemo(() => coerceCoachReportData(report), [report]);

  if (!reportData) return null;

  return (
    <div className={styles.coachReportRich}>
      <section className={styles.coachSection}>
        <h3 className={styles.coachSectionTitle}>{t('stats.coach.sections.summary')}</h3>
        <div className={styles.coachSectionBody}>
          <p className={styles.coachP}>{renderInline(reportData.summary)}</p>
        </div>
      </section>

      <section className={styles.coachSection}>
        <h3 className={styles.coachSectionTitle}>{t('stats.coach.sections.snapshot')}</h3>
        <div className={styles.coachSectionBody}>
          <ul className={styles.coachList}>
            {reportData.snapshot.map((item, idx) => (
              <li key={idx} className={styles.coachLi}>
                {renderInline(item)}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.coachSection}>
        <h3 className={styles.coachSectionTitle}>{t('stats.coach.sections.topLevers')}</h3>
        <div className={styles.coachSectionBody}>
          <ol className={styles.coachList}>
            {reportData.topLevers.map((lever, idx) => (
              <li key={`${lever.title}-${idx}`} className={styles.coachLi}>
                <p className={styles.coachP}>
                  <strong className={styles.coachMetric}>{renderInline(lever.title)}</strong>
                </p>
                <p className={styles.coachP}>
                  <span className={styles.coachKey}>{t('stats.coach.labels.why')}:</span>{' '}
                  {renderInline(lever.why)}
                </p>
                <p className={styles.coachP}>
                  <span className={styles.coachKey}>{t('stats.coach.labels.next')}:</span>{' '}
                  {renderInline(lever.next)}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={styles.coachSection}>
        <h3 className={styles.coachSectionTitle}>{t('stats.coach.sections.today')}</h3>
        <div className={styles.coachSectionBody}>
          <ul className={styles.coachList}>
            <li className={styles.coachLi}>
              <span className={styles.coachChip}>{t('stats.coach.plans.ten')}</span>
              {renderInline(reportData.today.ten)}
            </li>
            <li className={styles.coachLi}>
              <span className={styles.coachChip}>{t('stats.coach.plans.twenty')}</span>
              {renderInline(reportData.today.twenty)}
            </li>
            <li className={styles.coachLi}>
              <span className={styles.coachChip}>{t('stats.coach.plans.forty')}</span>
              {renderInline(reportData.today.forty)}
            </li>
          </ul>
        </div>
      </section>

      <section className={styles.coachSection}>
        <h3 className={styles.coachSectionTitle}>{t('stats.coach.sections.next7Days')}</h3>
        <div className={styles.coachSectionBody}>
          <ul className={styles.coachList}>
            {reportData.next7Days.map((item, idx) => (
              <li key={idx} className={styles.coachLi}>
                {renderInline(item)}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={`${styles.coachSection} ${styles.coachTargetCallout}`}>
        <h3 className={styles.coachSectionTitle}>{t('stats.coach.sections.oneTarget')}</h3>
        <div className={styles.coachSectionBody}>
          <p className={styles.coachP}>
            <span className={styles.coachKey}>{t('stats.coach.labels.target')}:</span>{' '}
            {renderInline(reportData.oneTarget)}
          </p>
        </div>
      </section>
    </div>
  );
}

function coerceCoachReportData(report: CoachReportData | string) {
  if (typeof report !== 'string') {
    return normalizeCoachReportData(report);
  }

  const structured = parseCoachReportDataFromText(report);
  if (structured) return structured;

  return parseLegacyCoachReport(report);
}

function parseLegacyCoachReport(report: string): CoachReportData | null {
  const sections = parseSections(report);
  if (!sections.length) return null;

  const byKey = new Map<SectionKey, LegacySection>();

  for (const section of sections) {
    const key = getLegacySectionKey(section);
    if (key && !byKey.has(key)) {
      byKey.set(key, section);
    }
  }

  const summary = extractSectionText(byKey.get('summary')?.lines ?? []);
  const snapshot = extractSectionItems(byKey.get('snapshot')?.lines ?? []);
  const topLevers = parseTopLevers(byKey.get('topLevers')?.lines ?? []);
  const today = parseToday(byKey.get('today')?.lines ?? []);
  const next7Days = extractSectionItems(byKey.get('next7Days')?.lines ?? []);
  const oneTarget = extractSectionText(byKey.get('oneTarget')?.lines ?? []);

  if (!summary || !snapshot.length || !topLevers.length || !today || !next7Days.length || !oneTarget) {
    return null;
  }

  return {
    summary,
    snapshot,
    topLevers,
    today,
    next7Days,
    oneTarget,
  };
}

function parseSections(report: string): LegacySection[] {
  const text = report.replace(/\r\n/g, '\n').trim();
  if (!text) return [];

  const lines = text.split('\n');
  const afHits = lines.reduce((count, line) => count + (AF_RE.test(line.trim()) ? 1 : 0), 0);
  const headingHits = lines.reduce((count, line) => count + (H_RE.test(line.trim()) ? 1 : 0), 0);

  if (afHits >= 2) return parseAFSections(lines);
  if (headingHits >= 2) return parseHeadingSections(lines);

  return [];
}

function parseAFSections(lines: string[]) {
  const sections: LegacySection[] = [];
  let current: LegacySection | null = null;

  for (const raw of lines) {
    const line = raw.trimEnd();
    const match = line.trim().match(AF_RE);

    if (match) {
      if (current) sections.push(current);
      current = { key: match[1], title: match[2].trim(), lines: [] };
      continue;
    }

    if (!current) continue;
    current.lines.push(line);
  }

  if (current) sections.push(current);
  return sections;
}

function parseHeadingSections(lines: string[]) {
  const sections: LegacySection[] = [];
  let current: LegacySection | null = null;

  for (const raw of lines) {
    const line = raw.trimEnd();
    const match = line.trim().match(H_RE);

    if (match) {
      if (current) sections.push(current);

      const headingText = match[1].trim();
      const split = splitLegacyHeadingContent(headingText);
      current = { key: '', title: split.title, lines: split.body ? [split.body] : [] };
      continue;
    }

    if (!current) continue;
    current.lines.push(line);
  }

  if (current) sections.push(current);
  return sections;
}

function splitLegacyHeadingContent(value: string) {
  const aliases = Object.values(LEGACY_SECTION_ALIASES)
    .flat()
    .sort((a, b) => b.length - a.length);
  const normalizedValue = normalizeHeading(value);

  for (const alias of aliases) {
    const normalizedAlias = normalizeHeading(alias);
    if (normalizedValue === normalizedAlias) {
      return { title: alias, body: '' };
    }

    if (normalizedValue.startsWith(`${normalizedAlias} `)) {
      return {
        title: alias,
        body: cleanupSegment(value.slice(alias.length)),
      };
    }
  }

  return { title: value, body: '' };
}

function getLegacySectionKey(section: LegacySection): SectionKey | null {
  const afKey = LEGACY_AF_SECTION_MAP[section.key];
  if (afKey) return afKey;

  const normalizedTitle = normalizeHeading(section.title);

  for (const [key, aliases] of Object.entries(LEGACY_SECTION_ALIASES) as Array<[SectionKey, string[]]>) {
    if (
      aliases.some((alias) => {
        const normalizedAlias = normalizeHeading(alias);
        return normalizedTitle === normalizedAlias || normalizedTitle.startsWith(`${normalizedAlias} `);
      })
    ) {
      return key;
    }
  }

  return null;
}

function normalizeHeading(value: string) {
  return value
    .replace(/^#+\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function extractSectionText(lines: string[]) {
  const blocks = toBlocks(lines);
  const paragraphs = blocks
    .flatMap((block) => {
      if (block.kind === 'p') return [block.text];
      return block.items;
    })
    .map((item) => item.trim())
    .filter(Boolean);

  return paragraphs.join(' ').trim();
}

function extractSectionItems(lines: string[]) {
  const blocks = toBlocks(lines);
  const items = blocks
    .flatMap((block) => {
      if (block.kind === 'p') return block.text ? [block.text] : [];
      return block.items;
    })
    .map((item) => item.trim())
    .filter(Boolean);

  return items;
}

function parseTopLevers(lines: string[]): CoachTopLever[] {
  return extractSectionItems(lines)
    .map((item) => parseTopLever(item))
    .filter((item): item is CoachTopLever => Boolean(item));
}

function parseTopLever(item: string): CoachTopLever | null {
  const whyMatch = findLabelMatch(item, WHY_LABELS);
  const nextMatch = findLabelMatch(item, NEXT_LABELS, whyMatch ? whyMatch.end : 0);

  if (whyMatch && nextMatch) {
    const title = cleanupSegment(item.slice(0, whyMatch.index));
    const why = cleanupSegment(item.slice(whyMatch.end, nextMatch.index));
    const next = cleanupSegment(item.slice(nextMatch.end));

    if (title && why && next) {
      return { title, why, next };
    }
  }

  const parts = item.split(/\s+[–—-]\s+/).map((part) => cleanupSegment(part));
  if (parts.length >= 3 && parts[0] && parts[1] && parts[2]) {
    return {
      title: parts[0],
      why: parts[1],
      next: parts.slice(2).join(' - '),
    };
  }

  return null;
}

function parseToday(lines: string[]): CoachTodayPlan | null {
  const items = extractSectionItems(lines);
  const today: Partial<CoachTodayPlan> = {};

  for (const item of items) {
    for (const { key, re } of TIME_PREFIX_PATTERNS) {
      const match = item.match(re);
      if (match?.[1]) {
        today[key] = cleanupSegment(match[1]);
      }
    }
  }

  if (!today.ten || !today.twenty || !today.forty) {
    return null;
  }

  return {
    ten: today.ten,
    twenty: today.twenty,
    forty: today.forty,
  };
}

function findLabelMatch(text: string, labels: string[], fromIndex = 0) {
  let best: { index: number; end: number } | null = null;

  for (const label of labels) {
    const re = new RegExp(`${escapeRegex(label)}\\s*:`, 'i');
    const slice = text.slice(fromIndex);
    const match = slice.match(re);
    if (!match || match.index == null) continue;

    const index = fromIndex + match.index;
    const end = index + match[0].length;

    if (!best || index < best.index) {
      best = { index, end };
    }
  }

  return best;
}

function cleanupSegment(value: string) {
  return value
    .replace(/^[\s:：\-–—]+/, '')
    .replace(/[\s:：\-–—]+$/, '')
    .trim();
}

function toBlocks(lines: string[]): LegacyBlock[] {
  const blocks: LegacyBlock[] = [];
  let paragraphBuffer: string[] = [];
  let listKind: 'ul' | 'ol' | null = null;
  let listItems: string[] = [];

  const flushParagraph = () => {
    const text = paragraphBuffer.join(' ').trim();
    if (text) blocks.push({ kind: 'p', text });
    paragraphBuffer = [];
  };

  const flushList = () => {
    if (listKind && listItems.length) {
      blocks.push({ kind: listKind, items: listItems });
    }
    listKind = null;
    listItems = [];
  };

  for (const raw of lines) {
    const text = raw.trim();

    if (!text) {
      flushParagraph();
      flushList();
      continue;
    }

    const bullet = text.match(/^[-•]\s+(.*)$/);
    const ordered = text.match(/^\d+[\).\]]\s+(.*)$/);

    if (bullet) {
      flushParagraph();
      if (listKind && listKind !== 'ul') flushList();
      listKind = 'ul';
      listItems.push(bullet[1]);
      continue;
    }

    if (ordered) {
      flushParagraph();
      if (listKind && listKind !== 'ol') flushList();
      listKind = 'ol';
      listItems.push(ordered[1]);
      continue;
    }

    flushList();
    paragraphBuffer.push(text);
  }

  flushParagraph();
  flushList();

  return blocks;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderInline(text: string): React.ReactNode {
  const windowRe = new RegExp(`\\(\\s*(?:${WINDOW_LABEL_PATTERN})\\s*\\)`, 'gi');
  const metricRe =
    /\b\d{1,3}(?:[,\uFF0C]\s*\d{3})+(?:\.\d+)?%?\b|\b\d+(?:\.\d+)?%?\b|\b\d+\s*[–-]\s*\d+\b|\b\d+-day\b/gi;
  const tokenRe = new RegExp(`${windowRe.source}|${metricRe.source}`, 'gi');

  const nodes: React.ReactNode[] = [];
  let last = 0;

  for (const match of text.matchAll(tokenRe)) {
    const start = match.index ?? 0;
    const value = match[0];

    if (start > last) {
      nodes.push(text.slice(last, start));
    }

    if (value.match(windowRe)) {
      const inner = value.replace(/[()]/g, '').trim();
      nodes.push(
        <span key={`${start}-window`} className={styles.coachChip}>
          {inner}
        </span>
      );
      last = start + value.length;
      continue;
    }

    if (value.match(metricRe)) {
      nodes.push(
        <strong key={`${start}-metric`} className={styles.coachMetric}>
          {value}
        </strong>
      );
      last = start + value.length;
      continue;
    }

    nodes.push(value);
    last = start + value.length;
  }

  if (last < text.length) {
    nodes.push(text.slice(last));
  }

  return <>{nodes}</>;
}
