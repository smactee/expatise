export type DatasetId = 'cn-2023-test1';

export const DATASETS: Record<
  DatasetId,
  { id: DatasetId; label: string; url: string }
> = {
  'cn-2023-test1': {
    id: 'cn-2023-test1',
    label: 'China · 2023 · Test 1',
    url: '/qbank/2023-test1/questions.json',
  },
};
