//lib/entitlements/getEntitlements.ts

"use client";

import type { Entitlements } from "@/lib/entitlements/types";
import { FREE_ENTITLEMENTS } from "@/lib/entitlements/types";
import { getLocalEntitlements, setLocalEntitlements } from "@/lib/entitlements/localStore";
import { createClient } from "@/lib/supabase/client";
import {
  FunctionsHttpError,
  FunctionsRelayError,
  FunctionsFetchError,
} from "@supabase/supabase-js";

type FnRes =
  | { ok: true; entitlements: Entitlements; userKey?: string }
  | { ok: false; error?: string; detail?: string };

export async function getEntitlements(userKey: string): Promise<Entitlements> {
  const local = getLocalEntitlements(userKey) ?? FREE_ENTITLEMENTS;

  try {
    const supabase = createClient();

// 0) pull session token explicitly (important in Capacitor/WebView)
const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
if (sessionErr) return local;

const token = sessionData.session?.access_token ?? null;

// ✅ If there's no real user JWT yet, DON'T call the function (verify_jwt=true will 401).
// Just return local, and we'll refresh when auth finishes.
if (!token) return local;

const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!anonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)"
  );
}

const { data, error } = await supabase.functions.invoke("entitlements", {
  body: { userKey },
  headers: {
    Authorization: `Bearer ${token}`, // ✅ only JWT here
    apikey: anonKey,                  // keep this header
  },
});
    let json: FnRes | null = (data ?? null) as any;

    // IMPORTANT: when the function returns 4xx/5xx, supabase-js may give you a FunctionsHttpError
    // and the real JSON is inside error.context.json()
    if (error) {
    
      if (error instanceof FunctionsHttpError) {
        json = (await error.context.json().catch(() => null)) as any;
      } else if (error instanceof FunctionsRelayError || error instanceof FunctionsFetchError) {
        return local;
      } else {
        return local;
      }
    }

    if (!json || !("ok" in json) || !json.ok) return local;

    const server = json.entitlements;
    if (!server) return local;

    // If server returns a better userKey, store under that key
    const serverUserKey =
      typeof json.userKey === "string" && json.userKey.trim()
        ? json.userKey.trim()
        : userKey;

    const localUpdatedAt = typeof local.updatedAt === "number" ? local.updatedAt : 0;
    const serverUpdatedAt = typeof server.updatedAt === "number" ? server.updatedAt : 0;

    const localIsPremium = local.isPremium === true;
    const localExpired =
      typeof local.expiresAt === "number" && local.expiresAt > 0 && local.expiresAt < Date.now();

    const shouldTrustServer =
      server.isPremium === true ||
      ((localExpired || !localIsPremium) && serverUpdatedAt >= localUpdatedAt);

    if (shouldTrustServer) {
      setLocalEntitlements(serverUserKey, server);
      return server;
    }
  } catch {
    // ignore and fall back to local
  }

  return local;
}