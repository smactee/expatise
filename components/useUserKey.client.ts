// components/useUserKey.client.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { userKeyFromEmail } from "@/lib/identity/userKey";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

function detectProvider(user: User | null): string | null {
  if (!user) return null;
  const p = (user.app_metadata as any)?.provider as string | undefined;
  if (p) return p;
  return user.identities?.[0]?.provider ?? null;
}

function makeUserKey(user: User | null): string {
  if (!user) return "guest";

  // If you want anonymous to behave like “guest” everywhere, keep this:
  const provider = detectProvider(user);
  if (!provider || provider === "anonymous") return `anon:${user.id}`;


  // Prefer your old email-based key when available (backward-compatible)
  const email = user.email ?? "";
  if (email) return userKeyFromEmail(email);

  // Fallback: stable Supabase user id (covers providers with no email)
  return `sb:${user.id}`;
}

export function useUserKey() {
  const supabase = useMemo(() => createClient(), []);
  const [userKey, setUserKey] = useState<string>("guest");
  const seqRef = useRef(0);

  const refresh = useCallback(() => {
    const seq = ++seqRef.current;

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (seq !== seqRef.current) return;

        setUserKey(makeUserKey(data.session?.user ?? null));
      } catch {
        if (seq !== seqRef.current) return;
        setUserKey("guest");
      }
    })();
  }, [supabase]);

  useEffect(() => {
    refresh();

    const onChanged = () => refresh();
    window.addEventListener("expatise:session-changed", onChanged);

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserKey(makeUserKey(session?.user ?? null));
    });

    return () => {
      window.removeEventListener("expatise:session-changed", onChanged);
      sub.subscription.unsubscribe();
      seqRef.current++;
    };
  }, [refresh, supabase]);

  return userKey;
}
