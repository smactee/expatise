// app/api/logout/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { AUTH_COOKIE, cookieOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const cookieStore = await Promise.resolve(cookies());
  const pending: Array<{ name: string; value: string; options: any }> = [];

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createServerClient(url, anon, {
    auth: { flowType: "pkce", storageKey: "sb-expatise-auth" },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        pending.push(...cookiesToSet);
      },
    },
  });

  // ✅ server-side Supabase sign out (clears auth cookies)
  try {
    await supabase.auth.signOut();
  } catch {
    // ignore
  }

  const res = NextResponse.json({ ok: true });
  res.headers.set("Cache-Control", "no-store");

  // apply any cookie changes Supabase produced
  for (const c of pending) res.cookies.set(c.name, c.value, c.options);

  // ✅ also clear your legacy cookie (safe even if unused now)
  res.cookies.set({
    name: AUTH_COOKIE,
    value: "",
    ...cookieOptions(),
    maxAge: 0,
  });

  return res;
}