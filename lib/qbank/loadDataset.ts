// lib/qbank/loadDataset.ts
import { DATASETS, type DatasetId } from './datasets';
import type { Question, RawQBank, RawQuestion, CorrectRow } from './types';
import { suggestTags } from './suggestTags';

function toArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
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

  const q: Question = {
    id: String(raw.id),
    number: Number(raw.number),
    type,
    prompt: String(raw.prompt ?? ''),
    options,
    correctRow,
    correctOptionId,
    assets,
    tags: toArray<string>((raw as any).tags), // ✅ always array
    autoTags: [],
  };

  q.autoTags = suggestTags(q);
  return q;
}

export async function loadDataset(datasetId: DatasetId): Promise<Question[]> {
  const ds = DATASETS[datasetId];
  const res = await fetch(ds.url, { cache: 'force-cache' });
  if (!res.ok) throw new Error(`Failed to load dataset: ${datasetId}`);

  const json = (await res.json()) as RawQBank;
  const list = Array.isArray(json) ? json : toArray<RawQuestion>((json as any).questions);

  return list.map(normalizeOne).sort((a, b) => a.number - b.number);
}
