"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PUBLIC_FLAGS } from "@/lib/flags/public";
import { useEntitlements } from "@/components/EntitlementsProvider.client";
import { useUsageCap } from "@/lib/freeAccess/useUsageCap";

function currentPath(pathname: string, sp: URLSearchParams) {
  const qs = sp.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export default function RequirePremium({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const { isPremium } = useEntitlements();
  const { isOverCap } = useUsageCap();

  // Only redirect on route entry, not mid-session state changes
  const checkedRef = useRef<string>("");

  useEffect(() => {
    if (!PUBLIC_FLAGS.enablePremiumGates) return;

    const key = `${pathname}?${sp.toString()}`;
    if (checkedRef.current === key) return;
    checkedRef.current = key;

    // premium always allowed
    if (isPremium) return;

    // free user allowed until cap reached
    if (!isOverCap) return;

    const next = encodeURIComponent(currentPath(pathname, sp));
    router.replace(`/premium?next=${next}`);
  }, [isPremium, isOverCap, pathname, sp, router]);

  if (!PUBLIC_FLAGS.enablePremiumGates) return <>{children}</>;
  if (isPremium) return <>{children}</>;
  if (!isOverCap) return <>{children}</>;

  return null;
}
