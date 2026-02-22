// proxy.ts (project root) or middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { isBypassPath } from "./lib/middleware/paths";
import { applyOnboardingGate } from "./lib/middleware/onboarding";

// TEMP: disable your old NextAuth/local auth gate until we migrate it to Supabase.
// import { applyAuthGate } from "./lib/middleware/auth";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isBypassPath(pathname)) return NextResponse.next();

  const onboardingRes = applyOnboardingGate(req);
  if (onboardingRes) return onboardingRes;

  // Let the request continue
  const res = NextResponse.next({ request: req });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If env is missing, don't crash the whole app
  if (!url || !anonKey) return res;

  const supabase = createServerClient(url, anonKey, {
  auth: {
    flowType: "pkce",
    storageKey: "sb-expatise-auth",
  },
  cookies: {
    getAll() {
      return req.cookies.getAll();
    },
    setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value, options }) => {
        req.cookies.set(name, value);
        res.cookies.set(name, value, options);
      });
    },
  },
});
if (pathname.startsWith("/api/")) return res;
  // Refresh session if needed (sets/updates cookies via setAll)
  await supabase.auth.getUser();

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images).*)"],
};

