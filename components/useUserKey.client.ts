"use client";

import { useEffect, useState } from "react";
import { userKeyFromEmail } from "@/lib/identity/userKey";

type SessionOk = {
  ok: true;
  authed: true;
  method: "email" | "social";
  email: string | null;
  provider: string | null;
};

type SessionNo = {
  ok: false;
  authed: false;
  method: "guest";
  email: null;
  provider: null;
};

type SessionRes = SessionOk | SessionNo;

export function useUserKey() {
  const [userKey, setUserKey] = useState<string>("guest");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const res = await fetch("/api/session", { cache: "no-store" });
        const json = (await res.json()) as SessionRes;

        const email = json.ok && json.authed ? (json.email ?? "") : "";
        const nextKey = userKeyFromEmail(email);

        if (!cancelled) setUserKey(nextKey);
      } catch {
        if (!cancelled) setUserKey("guest");
      }
    }

    run();

    const onRefresh = () => run();
    window.addEventListener("expatise:session-changed", onRefresh);

    return () => {
      cancelled = true;
      window.removeEventListener("expatise:session-changed", onRefresh);
    };
  }, []);

  return userKey;
}
