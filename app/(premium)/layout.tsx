// app/(premium)/layout.tsx
import RequirePremium from "@/components/RequirePremium.client";
import FreeUsageProgressBadge from "@/components/FreeUsageProgressBadge.client";

export default function PremiumLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <FreeUsageProgressBadge />
      <RequirePremium>{children}</RequirePremium>
    </>
  );
}
