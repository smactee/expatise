// components/useAuthStatus.ts
"use client";

import { useCallback, useEffect, useState } from "react";

type AuthStatus = {
  authed: boolean;
  method: "guest" | "email" | "social";
  email: string | null;
  provider: string | null;
};

export function useAuthStatus() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<AuthStatus>({
    authed: false,
    method: "guest",
    email: null,
    provider: null,
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/session", { cache: "no-store" });
      const data = (await res.json()) as Partial<AuthStatus>;

      setStatus({
        authed: Boolean(data.authed),
        method: (data.method as any) ?? "guest",
        email: data.email ?? null,
        provider: data.provider ?? null,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...status, loading, refresh };
}
