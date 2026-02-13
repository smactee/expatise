// app/(premium)/layout.tsx
import RequirePremium from "@/components/RequirePremium.client";
import FreeUsageProgressBadge from "@/components/FreeUsageProgressBadge.client";
import { Suspense } from "react";

export default function PremiumLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <FreeUsageProgressBadge />
      <Suspense fallback={null}>
        <RequirePremium>{children}</RequirePremium>
      </Suspense>
    </>
  );
}

