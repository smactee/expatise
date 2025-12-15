// middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { isBypassPath } from './lib/middleware/paths';
import { applyOnboardingGate } from './lib/middleware/onboarding';

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isBypassPath(pathname)) return NextResponse.next();

  const onboardingRes = applyOnboardingGate(req);
  if (onboardingRes) return onboardingRes;

  return NextResponse.next();
}

export const config = {
  // Run for all pages except Next internals, static assets, and API routes
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images|api).*)'],
};
