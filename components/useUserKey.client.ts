"use client";

import { useEffect, useState } from "react";
import { userKeyFromEmail } from "@/lib/identity/userKey";

type SessionRes =
  | { ok: true; email?: string | null; provider?: string | null }
  | { ok: false };

export function useUserKey() {
  const [userKey, setUserKey] = useState<string>("guest");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const res = await fetch("/api/session", { cache: "no-store" });
        const json = (await res.json()) as SessionRes;

        const email = (json && (json as any).email) ? String((json as any).email) : "";
        const nextKey = userKeyFromEmail(email);

        if (!cancelled) setUserKey(nextKey);
      } catch {
        if (!cancelled) setUserKey("guest");
      }
    }

    run();
    return () => { cancelled = true; };
  }, []);

  return userKey;
}
