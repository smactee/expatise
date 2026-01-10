// app/my-mistakes/page.tsx

import type { DatasetId } from '../../lib/qbank/datasets';
import AllQuestionsClient from '../all-questions/AllQuestionsClient.client';
import BackButton from '../../components/BackButton';

export default function MyMistakesPage() {
  return (
    <>
      <BackButton />
      <AllQuestionsClient datasetId={"cn-2023-test1" as DatasetId} mode="mistakes" />
    </>
  );
}
