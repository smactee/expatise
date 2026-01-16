// components/useAuthStatus.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import { authClient } from "@/lib/authClient";
import type { SessionRes } from "@/lib/authClient/types";

type AuthState = {
  loading: boolean;
  authed: boolean;
  method: "guest" | "email" | "social";
  email: string | null;
  provider: string | null;
};

export function useAuthStatus() {
  const [state, setState] = useState<AuthState>({
    loading: true,
    authed: false,
    method: "guest",
    email: null,
    provider: null,
  });

  const refresh = useCallback(() => {
    let cancelled = false;

    (async () => {
      try {
        const json = (await authClient.getSession()) as SessionRes;

        if (cancelled) return;

        if (json.ok && json.authed) {
          setState({
            loading: false,
            authed: true,
            method: json.method,
            email: json.email,
            provider: json.provider,
          });
        } else {
          setState({
            loading: false,
            authed: false,
            method: "guest",
            email: null,
            provider: null,
          });
        }
      } catch {
        if (cancelled) return;
        setState({
          loading: false,
          authed: false,
          method: "guest",
          email: null,
          provider: null,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const cleanup = refresh();

    const onChanged = () => refresh();
    window.addEventListener("expatise:session-changed", onChanged);

    return () => {
      cleanup?.();
      window.removeEventListener("expatise:session-changed", onChanged);
    };
  }, [refresh]);

  return { ...state, refresh };
}
