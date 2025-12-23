import { DATASETS, type DatasetId } from './datasets';
import type { Question, RawQBank, RawQuestion } from './types';
import { suggestTags } from './suggestTags';

function normalizeOne(raw: RawQuestion): Question {
  const type = raw.type === 'mcq' ? 'MCQ' : 'ROW';

  const options = raw.options.map((o) => ({
    id: o.key,
    text: o.text,
  }));

  const correctOptionId =
    raw.type === 'mcq'
      ? raw.answer.trim() // "A".."D"
      : raw.answer.trim().toLowerCase().startsWith('r')
        ? 'R'
        : 'W';

  const assets = (raw.assets ?? [])
    .filter((a) => !!a?.path)
    .map((a) => ({
      kind: 'image' as const,
      src: a.path,
      width: a.width,
      height: a.height,
    }));

  const q: Question = {
    id: raw.id,
    number: raw.number,
    type,
    prompt: raw.prompt,
    options,
    correctOptionId,
    assets,
    tags: raw.tags ?? [],
    autoTags: [],
  };

  q.autoTags = suggestTags(q);
  return q;
}

export async function loadDataset(datasetId: DatasetId): Promise<Question[]> {
  const ds = DATASETS[datasetId];
  if (!ds) throw new Error(`Unknown datasetId: ${datasetId}`);

  const res = await fetch(ds.url);
  if (!res.ok) throw new Error(`Failed to load dataset: ${datasetId}`);

  const raw = (await res.json()) as RawQBank;

  const rawQuestions = Array.isArray(raw) ? raw : raw.questions;
  return rawQuestions.map(normalizeOne).sort((a, b) => a.number - b.number);
}
