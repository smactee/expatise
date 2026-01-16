// app/bookmarks/page.tsx

import type { DatasetId } from "@/lib/qbank/datasets";
import AllQuestionsClient from "@/app/(premium)/all-questions/AllQuestionsClient.client";

export default function BookmarksPage() {
  const datasetId = "cn-2023-test1" as DatasetId;
  return <AllQuestionsClient datasetId={datasetId} mode="bookmarks" />;
}
