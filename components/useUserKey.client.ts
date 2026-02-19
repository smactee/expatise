"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { userKeyFromEmail } from "@/lib/identity/userKey";
import { webAuthClient } from "@/lib/authClient/web";

export function useUserKey() {
  const [userKey, setUserKey] = useState<string>("guest");
  const seqRef = useRef(0);

  const refresh = useCallback(() => {
    const seq = ++seqRef.current;

    (async () => {
      const session = await webAuthClient.getSession();
      if (seq !== seqRef.current) return;

      const email = session.authed ? session.email : null;
      setUserKey(userKeyFromEmail(email));
    })().catch(() => {
      if (seq !== seqRef.current) return;
      setUserKey("guest");
    });
  }, []);

  useEffect(() => {
    refresh();

    const onChanged = () => refresh();
    window.addEventListener("expatise:session-changed", onChanged);

    return () => {
      window.removeEventListener("expatise:session-changed", onChanged);
      seqRef.current++;
    };
  }, [refresh]);

  return userKey;
}
