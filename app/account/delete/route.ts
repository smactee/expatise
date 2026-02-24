//app/account/delete/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function makeSupabaseUserClient(
  req: NextRequest,
  pending: Array<{ name: string; value: string; options: any }>
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createServerClient(url, anon, {
    auth: {
      flowType: "pkce",
      storageKey: "sb-expatise-auth",
    },
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        pending.push(...cookiesToSet);
      },
    },
  });
}

export async function POST(req: NextRequest) {
  const pending: Array<{ name: string; value: string; options: any }> = [];
  const supabase = makeSupabaseUserClient(req, pending);

  // 1) Identify the currently signed-in user (via cookies)
  const { data, error } = await supabase.auth.getUser();
  const user = error ? null : data.user;

  if (!user) {
    const res = NextResponse.json({ ok: false, error: "No user session" }, { status: 401 });
    pending.forEach((c) => res.cookies.set(c.name, c.value, c.options));
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  // 2) Service role client (server-only) to delete DB rows + Auth user
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    const res = NextResponse.json(
      { ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY on server" },
      { status: 500 }
    );
    pending.forEach((c) => res.cookies.set(c.name, c.value, c.options));
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const admin = createAdminClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 3) Delete app data first (add more tables here if you store more user data)
  const [a, t] = await Promise.all([
    admin.from("attempts").delete().eq("user_id", user.id),
    admin.from("time_logs").delete().eq("user_id", user.id),
  ]);

  if (a.error || t.error) {
    const res = NextResponse.json(
      { ok: false, error: "Failed to delete user data", detail: a.error?.message ?? t.error?.message },
      { status: 500 }
    );
    pending.forEach((c) => res.cookies.set(c.name, c.value, c.options));
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  // 4) Delete the Auth account (this removes the user identity)
  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) {
    const res = NextResponse.json(
      { ok: false, error: "Failed to delete auth user", detail: delErr.message },
      { status: 500 }
    );
    pending.forEach((c) => res.cookies.set(c.name, c.value, c.options));
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  const res = NextResponse.json({ ok: true });
  pending.forEach((c) => res.cookies.set(c.name, c.value, c.options));
  res.headers.set("Cache-Control", "no-store");
  return res;
}