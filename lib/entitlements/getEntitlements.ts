"use client";

import type { Entitlements } from "@/lib/entitlements/types";
import { FREE_ENTITLEMENTS } from "@/lib/entitlements/types";
import { getLocalEntitlements, setLocalEntitlements } from "@/lib/entitlements/localStore";

type ApiRes =
  | { ok: true; entitlements: Entitlements; userKey?: string }
  | { ok: false; error?: string };

export async function getEntitlements(userKey: string): Promise<Entitlements> {
  // local fallback for whatever key the caller thinks they are (usually correct)
  const local = getLocalEntitlements(userKey) ?? FREE_ENTITLEMENTS;

  try {
    // ✅ session-based; server derives user + admin from Supabase cookies
    const res = await fetch("/api/entitlements", {
      cache: "no-store",
      credentials: "include",
    });

    if (!res.ok) return local;

    const json = (await res.json()) as ApiRes;
    if (!json.ok) return local;

    const server = json.entitlements;

    // ✅ IMPORTANT:
    // If the server tells us the real userKey, store entitlements under THAT key.
    // This prevents “premium stuck on guest” / “badge shows for admin” situations.
    const serverUserKey =
      typeof json.userKey === "string" && json.userKey.trim()
        ? json.userKey.trim()
        : userKey;

    const localUpdatedAt = typeof local.updatedAt === "number" ? local.updatedAt : 0;
    const serverUpdatedAt = typeof server.updatedAt === "number" ? server.updatedAt : 0;

    const localIsPremium = local.isPremium === true;
    const localExpired =
      typeof local.expiresAt === "number" &&
      local.expiresAt > 0 &&
      local.expiresAt < Date.now();

    const shouldTrustServer =
      server.isPremium === true ||
      ((localExpired || !localIsPremium) && serverUpdatedAt >= localUpdatedAt);

    if (shouldTrustServer) {
      setLocalEntitlements(serverUserKey, server);
      return server;
    }
  } catch {
    // ignore errors and fall back to local
  }

  return local;
}