import { DATASETS, type DatasetId } from "./datasets";

export type QuestionImageColorEntry = {
  assetSrcs?: string[];
  colorTags?: string[];
  objectTags?: string[];
  dominantByAsset?: Array<{
    assetSrc: string;
    colors: Array<{
      color: string;
      overallShare: number;
      chromaticShare?: number | null;
    }>;
  }>;
};

export type QuestionImageColorTagFile = {
  meta?: Record<string, unknown>;
  questions?: Record<string, QuestionImageColorEntry>;
};

function isQuestionImageColorTagFile(value: unknown): value is QuestionImageColorTagFile {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    ("questions" in value || "meta" in value),
  );
}

function isQuestionImageColorEntryMap(value: unknown): value is Record<string, QuestionImageColorEntry> {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !("questions" in value),
  );
}

function imageColorTagsUrl(datasetId: DatasetId) {
  const dataset = DATASETS[datasetId];
  return dataset.url.replace(/\/questions\.json$/, "/image-color-tags.json");
}

export async function loadImageColorTags(datasetId: DatasetId): Promise<Record<string, QuestionImageColorEntry>> {
  const url = imageColorTagsUrl(datasetId);
  const isDev = process.env.NODE_ENV === "development";

  try {
    const res = await fetch(isDev ? `${url}?v=${Date.now()}` : url, {
      cache: isDev ? "no-store" : "force-cache",
    });

    if (!res.ok) {
      return {};
    }

    const json = (await res.json()) as unknown;
    if (isQuestionImageColorTagFile(json)) {
      return json.questions && typeof json.questions === "object" && !Array.isArray(json.questions)
        ? json.questions
        : {};
    }

    return isQuestionImageColorEntryMap(json) ? json : {};
  } catch {
    return {};
  }
}
