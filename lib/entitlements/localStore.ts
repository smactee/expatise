import { FREE_ENTITLEMENTS, type Entitlements, isExpired } from "./types";

const NS = "expatise:entitlements";

function keyFor(userKey: string) {
  return `${NS}:${userKey || "guest"}`;
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

export function getLocalEntitlements(userKey = "guest"): Entitlements {
  if (typeof window === "undefined") return FREE_ENTITLEMENTS;

  const raw = window.localStorage.getItem(keyFor(userKey));
  const parsed = safeParse<Entitlements>(raw);

  if (!parsed) return FREE_ENTITLEMENTS;
  if (isExpired(parsed)) return FREE_ENTITLEMENTS;

  return parsed;
}

export function setLocalEntitlements(userKey = "guest", e: Entitlements) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(keyFor(userKey), JSON.stringify(e));
}

export function clearLocalEntitlements(userKey = "guest") {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(keyFor(userKey));
}
