"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PUBLIC_FLAGS } from "@/lib/flags/public";
import { useEntitlements } from "@/components/EntitlementsProvider.client";
import { useUsageCap } from "@/lib/freeAccess/useUsageCap";
import { useAuthStatus } from "@/components/useAuthStatus";

function currentPath(pathname: string, sp: URLSearchParams) {
  const qs = sp.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export default function RequirePremium({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const { isPremium, loading: entitlementsLoading } = useEntitlements();
  const { isOverCap } = useUsageCap();

  // Only redirect on route entry, not mid-session state changes
// Only prevent *repeat redirects* for the same route
const redirectedRef = useRef<string>("");

const { loading: authLoading } = useAuthStatus();


const qs = sp.toString();

useEffect(() => {
  if (!PUBLIC_FLAGS.enablePremiumGates) return;
  if (entitlementsLoading) return;

  const key = `${pathname}?${qs}`;

  if (isPremium) return;
  if (!isOverCap) return;

  if (redirectedRef.current === key) return;
  redirectedRef.current = key;

  const next = encodeURIComponent(currentPath(pathname, sp));
  router.replace(`/premium?next=${next}`);
}, [entitlementsLoading, isPremium, isOverCap, pathname, qs, router]);



  if (!PUBLIC_FLAGS.enablePremiumGates) return <>{children}</>;
  if (entitlementsLoading) return null;
  if (isPremium) return <>{children}</>;
  if (!isOverCap) return <>{children}</>;


  return null;
}
