// app/api/local-login/route.ts
import { NextResponse } from "next/server";
import { checkUserPassword } from "../../../lib/user-store";
import { AUTH_COOKIE, cookieOptions } from "../../../lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");

  if (!email || !password) {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const ok = checkUserPassword(email, password);
  const res = NextResponse.json({ ok }, { status: 200 });

  if (ok) {
    res.cookies.set({
      name: AUTH_COOKIE,
      value: email,
      ...cookieOptions(),
      maxAge: 60 * 60 * 24 * 300, // 300 days
    });
  }

  return res;
}