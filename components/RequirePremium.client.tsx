"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PUBLIC_FLAGS } from "@/lib/flags/public";
import { useEntitlements } from "@/components/EntitlementsProvider.client";
import { useUsageCap } from "@/lib/freeAccess/useUsageCap";
import CSRBoundary from "@/components/CSRBoundary";

function currentPath(pathname: string, qs: string) {
  return qs ? `${pathname}?${qs}` : pathname;
}

function Inner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const { isPremium, loading: entitlementsLoading } = useEntitlements();
  const { isOverCap } = useUsageCap();

  const redirectedRef = useRef<string>("");
  const qs = sp.toString();

  useEffect(() => {
    if (!PUBLIC_FLAGS.enablePremiumGates) return;
    if (entitlementsLoading) return;

    const key = `${pathname}?${qs}`;

    if (isPremium) return;
    if (!isOverCap) return;

    if (redirectedRef.current === key) return;
    redirectedRef.current = key;

    const next = encodeURIComponent(currentPath(pathname, qs));
    router.replace(`/premium?next=${next}`);
  }, [entitlementsLoading, isPremium, isOverCap, pathname, qs, router]);

  if (!PUBLIC_FLAGS.enablePremiumGates) return <>{children}</>;
  if (entitlementsLoading) return null;
  if (isPremium) return <>{children}</>;
  if (!isOverCap) return <>{children}</>;

  return null;
}

export default function RequirePremium({ children }: { children: React.ReactNode }) {
  return (
    <CSRBoundary>
      <Inner>{children}</Inner>
    </CSRBoundary>
  );
}
