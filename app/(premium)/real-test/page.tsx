// app/real-test/page.tsx
import type { DatasetId } from '@/lib/qbank/datasets';
import RealTestClient from './RealTestClient.client';

export default function RealTestPage() {
  const datasetId: DatasetId = 'cn-2023-test1' as DatasetId;

  // Change this only when your dataset content changes (e.g., yearly update).
  const datasetVersion = 'cn-2023-test1@v1';

  // Real Test fixed size
  const questionCount = 50;

  return (
    <RealTestClient
      datasetId={datasetId}
      datasetVersion={datasetVersion}
      questionCount={questionCount}
      timeLimitMinutes={45}
    />
  );
}
