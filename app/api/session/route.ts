// app/api/session/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE } from "../../../lib/auth";
import { auth } from "../../auth";

export async function GET() {
  const cookieStore = await cookies();

  // Local/email login (your custom auth cookie)
  const localEmail = cookieStore.get(AUTH_COOKIE)?.value ?? null;
  if (localEmail) {
    return NextResponse.json({
      authed: true,
      method: "email",
      email: localEmail,      // optional: only if you store it somewhere
      provider: "local",
    });
  }

  // NextAuth social login
  const session = await auth();
  if (session?.user) {
    return NextResponse.json({
      authed: true,
      method: "social",
      email: session.user.email ?? null,
      provider: (session as any).provider ?? null, // "google" | "apple" | "wechat"
    });
  }

  return NextResponse.json({
    authed: false,
    method: "guest",
    email: null,
    provider: null,
  });
}
