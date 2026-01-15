// app/api/session/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE } from "@/lib/auth";
import { auth } from "@/app/auth";

export async function GET() {
  // ✅ handles both sync/async cookies() typing across Next versions
  const cookieStore = await Promise.resolve(cookies());

  // Local/email login (custom cookie)
  const localEmail = cookieStore.get(AUTH_COOKIE)?.value ?? null;
  if (localEmail) {
    return NextResponse.json({
      ok: true,
      authed: true,
      method: "email",
      email: localEmail,
      provider: "local",
    });
  }

  // NextAuth social login
  const session = await auth();
  if (session?.user) {
    return NextResponse.json({
      ok: true,
      authed: true,
      method: "social",
      email: session.user.email ?? null,
      provider: (session as any).provider ?? null,
    });
  }

  return NextResponse.json({
    ok: false,
    authed: false,
    method: "guest",
    email: null,
    provider: null,
  });
}
