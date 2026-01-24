import type { DatasetId } from "@/lib/qbank/datasets";
import GlobalCommonMistakesClient from "./GlobalCommonMistakesClient.client";

export default function GlobalCommonMistakesPage() {
  // Match what you do on All Questions / Bookmarks / My Mistakes
  const datasetId = "cn-2023-test1" as DatasetId;

  return <GlobalCommonMistakesClient datasetId={datasetId} />;
}
