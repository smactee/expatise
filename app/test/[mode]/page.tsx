// app/test/[mode]/page.tsx

import { notFound } from "next/navigation";
import AllTestClient from "@/app/(premium)/all-test/AllTestClient.client";
import { TEST_MODES, type TestModeId } from "@/lib/testModes";

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
