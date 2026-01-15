// app/api/logout/route.ts
import { NextResponse } from "next/server";
import { AUTH_COOKIE, cookieOptions } from "../../../lib/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });

  // delete custom auth cookie (match options used when setting it)
  res.cookies.set({
    name: AUTH_COOKIE,
    value: "",
    ...cookieOptions(),
    maxAge: 0,
  });

  return res;
}
