// app/test/[mode]/results/page.tsx
import ResultsClient from "./ResultsClient.client";
import { TEST_MODES, type TestModeId } from "@/lib/testModes";

export const dynamicParams = false;

export function generateStaticParams() {
  return (Object.keys(TEST_MODES) as TestModeId[]).map((mode) => ({ mode }));
}

export default function Page() {
  return <ResultsClient />;
}