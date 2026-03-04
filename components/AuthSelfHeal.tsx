"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

function looksLikeRefreshTokenIssue(err: unknown) {
  const msg = String((err as any)?.message ?? err ?? "");
  return /refresh token/i.test(msg) || /invalid.*token/i.test(msg);
}

export default function AuthSelfHeal() {
  useEffect(() => {
    // ✅ Don't touch auth during OAuth / login routes (prevents lock collisions)
    if (typeof window !== "undefined") {
      const p = window.location.pathname;
      const qs = window.location.search;
      if (
        p.startsWith("/login") ||
        p.startsWith("/auth") || // includes /auth/callback
        qs.includes("code=") ||
        qs.includes("state=")
      ) {
        return;
      }
    }

    const supabase = createClient();

    (async () => {
      try {
        const { error } = await supabase.auth.getSession();
        if (error && looksLikeRefreshTokenIssue(error)) {
          await supabase.auth.signOut({ scope: "local" });
          window.location.reload();
        }
      } catch (e) {
        if (looksLikeRefreshTokenIssue(e)) {
          await supabase.auth.signOut({ scope: "local" });
          window.location.reload();
        }
      }
    })();
  }, []);

  return null;
}