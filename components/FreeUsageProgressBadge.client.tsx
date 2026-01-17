// components/FreeUsageProgressBadge.client.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useUserKey } from "@/components/useUserKey.client";
import {
  FREE_CAPS,
  getUsageCapState,
  usageCapEventName,
} from "@/lib/freeAccess/localUsageCap";

export default function FreeUsageProgressBadge() {
  const userKey = useUserKey();

  const [shown, setShown] = useState(0);
  const [starts, setStarts] = useState(0);

  const refresh = () => {
    const s = getUsageCapState(userKey);
    setShown(s.shown);
    setStarts(s.examStarts);
  };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userKey]);

  const text = useMemo(() => {
    return `${shown}/${FREE_CAPS.questionsShown} · ${starts}/${FREE_CAPS.examStarts}`;
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
