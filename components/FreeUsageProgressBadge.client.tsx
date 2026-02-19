// components/FreeUsageProgressBadge.client.tsx
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useUserKey } from "@/components/useUserKey.client";
import {
  FREE_CAPS,
  getUsageCapState,
  usageCapEventName,
} from "@/lib/freeAccess/localUsageCap";
import { useEntitlements } from "@/components/EntitlementsProvider.client";
import { usePathname } from "next/navigation";

const HIDE_BADGE_EXACT = new Set(["/"]);
const HIDE_BADGE_PREFIXES = ["/login", "/onboarding", "/forgot-password"];

export default function FreeUsageProgressBadge() {
  const pathname = usePathname() || "/";
  const { isPremium } = useEntitlements();

const demoPremium =
  typeof window !== "undefined" &&
  (process.env.NEXT_PUBLIC_DEMO_SEED_ALL ?? "") === "1" &&
  (window.location.hostname === "localhost" || window.location.hostname.endsWith(".vercel.app"));

  const hide =
    HIDE_BADGE_EXACT.has(pathname) ||
    HIDE_BADGE_PREFIXES.some((p) => pathname.startsWith(p));

  // ✅ Gate here (safe): this component always calls the same hooks
if (hide || isPremium || demoPremium) return null;

  return <FreeUsageProgressBadgeInner />;
}

function FreeUsageProgressBadgeInner() {
  const userKey = useUserKey();

  const [shown, setShown] = useState(0);
  const [starts, setStarts] = useState(0);

  const refresh = useCallback(() => {
    const s = getUsageCapState(userKey);
    setShown(s.shown);
    setStarts(s.examStarts);
  }, [userKey]);

  useEffect(() => {
    refresh();

    const evt = usageCapEventName();
    const onChange = () => refresh();

    window.addEventListener(evt, onChange);
    window.addEventListener("expatise:session-changed", onChange);

    return () => {
      window.removeEventListener(evt, onChange);
      window.removeEventListener("expatise:session-changed", onChange);
    };
  }, [refresh]);

  const text = useMemo(() => {
    return `${shown}/${FREE_CAPS.questionsShown} Questions · ${starts}/${FREE_CAPS.examStarts} Exams`;
  }, [shown, starts]);

  return (
    <div
      style={{
        position: "fixed",
        top: 12,
        right: 12,
        zIndex: 9999,
        padding: "8px 10px",
        borderRadius: 999,
        fontSize: 12,
        lineHeight: "12px",
        background: "rgba(0,0,0,0.65)",
        color: "white",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
      aria-label="Free usage progress"
      title="Free usage progress"
    >
      {text}
    </div>
  );
}
