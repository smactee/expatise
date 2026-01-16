// components/useUserKey.client.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { userKeyFromEmail } from "@/lib/identity/userKey";
import { authClient } from "@/lib/authClient";

export function useUserKey() {
  const [userKey, setUserKey] = useState<string>("guest");
  const seqRef = useRef(0);

  const refresh = useCallback(() => {
    const seq = ++seqRef.current;

    (async () => {
      try {
        const json = await authClient.getSession();
        if (seq !== seqRef.current) return;

        const email = json.ok && json.authed ? (json.email ?? "") : "";
        setUserKey(userKeyFromEmail(email));
      } catch {
        if (seq !== seqRef.current) return;
        setUserKey("guest");
      }
    })();
  }, []);

  useEffect(() => {
  refresh();

  if (typeof window === "undefined") return;

  const onChanged = () => refresh();
  window.addEventListener("expatise:session-changed", onChanged);

  return () => {
    window.removeEventListener("expatise:session-changed", onChanged);
    seqRef.current++; // invalidate in-flight
  };
}, [refresh]);


  return userKey;
}
