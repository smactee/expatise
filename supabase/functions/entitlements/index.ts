// supabase/functions/entitlements/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "jsr:@supabase/supabase-js@2/cors";

function normalizeEmail(s: unknown) {
  return String(s ?? "").trim().toLowerCase();
}

export type Entitlements = {
  isPremium: boolean;
  source: "free" | "admin";
  updatedAt: number;
  expiresAt?: number;
};

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({ ok: false, error: "missing_supabase_env" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auth context from caller (so RLS + getUser works)
    const authHeader = req.headers.get("Authorization") ?? "";

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const user = userErr ? null : userData.user;

    const userKey = !user
      ? "guest"
      : user.is_anonymous
        ? `anon:${user.id}`
        : user.email
          ? normalizeEmail(user.email)
          : `sb:${user.id}`;

    const adminEmails = (Deno.env.get("ADMIN_PREMIUM_EMAILS") ?? "user@expatise.com")
      .split(",")
      .map(normalizeEmail)
      .filter(Boolean);

    const email = normalizeEmail(user?.email ?? "");
    const isAdmin = !!(email && adminEmails.includes(email));

    const entitlements: Entitlements = isAdmin
      ? { isPremium: true, source: "admin", updatedAt: Date.now() }
      : { isPremium: false, source: "free", updatedAt: Date.now() };

    return new Response(JSON.stringify({ ok: true, userKey, entitlements }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: "entitlements_failed", detail: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }}
    );
  }
});