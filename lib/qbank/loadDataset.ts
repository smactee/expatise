// lib/qbank/loadDataset.ts
import { DATASETS, type DatasetId } from './datasets';
import { DEFAULT_LOCALE, type Locale } from '@/messages';
import { isTranslatedOnlyQuestionLocale } from './localeSupport';
import type {
  Question,
  RawQBank,
  RawQuestion,
  CorrectRow,
  QuestionOption,
  QuestionTranslationEntry,
  QuestionTranslationFile,
} from './types';
import { suggestTags } from './suggestTags';

type LooseObject = Record<string, unknown>;
type RawOptionLike = {
  id?: unknown;
  key?: unknown;
  originalKey?: unknown;
  text?: unknown;
};
type RawAssetLike = {
  src?: unknown;
  path?: unknown;
  width?: unknown;
  height?: unknown;
};

function toArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function normalizeTag(s: unknown) {
  return String(s ?? '').trim().replace(/^#/, '').toLowerCase();
}


function extractTagArrays(rawTags: unknown) {
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
    const tagRecord = rawTags as LooseObject;

    toArray<string>(tagRecord.user).forEach((t) => {
      const nt = normalizeTag(t);
      if (nt) user.add(nt);
    });

    toArray<string>(tagRecord.auto).forEach((t) => {
      const nt = normalizeTag(t);
      if (nt) auto.add(nt);
    });

    toArray<LooseObject>(tagRecord.suggested).forEach((suggested) => {
      const nt = normalizeTag(suggested.tag);
      if (nt) auto.add(nt);
    });
  }

  return { userTags: [...user], autoTags: [...auto] };
}

type TagPatch = Record<string, string[]>;
type TranslationPatch = Record<string, QuestionTranslationEntry>;

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

async function loadTranslations(url?: string): Promise<TranslationPatch> {
  if (!url) return {};
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      console.warn('[qbank] Translation patch not loaded:', url, res.status);
      return {};
    }
    const json = (await res.json()) as unknown;
    if (!json || typeof json !== 'object') return {};

    const patchLike = json as Partial<QuestionTranslationFile> & Record<string, QuestionTranslationEntry>;
    if (patchLike.questions && typeof patchLike.questions === 'object') {
      return patchLike.questions as TranslationPatch;
    }

    return patchLike as TranslationPatch;
  } catch (e) {
    console.warn('[qbank] Translation patch fetch failed:', url, e);
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

function normalizeOptionKey(value: unknown): string | null {
  const raw = String(value ?? '').trim().toUpperCase();
  if (!raw) return null;
  return /^[A-Z]$/.test(raw) ? raw : null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripOptionKeyPrefix(text: unknown, sourceKey?: string | null): string {
  const raw = String(text ?? '').trim();
  if (!raw) return '';
  const keyPattern = sourceKey ? escapeRegExp(sourceKey) : '[A-Z]';
  const stripped = raw.replace(
    new RegExp(`^${keyPattern}(?:[\\s\\.:：\\)\\]\\-])?\\s*`, 'i'),
    ''
  ).trim();
  return stripped || raw;
}

function buildTranslatedOptions(q: Question, translation: QuestionTranslationEntry): QuestionOption[] {
  const translated = q.options.map((opt) => ({
    ...opt,
    text: translation.options?.[opt.id] ?? opt.text,
  }));

  const localeOptionOrder = Array.isArray(translation.localeOptionOrder)
    ? translation.localeOptionOrder
    : [];

  if (q.type !== 'MCQ' || localeOptionOrder.length === 0) {
    return translated;
  }

  const translatedById = new Map(translated.map((opt) => [opt.id, opt]));
  const usedIds = new Set<string>();
  const ordered: QuestionOption[] = [];

  for (const localeOption of localeOptionOrder) {
    const canonicalOptionId = String(localeOption?.canonicalOptionId ?? '').trim();
    if (!canonicalOptionId || usedIds.has(canonicalOptionId)) {
      continue;
    }

    const baseOption = translatedById.get(canonicalOptionId);
    if (!baseOption) {
      continue;
    }

    const localizedKey = normalizeOptionKey(localeOption?.sourceKey) ?? baseOption.originalKey ?? undefined;
    const localizedText = stripOptionKeyPrefix(
      localeOption?.sourceTextBody ?? localeOption?.sourceText ?? baseOption.text,
      localizedKey
    ) || baseOption.text;

    ordered.push({
      ...baseOption,
      originalKey: localizedKey,
      text: localizedText,
    });
    usedIds.add(canonicalOptionId);
  }

  for (const opt of translated) {
    if (!usedIds.has(opt.id)) {
      ordered.push(opt);
    }
  }

  return ordered.length > 0 ? ordered : translated;
}

function normalizeOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function normalizeOne(raw: RawQuestion): Question {
  const type = normalizeType(raw.type);

  const sourceOptions = toArray<RawOptionLike>(raw.options)
    .map((o) => ({
      id: String(o?.id ?? o?.key ?? ''),
      originalKey: o?.originalKey ? String(o.originalKey) : (o?.key ? String(o.key) : undefined),
      text: String(o?.text ?? ''),
    }))
    .filter((o) => o.id && o.text);

  const assets = toArray<RawAssetLike>(raw.assets)
    .filter((a) => a?.src || a?.path)
    .map((a) => {
      const src = String(a.src ?? a.path);
      return {
        kind: 'image' as const,
        src: src.startsWith('/') ? src : `/${src}`,
        width: normalizeOptionalNumber(a.width),
        height: normalizeOptionalNumber(a.height),
      };
    });

  // answers can appear as correctRow / correctOptionId OR fallback to answer
  const correctRow = type === 'ROW'
    ? normalizeCorrectRow(raw.correctRow ?? raw.answer)
    : null;

  const correctOptionId =
    type === 'MCQ'
      ? String((raw.correctOptionId ?? raw.answer ?? '') || '').trim() || null
      : null;

  const { userTags, autoTags: rawAutoTags } = extractTagArrays(raw.tags);

  const explanation =
    typeof raw.explanation === 'string'
      ? raw.explanation.trim()
    : undefined;

  const sourcePrompt = String(raw.prompt ?? '');


  const q: Question = {
    id: String(raw.id),
    number: Number(raw.number),
    type,
    prompt: sourcePrompt,
    sourcePrompt,
    options: sourceOptions,
    sourceOptions,
    correctRow,
    correctOptionId,
    assets,
    explanation,
    sourceExplanation: explanation,
    tags: userTags, // manual/user tags (if any)
    autoTags: [],     // fill below
  };

  // merge parser auto tags + suggested tags + your runtime keyword tags
  q.autoTags = Array.from(new Set([...suggestTags(q), ...rawAutoTags]));
  return q;
}

function normalizeExplanation(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function applyTranslation(
  q: Question,
  translation: QuestionTranslationEntry | undefined,
  locale: Locale | string
): Question {
  const isSourceLocale = locale === DEFAULT_LOCALE;

  if (!translation) {
    return isSourceLocale
      ? q
      : {
          ...q,
          explanation: undefined,
        };
  }

  const translatedOptions = buildTranslatedOptions(q, translation);
  const translatedExplanation = normalizeExplanation(translation.explanation);

  return {
    ...q,
    prompt: translation.prompt ?? q.prompt,
    options: translatedOptions,
    explanation: isSourceLocale ? q.sourceExplanation : translatedExplanation,
  };
}

export async function loadDataset(
  datasetId: DatasetId,
  options: { locale?: Locale | string; translatedOnly?: boolean } = {}
): Promise<Question[]> {
  const ds = DATASETS[datasetId];
  const locale = options.locale ?? DEFAULT_LOCALE;
  const translatedOnly = options.translatedOnly === true;

const isDev = process.env.NODE_ENV === 'development';
const url = isDev ? `${ds.url}?v=${Date.now()}` : ds.url;

const translationUrl =
  locale !== DEFAULT_LOCALE
    ? ds.translationUrls?.[locale]
    : undefined;

const [res, patch, translations] = await Promise.all([
  fetch(url, { cache: 'no-store' }),
  loadPatch(ds.patchUrl),
  loadTranslations(translationUrl),
]);


  if (!res.ok) throw new Error(`Failed to load dataset: ${datasetId}`);

  const json = (await res.json()) as RawQBank;
  const list = Array.isArray(json)
    ? json
    : toArray<RawQuestion>((json as { questions?: unknown }).questions);
  const translationIds = new Set(Object.keys(translations));
  const shouldRestrictToTranslated =
    translatedOnly &&
    locale !== DEFAULT_LOCALE &&
    isTranslatedOnlyQuestionLocale(locale);

  return list
    .map(normalizeOne)
    .map((q) => applyPatchTags(q, patch[q.id]))
    .map((q) => applyTranslation(q, translations[q.id], locale))
    .filter((q) => !shouldRestrictToTranslated || translationIds.has(q.id))
    .sort((a, b) => a.number - b.number);
}
