// components/useUserKey.client.ts
"use client";

import { useMemo } from "react";
import { useAuthStatus } from "@/components/useAuthStatus";
import { userKeyFromEmail } from "@/lib/identity/userKey";

export function useUserKey() {
  const { authed, email } = useAuthStatus();

  return useMemo(() => {
    if (authed && email) return userKeyFromEmail(email);
    return "guest";
  }, [authed, email]);
}