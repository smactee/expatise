// app/api/local-login/route.ts

import { NextResponse } from "next/server";
import { checkUserPassword } from "../../../lib/user-store"; // if you don't use @, switch to relative
import { AUTH_COOKIE, normalizeEmail } from "../../../lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");

  // Always keep response generic (no account enumeration)
  if (!email || !password) {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const ok = checkUserPassword(email, password);
  const res = NextResponse.json({ ok }, { status: 200 });
  if (ok) {
    // DEV session cookie (replace with real session management later)
    res.cookies.set(AUTH_COOKIE, email, {
      name: AUTH_COOKIE,
      value: email,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 300, // 300 days
    });
  }


  return res;
}
