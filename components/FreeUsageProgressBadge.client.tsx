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

  const hide =
    HIDE_BADGE_EXACT.has(pathname) ||
    HIDE_BADGE_PREFIXES.some((p) => pathname.startsWith(p));

  if (hide) return null;

  // ✅ render a child component instead of conditionally calling hooks
  return <FreeUsageProgressBadgeInner />;
}

function FreeUsageProgressBadgeInner() {
  const { isPremium } = useEntitlements();
  const userKey = useUserKey();

  const [shown, setShown] = useState(0);
  const [starts, setStarts] = useState(0);

  const refresh = useCallback(() => {
    const s = getUsageCapState(userKey);
    setShown(s.shown);
    setStarts(s.examStarts);
  }, [userKey]);

  useEffect(() => {
    // optional: if premium, don’t even attach listeners
    if (isPremium) return;

    refresh();

    const evt = usageCapEventName();
    const onChange = () => refresh();

    window.addEventListener(evt, onChange);
    window.addEventListener("expatise:session-changed", onChange);

    return () => {
      window.removeEventListener(evt, onChange);
      window.removeEventListener("expatise:session-changed", onChange);
    };
  }, [refresh, isPremium]);

  if (isPremium) return null;

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
