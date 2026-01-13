"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PUBLIC_FLAGS } from "@/lib/flags/public";
import { useEntitlements } from "@/components/EntitlementsProvider.client";

function currentPath(pathname: string, sp: URLSearchParams) {
  const qs = sp.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export default function RequirePremium({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const { isPremium } = useEntitlements();

  useEffect(() => {
    if (!PUBLIC_FLAGS.enablePremiumGates) return;
    if (isPremium) return;

    const next = encodeURIComponent(currentPath(pathname, sp));
    router.replace(`/premium?next=${next}`);
  }, [isPremium, pathname, sp, router]);

  if (!PUBLIC_FLAGS.enablePremiumGates) return <>{children}</>;
  if (isPremium) return <>{children}</>;

  // while redirecting
  return null;
}
