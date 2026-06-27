// Apply confirmed classifications from the unclassified-review workbench into
// tags.patch.json (the runtime manual-tag patch the app reads via loadDataset).
//
//   npx tsx scripts/apply-unclassified-classification.ts
//
// - Input:  qbank-tools/staging/unclassified-confirmed.json  (workbench export)
// - Target: public/qbank/2023-test1/tags.patch.json          (backed up first)
// - Replaces any stale topic/subtopic tags on a qid (so the 3 license questions
//   tagged with the invalid "proper-driving:license" get cleaned), preserves
//   non-classification tags (e.g. "no-image"), then verifies by re-deriving.
import * as fs from 'fs';
import { deriveTopicSubtags } from '../lib/qbank/deriveTopicSubtags';

const PATCH = 'public/qbank/2023-test1/tags.patch.json';
const QJSON = 'public/qbank/2023-test1/questions.json';
const EXPORT = 'qbank-tools/staging/unclassified-confirmed.json';

type Row = { id: string; topic: string; subtopic: string };
const exp: Row[] = JSON.parse(fs.readFileSync(EXPORT, 'utf8'));
const patch: Record<string, string[]> = JSON.parse(fs.readFileSync(PATCH, 'utf8'));

const TOPICS = ['road-safety', 'traffic-signals', 'proper-driving', 'driving-operations'];
const isClassificationTag = (t: string) =>
  TOPICS.includes(t) || TOPICS.some((top) => t.startsWith(top + ':'));

// 1) backup
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = `${PATCH}.bak-${stamp}`;
fs.copyFileSync(PATCH, backup);

// 2) apply
const diffs: Array<{ id: string; before: string[] | null; after: string[] }> = [];
for (const row of exp) {
  const existing = patch[row.id] ? [...patch[row.id]] : null;
  const kept = (existing ?? []).filter((t) => !isClassificationTag(t)); // drop old topic/subtopic (handles replace)
  const next = Array.from(new Set([row.topic, row.subtopic, ...kept]));
  if (!next.includes('no-image') && !next.includes('image')) next.push('no-image');
  patch[row.id] = next;
  diffs.push({ id: row.id, before: existing, after: next });
}
fs.writeFileSync(PATCH, JSON.stringify(patch, null, 2) + '\n');

// 3) verify — re-derive ALL questions with the new patch (mirrors loadDataset + AllQuestionsClient)
const normTag = (s: any) => String(s ?? '').trim().replace(/^#/, '').toLowerCase();
function extractTags(rawTags: any) {
  const u = new Set<string>(), a = new Set<string>();
  if (Array.isArray(rawTags)) rawTags.forEach((t: any) => { const n = normTag(t); if (n) u.add(n); });
  else if (rawTags && typeof rawTags === 'object') {
    (rawTags.user || []).forEach((t: any) => { const n = normTag(t); if (n) u.add(n); });
    (rawTags.auto || []).forEach((t: any) => { const n = normTag(t); if (n) a.add(n); });
    (rawTags.suggested || []).forEach((s: any) => { const n = normTag(s?.tag); if (n) a.add(n); });
  }
  return { userTags: [...u], autoTags: [...a] };
}
const isConcrete = (tag: string, type: 'topic' | 'subtopic') => {
  const n = String(tag ?? '').trim().toLowerCase();
  if (!n || n === 'unclassified' || n === 'uncategorized' || n === 'unknown') return false;
  return type === 'topic' ? !n.includes(':') : (n.includes(':') && !n.endsWith(':all'));
};
const isUnclassified = (tags: string[]) =>
  !(tags.some((t) => isConcrete(t, 'topic')) && tags.some((t) => isConcrete(t, 'subtopic')));

const Q = JSON.parse(fs.readFileSync(QJSON, 'utf8'));
const arr: any[] = Array.isArray(Q) ? Q : Q.questions;
const expIds = new Set(exp.map((r) => r.id));
const stillUnclassified: string[] = [];
let ourNowClassified = 0;
for (const q of arr) {
  const { userTags, autoTags } = extractTags(q.tags);
  const patchTags = (patch[q.id] || []).map(normTag).filter(Boolean);
  const tags = [...new Set([...userTags, ...patchTags])];
  const derived = deriveTopicSubtags({
    prompt: q.prompt, sourcePrompt: q.sourcePrompt ?? q.prompt,
    options: q.options || [], sourceOptions: q.options || [], tags, autoTags,
  } as any);
  if (isUnclassified(derived)) stillUnclassified.push(q.id);
  else if (expIds.has(q.id)) ourNowClassified++;
}

console.log(JSON.stringify({
  applied: exp.length,
  ourNowClassified,
  totalStillUnclassified: stillUnclassified.length,
  stillUnclassifiedIds: stillUnclassified,
  backup,
}, null, 2));
console.log('\n--- per-question diff ---');
for (const d of diffs) console.log(`${d.id}: ${JSON.stringify(d.before)} -> ${JSON.stringify(d.after)}`);
