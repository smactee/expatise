// components/useAuthStatus.ts
"use client";

import { useCallback, useEffect, useState } from "react";

export function useAuthStatus() {
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/session", { cache: "no-store" });
      const data = await res.json().catch(() => ({ authed: false }));
      setAuthed(Boolean(data.authed));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { authed, loading, refresh };
}
