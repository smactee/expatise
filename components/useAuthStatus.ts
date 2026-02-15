// components/useAuthStatus.ts
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type AuthState = {
  loading: boolean;
  authed: boolean; // true only for email/social (NOT anon/guest)
  method: "guest" | "email" | "social";
  email: string | null;
  provider: string | null; // "google" | "apple" | "wechat" | "email" | "anonymous" | null
};

function detectProvider(user: User | null): string | null {
  if (!user) return null;

  // strongest signal for guest
  if ((user as any).is_anonymous) return "anonymous";

  const am = (user.app_metadata as any) ?? {};

  // common: "google" | "email" | "apple" | ...
  if (typeof am.provider === "string" && am.provider) return am.provider;

  // sometimes: ["google"] or ["email"]
  if (Array.isArray(am.providers) && am.providers.length > 0) {
    return am.providers[0];
  }

  // fallback
  const ident = user.identities?.[0]?.provider;
  return ident ?? null;
}

function toState(user: User | null, loading: boolean): AuthState {
  if (!user) {
    return { loading, authed: false, method: "guest", email: null, provider: null };
  }

  const provider = detectProvider(user);

  // anon = guest for your gating semantics
  if (provider === "anonymous") {
    return { loading, authed: false, method: "guest", email: null, provider: "anonymous" };
  }

  // email/password
  if (provider === "email" || (!!user.email && !provider)) {
    return { loading, authed: true, method: "email", email: user.email ?? null, provider: "email" };
  }

  // social
  return { loading, authed: true, method: "social", email: user.email ?? null, provider };
}

export function useAuthStatus() {
  const supabase = useMemo(() => createClient(), []);

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
        setState((s) => ({ ...s, loading: true }));

        // session is enough for UI + avoids extra network calls
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;

        setState(toState(data.session?.user ?? null, false));
      } catch {
        if (cancelled) return;
        setState(toState(null, false));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  useEffect(() => {
    const cleanup = refresh();

    const onChanged = () => refresh();
    window.addEventListener("expatise:session-changed", onChanged);

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(toState(session?.user ?? null, false));
    });

    return () => {
      cleanup?.();
      window.removeEventListener("expatise:session-changed", onChanged);
      sub.subscription.unsubscribe();
    };
  }, [refresh, supabase]);

  return { ...state, refresh };
}
