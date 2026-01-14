// lib/identity/userKey.ts
export const GUEST_KEY = "guest";

// Make keys stable and safe for storage keys
export function normalizeUserKey(input: string) {
  return String(input || "")
    .trim()
    .toLowerCase();
}

export function getGuestKey() {
  return GUEST_KEY;
}

/**
 * Choose a single canonical userKey:
 * - if logged in => email (normalized)
 * - else => guest
 *
 * We keep it simple now. Later we can switch to userId from backend.
 */
export function userKeyFromEmail(email: string | null | undefined) {
  const e = normalizeUserKey(email || "");
  return e ? e : GUEST_KEY;
}
