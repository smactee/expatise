//components/RequirePremium.client.tsx

"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PUBLIC_FLAGS } from "@/lib/flags/public";
import { useEntitlements } from "@/components/EntitlementsProvider.client";
import { safeNextPath } from "@/lib/navigation/safeNextPath";

function currentPath(pathname: string, qs: string) {
  return qs ? `${pathname}?${qs}` : pathname;
}

export default function RequirePremium({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const qs = sp.toString(); // <- string is stable for deps
  const { isPremium } = useEntitlements();

  useEffect(() => {
    if (!PUBLIC_FLAGS.enablePremiumGates) return;
    if (isPremium) return;

    const nextPath = safeNextPath(currentPath(pathname, qs));
    const next = encodeURIComponent(nextPath);
    router.replace(`/premium?next=${next}`);
  }, [isPremium, pathname, qs, router]);

  if (!PUBLIC_FLAGS.enablePremiumGates) return <>{children}</>;
  if (isPremium) return <>{children}</>;

  // while redirecting
  return null;
}
