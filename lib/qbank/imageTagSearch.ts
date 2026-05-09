import { DATASETS, type DatasetId } from "./datasets";
import type { QuestionImageColorEntry } from "./loadImageColorTags";

export type ImageTagLocaleAliases = Record<string, string[]>;
export type ImageTagLocaleFile = Partial<Record<string, ImageTagLocaleAliases>>;

function imageTagLocalesUrl(datasetId: DatasetId) {
  const dataset = DATASETS[datasetId];
  return dataset.url.replace(/\/questions\.json$/, "/image-tag-locales.json");
}

export async function loadImageTagLocales(datasetId: DatasetId): Promise<ImageTagLocaleFile> {
  const url = imageTagLocalesUrl(datasetId);
  const isDev = process.env.NODE_ENV === "development";

  try {
    const res = await fetch(isDev ? `${url}?v=${Date.now()}` : url, {
      cache: isDev ? "no-store" : "force-cache",
    });

    if (!res.ok) return {};

    const json = (await res.json()) as unknown;
    return isImageTagLocaleFile(json) ? json : {};
  } catch {
    return {};
  }
}

export function getImageTagSearchTerms(
  colorEntry: QuestionImageColorEntry | undefined,
  locale: string | null | undefined,
  locales: ImageTagLocaleFile | undefined,
): string[] {
  if (!colorEntry) return [];

  const localeAliases = locales?.[normalizeLocaleKey(locale)] ?? {};
  const terms: string[] = [];

  for (const tag of collectCanonicalImageTags(colorEntry)) {
    terms.push(tag, tag.replace(/[-_]+/g, " "));
    terms.push(...(localeAliases[tag] ?? []));
  }

  return uniqueSearchTerms(terms);
}

function collectCanonicalImageTags(entry: QuestionImageColorEntry): string[] {
  const tags: string[] = [];

  for (const [key, value] of Object.entries(entry)) {
    if (!isTagArrayKey(key) || !Array.isArray(value)) continue;
    for (const item of value) {
      if (typeof item === "string") tags.push(item);
    }
  }

  return uniqueSearchTerms(tags);
}

function isTagArrayKey(key: string): boolean {
  return key === "colorTags" || key === "objectTags" || /tags$/i.test(key);
}

function normalizeLocaleKey(locale: string | null | undefined): string {
  return String(locale ?? "")
    .trim()
    .toLowerCase()
    .split("-")[0];
}

function uniqueSearchTerms(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const value of values) {
    const term = String(value ?? "").trim();
    const key = term.toLocaleLowerCase();
    if (!term || seen.has(key)) continue;
    seen.add(key);
    out.push(term);
  }

  return out;
}

function isImageTagLocaleFile(value: unknown): value is ImageTagLocaleFile {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  return Object.values(value).every((languageAliases) => {
    if (!languageAliases || typeof languageAliases !== "object" || Array.isArray(languageAliases)) {
      return false;
    }

    return Object.values(languageAliases).every((aliases) =>
      Array.isArray(aliases) && aliases.every((alias) => typeof alias === "string")
    );
  });
}
