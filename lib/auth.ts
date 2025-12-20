// lib/auth.ts
export const AUTH_COOKIE = "expatise_auth";

// One regex everywhere (client + server)
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(input: string) {
  return String(input || "").trim().toLowerCase();
}

export function isValidEmail(input: string) {
  return EMAIL_REGEX.test(String(input || "").trim());
}

// Prevent open-redirects
export function safeNextPath(next: string | null, fallback = "/") {
  if (!next) return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//")) return fallback;
  return next;
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 300, // 300 days (match your local-login route)
  };
}