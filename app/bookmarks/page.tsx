import type { DatasetId } from '../../lib/qbank/datasets';
import AllQuestionsClient from '../all-questions/AllQuestionsClient.client';
import BackButton from '../../components/BackButton';

export default function BookmarksPage() {
  // IMPORTANT: use the same datasetId you use for /all-questions
  const datasetId: DatasetId = '2023-test1' as DatasetId;

  return (
    <>
      <BackButton />
      <AllQuestionsClient datasetId={"cn-2023-test1" as DatasetId} mode="bookmarks" />
    </>
  );
}
