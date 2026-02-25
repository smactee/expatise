// lib/authClient/web.ts
"use client";

import type { AuthClient, SessionRes } from "./types";
import { createClient } from "@/lib/supabase/client";

const GUEST: SessionRes = {
  ok: false,
  authed: false,
  method: "guest",
  email: null,
  provider: null,
};

function detectProvider(user: any): string | null {
  if (!user) return null;
  if (user.is_anonymous) return "anonymous";

  const am = user.app_metadata ?? {};
  if (typeof am.provider === "string" && am.provider) return am.provider;
  if (Array.isArray(am.providers) && am.providers.length) return am.providers[0];

  const ident = user.identities?.[0]?.provider;
  return ident ?? null;
}

export const webAuthClient: AuthClient = {
  async getSession() {
    try {
      const supabase = createClient();

      // On the client, getSession() is fine (fast); on the server it’s insecure. :contentReference[oaicite:1]{index=1}
      const { data, error } = await supabase.auth.getSession();
      const user = error ? null : data.session?.user ?? null;

      if (!user || detectProvider(user) === "anonymous") return GUEST;

      const provider = detectProvider(user);
      const isEmail = provider === "email" || (!!user.email && !provider);

      return {
        ok: true,
        authed: true,
        method: isEmail ? "email" : "social",
        email: user.email ?? null,
        provider: isEmail ? "email" : provider,
      };
    } catch {
      return GUEST;
    }
  },
};