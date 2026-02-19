//lib/entitlements/getEntitlements.ts

"use client";

import type { Entitlements } from "@/lib/entitlements/types";
import { FREE_ENTITLEMENTS } from "@/lib/entitlements/types";
import { getLocalEntitlements, setLocalEntitlements } from "@/lib/entitlements/localStore";

type ApiRes =
  | { ok: true; entitlements: Entitlements; userKey?: string }
  | { ok: false; error?: string };


export async function getEntitlements(userKey: string): Promise<Entitlements> {
  const local = getLocalEntitlements(userKey) ?? FREE_ENTITLEMENTS;

  try {
    // Pass userKey for future-proofing (even if server uses cookies today)
    const url = `/api/entitlements?userKey=${encodeURIComponent(userKey)}`;

    const res = await fetch(url, { cache: "no-store", credentials: "include" });

    if (!res.ok) return local;

    const json = (await res.json()) as ApiRes;
    if (json.ok) {
  const server = json.entitlements;

  const localUpdatedAt = typeof local.updatedAt === "number" ? local.updatedAt : 0;
  const serverUpdatedAt = typeof server.updatedAt === "number" ? server.updatedAt : 0;

  // Only let server overwrite local if it's clearly newer OR it grants premium.
  const localIsPremium = local.isPremium === true;
const localExpired =
  typeof local.expiresAt === "number" &&
  local.expiresAt > 0 &&
  local.expiresAt < Date.now();

// Trust server if it GRANTS premium, or if local is not premium (or expired) and server is newer.
const shouldTrustServer =
  server.isPremium === true ||
  ((localExpired || !localIsPremium) && serverUpdatedAt >= localUpdatedAt);


  if (shouldTrustServer) {
    setLocalEntitlements(userKey, server);
    return server;
  }
}
  } catch {
    // ignore errors and fall back to local
  }

  return local;
}
