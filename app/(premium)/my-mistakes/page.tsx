// app/my-mistakes/page.tsx

import type { DatasetId } from '@/lib/qbank/datasets';
import AllQuestionsClient from "@/app/(premium)/all-questions/AllQuestionsClient.client";

export default function MyMistakesPage() {
  return (
    <>
      <AllQuestionsClient datasetId={"cn-2023-test1" as DatasetId} mode="mistakes" />
    </>
  );
}
