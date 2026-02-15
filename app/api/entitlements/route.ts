// app/api/entitlements/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { normalizeEmail } from "@/lib/auth";
import { userKeyFromEmail } from "@/lib/identity/userKey";
import { FREE_ENTITLEMENTS } from "@/lib/entitlements/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_PREMIUM_EMAILS = (process.env.ADMIN_PREMIUM_EMAILS || "user@expatise.com")
  .trim()
  .split(",")
  .map((s) => normalizeEmail(s))
  .filter(Boolean);

function isAdminEmail(email: string) {
  return ADMIN_PREMIUM_EMAILS.includes(normalizeEmail(email));
}

function makeUserKey(user: any | null) {
  if (!user) return "guest";
  if (user.is_anonymous) return `anon:${user.id}`;

  const email = user.email ?? "";
  if (email) return userKeyFromEmail(email);

  // provider without email
  return `sb:${user.id}`;
}

export async function GET() {
  const cookieStore = await Promise.resolve(cookies());


  // collect any cookies Supabase wants to set, then apply them to the final JSON response
  const pending: Array<{ name: string; value: string; options: any }> = [];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        pending.push(...cookiesToSet);
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  const user = error ? null : data.user;

  const userKey = makeUserKey(user);

  // default: free
  let entitlements = FREE_ENTITLEMENTS;

  // admin override (email only)
  const email = normalizeEmail(user?.email ?? "");
  if (email && isAdminEmail(email)) {
    entitlements = { isPremium: true, source: "admin" as const, updatedAt: Date.now() };
  }

  const res = NextResponse.json({ ok: true, userKey, entitlements });
  res.headers.set("Cache-Control", "no-store");

  // apply any refreshed auth cookies (safe)
  for (const c of pending) res.cookies.set(c.name, c.value, c.options);

  return res;
}
