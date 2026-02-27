// lib/middleware/paths.ts
export const PATHS = {
  ONBOARDING: '/onboarding',
  LOGIN: '/login',
  HOME: '/',
} as const;

export const ONBOARDING_COOKIE = 'expatise_onboarded';
export function isBypassPath(pathname: string) {
  // Bypass static files, images, api routes, and favicon
  if (
    pathname.startsWith('/_next/static') ||
    pathname.startsWith('/_next/image') ||
    pathname.startsWith('/api') ||
    pathname === '/Expatise-logo.jpg' ||
    pathname.startsWith('/images')
  ) {
    return true;
  }
  return false;
}