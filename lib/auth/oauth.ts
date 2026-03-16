import { safeNextPath } from "@/lib/auth";

export const NATIVE_OAUTH_REDIRECT_URI = "expatise://auth/callback";

export async function buildAuthCallbackUrl(next = "/") {
  const safeNext = safeNextPath(next, "/");
  const { Capacitor } = await import("@capacitor/core");

  if (Capacitor.isNativePlatform()) {
    return `${NATIVE_OAUTH_REDIRECT_URI}?next=${encodeURIComponent(safeNext)}`;
  }

  if (typeof window === "undefined") {
    return `/auth/callback?next=${encodeURIComponent(safeNext)}`;
  }

  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`;
}
