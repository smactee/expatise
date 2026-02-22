//components/AuthSelfHeal.tsx
"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

function looksLikeRefreshTokenIssue(err: unknown) {
  const msg = String((err as any)?.message ?? err ?? "");
  return /refresh token/i.test(msg) || /invalid.*token/i.test(msg);
}

export default function AuthSelfHeal() {
  useEffect(() => {
    const supabase = createClient();

    (async () => {
      try {
        // This is enough to trigger a refresh attempt if Supabase thinks it needs one
        const { error } = await supabase.auth.getSession();
        if (error && looksLikeRefreshTokenIssue(error)) {
          // Clear local auth state so Supabase stops retrying with a bad/missing refresh token
          await supabase.auth.signOut({ scope: "local" });
          // Optional: hard reload so any UI/auth state resets cleanly
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
