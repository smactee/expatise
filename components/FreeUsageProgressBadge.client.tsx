// components/FreeUsageProgressBadge.client.tsx
"use client";

import { useMemo } from "react";
import { useUserKey } from "@/components/useUserKey.client";
import { FREE_CAPS } from "@/lib/freeAccess/localUsageCap";
import { useEntitlements } from "@/components/EntitlementsProvider.client";
import { useUsageCap } from "@/lib/freeAccess/useUsageCap";
import { usePathname } from "next/navigation";

const HIDE_BADGE_EXACT = new Set<string>();
const HIDE_BADGE_PREFIXES = ["/login", "/onboarding", "/forgot-password", "/premium", "/checkout", "/success"];

export default function FreeUsageProgressBadge() {
  const pathname = usePathname() || "/";
  const userKey = useUserKey();
  const { isPremium, loading } = useEntitlements();

  const demoPremium =
    typeof window !== "undefined" &&
    (process.env.NEXT_PUBLIC_DEMO_SEED_ALL ?? "") === "1" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname.endsWith(".vercel.app"));

  const hide =
    HIDE_BADGE_EXACT.has(pathname) ||
    HIDE_BADGE_PREFIXES.some((p) => pathname.startsWith(p));

  // Always hide on these routes / demo mode
  if (hide || demoPremium) return null;

  // ✅ Key rule:
  // - Guest: show immediately (don’t wait for entitlements)
  // - Signed-in: wait until entitlements resolved (prevents showing badge to premium/admin)
  if (userKey !== "guest" && loading) return null;

  if (isPremium) return null;

  return <FreeUsageProgressBadgeInner userKey={userKey} />;
}

function FreeUsageProgressBadgeInner({ userKey }: { userKey: string }) {
  const { questionsShown: shown, examsStarted: starts } = useUsageCap(userKey);

  const text = useMemo(() => {
    return `${shown}/${FREE_CAPS.questionsShown} Questions · ${starts}/${FREE_CAPS.examStarts} Exams`;
  }, [shown, starts]);

return (
  <div
  style={{
    position: "fixed",
    top: 30,
    right: 12,
    zIndex: 9999,
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    lineHeight: "14px",
    background: "transparent",
color: "#ffffff",
border: "none",
backdropFilter: "none",
WebkitBackdropFilter: "none",
boxShadow: "none",
    pointerEvents: "none",
  }}
  aria-label="Free usage progress"
  title={`Free usage progress (${userKey})`}
>
    {text}
  </div>
);
}
