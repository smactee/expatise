// app/auth/callback/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { safeNextPath } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
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

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const nextRaw = searchParams.get("next");
  const next = safeNextPath(nextRaw, "/");

  // ✅ This is the missing piece when you end up as "guest"
  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  const res = NextResponse.redirect(new URL(next, req.url));
  res.headers.set("Cache-Control", "no-store");

  // ✅ Apply any cookies Supabase produced (session cookies)
  for (const c of pending) res.cookies.set(c.name, c.value, c.options);

  return res;
}