// app/api/session/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { AUTH_COOKIE } from "@/lib/auth";

function detectProvider(user: any): string | null {
  if (!user) return null;
  if (user.is_anonymous) return "anonymous";

  const am = user.app_metadata ?? {};
  if (typeof am.provider === "string" && am.provider) return am.provider;
  if (Array.isArray(am.providers) && am.providers.length) return am.providers[0];

  const ident = user.identities?.[0]?.provider;
  return ident ?? null;
}


export async function GET() {
  const cookieStore = await Promise.resolve(cookies());

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const pending: Array<{ name: string; value: string; options: any }> = [];

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        pending.push(...cookiesToSet);
      },
    },
  });

  const localEmail = cookieStore.get(AUTH_COOKIE)?.value ?? null;
  if (localEmail) {
    const res = NextResponse.json({
      ok: true,
      authed: true,
      method: "email",
      email: localEmail,
      provider: "local",
    });
    res.headers.set("Cache-Control", "no-store");
    pending.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
    return res;
  }

  const { data, error } = await supabase.auth.getUser();
  const user = error ? null : data.user;

  // ✅ anonymous/no-user => SessionNo exactly (provider MUST be null)
  if (!user || detectProvider(user) === "anonymous") {
    const res = NextResponse.json({
      ok: false,
      authed: false,
      method: "guest",
      email: null,
      provider: null, // ✅ changed
    });
    res.headers.set("Cache-Control", "no-store");
    pending.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
    return res;
  }

  const provider = detectProvider(user);
  const isEmail = provider === "email" || (!!user.email && !provider);

  const res = NextResponse.json({
    ok: true,
    authed: true,
    method: isEmail ? "email" : "social",
    email: user.email ?? null,
    provider: isEmail ? "email" : provider,
  });

  res.headers.set("Cache-Control", "no-store");
  pending.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
  return res;
}
