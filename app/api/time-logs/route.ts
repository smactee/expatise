// app/api/time-logs/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function makeSupabase(
  req: NextRequest,
  pending: Array<{ name: string; value: string; options: any }>
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient(supabaseUrl, supabaseKey, {
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

function isYmd(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function GET(req: NextRequest) {
  const pending: Array<{ name: string; value: string; options: any }> = [];
  const supabase = makeSupabase(req, pending);

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  const user = userErr ? null : userData.user;

  if (!user) {
    const res = NextResponse.json({ ok: false, error: "No user session" }, { status: 401 });
    for (const c of pending) res.cookies.set(c.name, c.value, c.options);
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(400, Math.max(1, Number(searchParams.get("limit") ?? "200")));

  const { data, error } = await supabase
    .from("time_logs")
    .select("date, kind, seconds")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .limit(limit);

  if (error) {
    const res = NextResponse.json({ ok: false, step: "select", error: error.message }, { status: 400 });
    for (const c of pending) res.cookies.set(c.name, c.value, c.options);
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  const res = NextResponse.json({ ok: true, logs: data ?? [] });
  for (const c of pending) res.cookies.set(c.name, c.value, c.options);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function POST(req: NextRequest) {
  const pending: Array<{ name: string; value: string; options: any }> = [];
  const supabase = makeSupabase(req, pending);

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  const user = userErr ? null : userData.user;

  if (!user) {
    const res = NextResponse.json({ ok: false, error: "No user session" }, { status: 401 });
    for (const c of pending) res.cookies.set(c.name, c.value, c.options);
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  const body = (await req.json().catch(() => null)) as any;
  const kind = String(body?.kind ?? "").trim();
  const date = String(body?.date ?? "").trim();
  const seconds = Number(body?.seconds ?? NaN);

  if ((kind !== "test" && kind !== "study") || !isYmd(date) || !Number.isFinite(seconds) || seconds < 0) {
    const res = NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    for (const c of pending) res.cookies.set(c.name, c.value, c.options);
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  const row = {
    user_id: user.id,
    date,          // date column
    kind,          // "test" | "study"
    seconds: Math.floor(seconds),
    updated_at: new Date().toISOString(),
  };

  const { error: upsertErr } = await supabase
    .from("time_logs")
    .upsert(row, { onConflict: "user_id,date,kind" });

  if (upsertErr) {
    const res = NextResponse.json({ ok: false, step: "upsert", error: upsertErr.message }, { status: 400 });
    for (const c of pending) res.cookies.set(c.name, c.value, c.options);
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  const res = NextResponse.json({ ok: true });
  for (const c of pending) res.cookies.set(c.name, c.value, c.options);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
