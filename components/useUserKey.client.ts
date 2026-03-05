// components/useUserKey.client.ts
"use client";

import { useMemo } from "react";
import { useAuthStatus } from "@/components/useAuthStatus";
import { userKeyFromEmail } from "@/lib/identity/userKey";

export function useUserKey() {
  const { authed, email, userId } = useAuthStatus() as any; // remove "as any" after you add userId to the type

  return useMemo(() => {
    // ✅ Best: stable, non-PII, webhook-friendly
    if (authed && userId) return `sb:${userId}`;

    // fallback (should rarely be needed)
    if (authed && email) return userKeyFromEmail(email);

    return "guest";
  }, [authed, email, userId]);
}