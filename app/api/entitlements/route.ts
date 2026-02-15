// app/api/entitlements/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE, normalizeEmail } from "@/lib/auth";
import { auth } from "@/app/auth";
import { userKeyFromEmail } from "@/lib/identity/userKey";

import { FREE_ENTITLEMENTS } from "@/lib/entitlements/types";
import { getLocalEntitlements } from "@/lib/entitlements/localStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_PREMIUM_EMAILS = (process.env.ADMIN_PREMIUM_EMAILS ?? "user@expatise.com")
  .split(",")
  .map((s) => normalizeEmail(s))
  .filter(Boolean);

function isAdminEmail(email: string) {
  return ADMIN_PREMIUM_EMAILS.includes(normalizeEmail(email));
}


export async function GET() {
  const cookieStore = await Promise.resolve(cookies());

  // local cookie first (may be token, not an email)
  const localCookie = cookieStore.get(AUTH_COOKIE)?.value ?? "";
  let email = normalizeEmail(localCookie);

  // ✅ Always try NextAuth session too (more reliable than your custom cookie)
  const session = await auth().catch(() => null);
  const sessionEmail = normalizeEmail(session?.user?.email ?? "");
  if (sessionEmail) email = sessionEmail;

  // derive userKey (in your current app this is effectively the email)
  const userKey = userKeyFromEmail(email);

  // ✅ Hackathon admin: allowlist by email OR by derived userKey
  if (isAdminEmail(email) || isAdminEmail(userKey)) {
    return NextResponse.json({
      ok: true,
      userKey,
      entitlements: {
        isPremium: true,
        source: "admin",
        updatedAt: Date.now(),
      },
    });
  }

  const entitlements = getLocalEntitlements(userKey) ?? FREE_ENTITLEMENTS;
  return NextResponse.json({ ok: true, userKey, entitlements });
}
