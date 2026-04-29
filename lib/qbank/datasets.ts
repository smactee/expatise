
export type DatasetId = 'cn-2023-test1';

export type DatasetConfig = {
  id: DatasetId;
  label: string;
  url: string;
  patchUrl?: string; // ✅ optional
  translationUrls?: Partial<Record<string, string>>;
};

export const DATASETS: Record<DatasetId, DatasetConfig> = {
  'cn-2023-test1': {
    id: 'cn-2023-test1',
    label: 'China · 2023 · Test 1',
    url: '/qbank/2023-test1/questions.json',
    patchUrl: '/qbank/2023-test1/tags.patch.json', // ✅ new
    translationUrls: {
      ja: '/qbank/2023-test1/translations.ja.json',
      ko: '/qbank/2023-test1/translations.ko.json',
      ru: '/qbank/2023-test1/translations.ru.json',
    },
  },
} as const;

export const DEFAULT_DATASET_ID: DatasetId = 'cn-2023-test1';
