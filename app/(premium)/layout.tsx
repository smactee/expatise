import RequirePremium from "@/components/RequirePremium.client";

export default function PremiumLayout({ children }: { children: React.ReactNode }) {
  return <RequirePremium>{children}</RequirePremium>;
}
