// app/api/entitlements/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE, normalizeEmail } from "@/lib/auth";
import { auth } from "@/app/auth";
import { userKeyFromEmail } from "@/lib/identity/userKey";

import { FREE_ENTITLEMENTS } from "@/lib/entitlements/types";
import { getLocalEntitlements } from "@/lib/entitlements/localStore";

export async function GET() {
  const cookieStore = await Promise.resolve(cookies());

  // local cookie first
  const localEmail = cookieStore.get(AUTH_COOKIE)?.value ?? "";
  let email = normalizeEmail(localEmail);

  // fallback to NextAuth session
  if (!email) {
    const session = await auth().catch(() => null);
    email = normalizeEmail(session?.user?.email ?? "");
  }

  const userKey = userKeyFromEmail(email);
  const entitlements = getLocalEntitlements(userKey) ?? FREE_ENTITLEMENTS;

  return NextResponse.json({ ok: true, userKey, entitlements });
}
