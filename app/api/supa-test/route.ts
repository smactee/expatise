import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const sbCookies = req.cookies
    .getAll()
    .filter((c) => c.name.startsWith("sb-"))
    .map((c) => c.name);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll() {
          // no-op for this test endpoint
        },
      },
    }
  );

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "No user session", sbCookies, userErr: userErr?.message ?? null },
      { status: 401 }
    );
  }

  const { error: insErr } = await supabase.from("content").insert({
    user_id: user.id,
    kind: "ping",
    payload: { at: Date.now() },
  });

  if (insErr) {
    return NextResponse.json(
      { ok: false, step: "insert", error: insErr.message, sbCookies },
      { status: 400 }
    );
  }

  const { data: rows, error: selErr } = await supabase
    .from("content")
    .select("id, created_at, payload")
    .eq("user_id", user.id)
    .eq("kind", "ping")
    .order("created_at", { ascending: false })
    .limit(3);

  if (selErr) {
    return NextResponse.json(
      { ok: false, step: "select", error: selErr.message, sbCookies },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, user_id: user.id, sbCookies, rows });
}
