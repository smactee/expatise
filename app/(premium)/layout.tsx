// app/(premium)/layout.tsx
import RequirePremium from "@/components/RequirePremium.client";
import { Suspense } from "react";
import DemoSeedGate from "@/components/DemoSeedGate.client";

export default function PremiumLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <DemoSeedGate>
          <RequirePremium>{children}</RequirePremium>
        </DemoSeedGate>
      </Suspense>
    </>
  );
}
