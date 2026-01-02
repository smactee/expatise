import type { DatasetId } from '../../lib/qbank/datasets';
import RealTestClient from './RealTestClient.client';

export default function RealTestPage() {
  const datasetId: DatasetId = 'cn-2023-test1' as DatasetId;

  return <RealTestClient datasetId={datasetId} timeLimitMinutes={45} />;
}
