// app/test/[mode]/page.tsx
import RealTestClient from "@/app/(premium)/real-test/RealTestClient.client";
import { TEST_MODES, type TestModeId } from "@/lib/testModes";

export default function TestModePage({ params }: { params: { mode: string } }) {
  const mode = params.mode as TestModeId;
  const cfg = TEST_MODES[mode] ?? TEST_MODES.real;

  return <RealTestClient {...cfg} routeBase={`/test/${params.mode}`} />;
}
