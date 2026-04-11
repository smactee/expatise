import { DATASETS, type DatasetId } from "./datasets";

export type QuestionImageColorEntry = {
  assetSrcs?: string[];
  colorTags?: string[];
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

    const json = (await res.json()) as QuestionImageColorTagFile | Record<string, QuestionImageColorEntry>;
    if (json && typeof json === "object" && "questions" in json && json.questions && typeof json.questions === "object") {
      return json.questions;
    }

    return json && typeof json === "object" ? (json as Record<string, QuestionImageColorEntry>) : {};
  } catch {
    return {};
  }
}
