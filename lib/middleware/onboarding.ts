// lib/middleware/onboarding.ts
import { NextResponse, type NextRequest } from 'next/server';
import { PATHS, ONBOARDING_COOKIE } from './paths';

export function onboardingMiddleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow onboarding page itself
  if (pathname.startsWith(PATHS.ONBOARDING)) return null;

  // If cookie exists, user already completed onboarding
  const onboarded = req.cookies.get(ONBOARDING_COOKIE)?.value === '1';
  if (onboarded) return null;

  // Otherwise redirect all normal pages to onboarding
  const url = req.nextUrl.clone();
  url.pathname = PATHS.ONBOARDING;
  return NextResponse.redirect(url);
}
export function applyOnboardingGate(req: NextRequest) {
  return onboardingMiddleware(req);
}