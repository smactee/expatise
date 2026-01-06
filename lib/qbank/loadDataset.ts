// lib/qbank/loadDataset.ts
import { DATASETS, type DatasetId } from './datasets';
import type { Question, RawQBank, RawQuestion, CorrectRow } from './types';
import { suggestTags } from './suggestTags';

function toArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function normalizeTag(s: unknown) {
  return String(s ?? '').trim().replace(/^#/, '').toLowerCase();
}


function extractTagArrays(rawTags: any) {
  const user = new Set<string>();
  const auto = new Set<string>();

  // Case 1: old format -> tags: ["#law", ...]
  if (Array.isArray(rawTags)) {
    rawTags.forEach((t) => {
      const nt = normalizeTag(t);
      if (nt) user.add(nt);
    });
    return { userTags: [...user], autoTags: [...auto] };
  }

  // Case 2: new format -> tags: { auto:[], user:[], suggested:[{tag, score}] }
  if (rawTags && typeof rawTags === 'object') {
    toArray<string>(rawTags.user).forEach((t) => {
      const nt = normalizeTag(t);
      if (nt) user.add(nt);
    });

    toArray<string>(rawTags.auto).forEach((t) => {
      const nt = normalizeTag(t);
      if (nt) auto.add(nt);
    });

    toArray<any>(rawTags.suggested).forEach((s) => {
      const nt = normalizeTag(s?.tag);
      if (nt) auto.add(nt);
    });
  }

  return { userTags: [...user], autoTags: [...auto] };
}

type TagPatch = Record<string, string[]>;

async function loadPatch(url?: string): Promise<TagPatch> {
  if (!url) return {};
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      console.warn('[qbank] Patch not loaded:', url, res.status);
      return {};
    }
    const json = (await res.json()) as unknown;
    if (!json || typeof json !== 'object') return {};
    return json as TagPatch;
  } catch (e) {
    console.warn('[qbank] Patch fetch failed:', url, e);
    return {};
  }
}

function applyPatchTags(q: Question, patchTags: string[] | undefined): Question {
  if (!patchTags || patchTags.length === 0) return q;

  const clean = patchTags
    .map((t) => String(t ?? '').trim().replace(/^#/, ''))
    .filter(Boolean);

  if (clean.length === 0) return q;

  // Treat patch tags as "manual/user tags"
  const merged = Array.from(new Set([...(q.tags ?? []), ...clean]));

  return { ...q, tags: merged };
}



function normalizeCorrectRow(v: unknown): CorrectRow | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const low = s.toLowerCase();
  if (low === 'right' || low === 'r') return low === 'r' ? 'R' : 'Right';
  if (low === 'wrong' || low === 'w') return low === 'w' ? 'W' : 'Wrong';
  return null;
}

function normalizeType(rawType: unknown): Question['type'] {
  const t = String(rawType ?? '').trim().toLowerCase();
  return t === 'mcq' ? 'MCQ' : 'ROW';
}

function normalizeOne(raw: RawQuestion): Question {
  const type = normalizeType(raw.type);

  const options = toArray<any>(raw.options)
    .map((o) => ({
      id: String(o?.id ?? o?.key ?? ''),
      originalKey: o?.originalKey ? String(o.originalKey) : (o?.key ? String(o.key) : undefined),
      text: String(o?.text ?? ''),
    }))
    .filter((o) => o.id && o.text);

  const assets = toArray<any>(raw.assets)
    .filter((a) => a?.src || a?.path)
    .map((a) => {
      const src = String(a.src ?? a.path);
      return {
        kind: 'image' as const,
        src: src.startsWith('/') ? src : `/${src}`,
        width: a.width,
        height: a.height,
      };
    });

  // answers can appear as correctRow / correctOptionId OR fallback to answer
  const correctRow = type === 'ROW'
    ? normalizeCorrectRow((raw as any).correctRow ?? (raw as any).answer)
    : null;

  const correctOptionId =
    type === 'MCQ'
      ? String(((raw as any).correctOptionId ?? (raw as any).answer ?? '') || '').trim() || null
      : null;

    const { userTags, autoTags: rawAutoTags } = extractTagArrays((raw as any).tags);

const explanation =
  typeof (raw as any).explanation === 'string'
    ? (raw as any).explanation.trim()
    : undefined;


  const q: Question = {
    id: String(raw.id),
    number: Number(raw.number),
    type,
    prompt: String(raw.prompt ?? ''),
    options,
    correctRow,
    correctOptionId,
    assets,
    explanation,
    tags: userTags, // manual/user tags (if any)
    autoTags: [],     // fill below
  };

  // merge parser auto tags + suggested tags + your runtime keyword tags
  q.autoTags = Array.from(new Set([...suggestTags(q), ...rawAutoTags]));
  return q;
}

export async function loadDataset(datasetId: DatasetId): Promise<Question[]> {
  const ds = DATASETS[datasetId];

const isDev = process.env.NODE_ENV === 'development';
const url = isDev ? `${ds.url}?v=${Date.now()}` : ds.url;

const [res, patch] = await Promise.all([
  fetch(url, { cache: isDev ? 'no-store' : 'force-cache' }),
  loadPatch(ds.patchUrl),
]);


  if (!res.ok) throw new Error(`Failed to load dataset: ${datasetId}`);

  const json = (await res.json()) as RawQBank;
  const list = Array.isArray(json) ? json : toArray<RawQuestion>((json as any).questions);

  return list
    .map(normalizeOne)
    .map((q) => applyPatchTags(q, patch[q.id]))
    .sort((a, b) => a.number - b.number);
}
