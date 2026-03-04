// lib/middleware/paths.ts
export const PATHS = {
  ONBOARDING: '/onboarding',
  LOGIN: '/login',
  HOME: '/',
} as const;

export const ONBOARDING_COOKIE = 'expatise_onboarded';


export function isBypassPath(pathname: string) {
  // ✅ Bypass auth callback so PKCE exchange isn't disturbed by middleware/session refresh
  if (pathname.startsWith("/auth/callback")) return true;

  // Bypass static files, images, api routes, and favicon
  if (
    pathname.startsWith("/_next/static") ||
    pathname.startsWith("/_next/image") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/images")
  ) {
    return true;
  }
  return false;
}