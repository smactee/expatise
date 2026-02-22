// app/api/attempts/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function makeSupabase(req: NextRequest, pending: Array<{ name: string; value: string; options: any }>) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient(supabaseUrl, supabaseKey, {
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
});}

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
  const datasetId = (searchParams.get("datasetId") ?? "").trim();
  const status = (searchParams.get("status") ?? "submitted").trim(); // default submitted
  const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit") ?? "200")));

  let q = supabase
    .from("attempts")
    .select("payload, submitted_at_ms, last_active_at_ms, created_at_ms, attempt_id")
    .eq("user_id", user.id)
    .eq("status", status)
    .order("submitted_at_ms", { ascending: false })
    .limit(limit);

  if (datasetId) q = q.eq("dataset_id", datasetId);

  const { data, error } = await q;

  if (error) {
    const res = NextResponse.json({ ok: false, step: "select", error: error.message }, { status: 400 });
    for (const c of pending) res.cookies.set(c.name, c.value, c.options);
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  const attempts = (data ?? [])
    .map((r: any) => r.payload)
    .filter(Boolean);

  const res = NextResponse.json({ ok: true, attempts });
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
  const attempt = body?.attempt;

  if (!attempt?.attemptId || !attempt?.modeKey || !attempt?.status) {
    const res = NextResponse.json({ ok: false, error: "Missing required attempt fields" }, { status: 400 });
    for (const c of pending) res.cookies.set(c.name, c.value, c.options);
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  const row = {
    user_id: user.id,

    attempt_id: attempt.attemptId,
    user_key: attempt.userKey ?? "guest",
    schema_version: attempt.schemaVersion ?? 1,

    mode_key: attempt.modeKey,
    dataset_id: attempt.datasetId ?? null,
    dataset_version: attempt.datasetVersion ?? null,

    status: attempt.status,

    created_at_ms: attempt.createdAt ?? null,
    last_active_at_ms: attempt.lastActiveAt ?? null,
    submitted_at_ms: attempt.submittedAt ?? null,

    payload: attempt,
  };

  const { error: upsertErr } = await supabase
    .from("attempts")
    .upsert(row, { onConflict: "user_id,attempt_id" });

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
