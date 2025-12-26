

export type DatasetId = 'cn-2023-test1';

export type DatasetConfig = {
  id: DatasetId;
  label: string;
  url: string;
  patchUrl?: string; // ✅ optional
};

export const DATASETS: Record<DatasetId, DatasetConfig> = {
  'cn-2023-test1': {
    id: 'cn-2023-test1',
    label: 'China · 2023 · Test 1',
    url: '/qbank/2023-test1/questions.json',
    patchUrl: '/qbank/2023-test1/tags.patch.json', // ✅ new
  },
} as const;
