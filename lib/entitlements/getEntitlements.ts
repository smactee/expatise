// lib/entitlements/getEntitlements.ts
"use client";

import type { Entitlements } from "@/lib/entitlements/types";
import { FREE_ENTITLEMENTS } from "@/lib/entitlements/types";
import { getLocalEntitlements } from "@/lib/entitlements/localStore";

type ApiRes =
  | { ok: true; entitlements: Entitlements }
  | { ok: false; error?: string };

export async function getEntitlements(userKey: string): Promise<Entitlements> {
  const local = getLocalEntitlements(userKey) ?? FREE_ENTITLEMENTS;

  try {
    const res = await fetch("/api/entitlements", { cache: "no-store" });
    const json = (await res.json()) as ApiRes;
    if (json.ok) return json.entitlements;
  } catch {
    // ignore
  }

  return local;
}
