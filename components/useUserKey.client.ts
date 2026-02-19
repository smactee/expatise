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

      if (!session.authed) {
        setUserKey("guest");
        return;
      }

      // userKeyFromEmail already normalizes + returns "guest" if null/empty
      setUserKey(userKeyFromEmail(session.email));
    })().catch(() => {
      if (seq !== seqRef.current) return;
      setUserKey("guest");
    });
  }, []);

  useEffect(() => {
    refresh();

    const onSessionChanged = () => refresh();
    const onFocus = () => refresh();
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };

    window.addEventListener("expatise:session-changed", onSessionChanged);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    // Safari/iOS safety net: refresh periodically while visible
    const pollId = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 60_000);

    return () => {
      window.removeEventListener("expatise:session-changed", onSessionChanged);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(pollId);
      seqRef.current++;
    };
  }, [refresh]);

  return userKey;
}
