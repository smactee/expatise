// app/test/[mode]/page.tsx

import { notFound } from "next/navigation";
import AllTestClient from "@/app/(premium)/all-test/AllTestClient.client";
import { TEST_MODES, type TestModeId } from "@/lib/testModes";

export const dynamicParams = false;

export function generateStaticParams() {
  // Build-time list of all allowed /test/[mode] pages
  return (Object.keys(TEST_MODES) as TestModeId[]).map((mode) => ({ mode }));
}

export default async function TestModePage({
  params,
}: {
  params: Promise<{ mode: string }>;
}) {
  const { mode } = await params;

  const cfg = TEST_MODES[mode as TestModeId];
  if (!cfg) notFound();

  return <AllTestClient {...cfg} />;
}
