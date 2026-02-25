// supabase/functions/account-delete/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "jsr:@supabase/supabase-js@2/cors";

export const runtime = "edge";

Deno.serve(async (req: Request) => {
  // CORS
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // 1) User-context client (RLS/user identity)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization") ?? "" },
        },
      }
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const user = userErr ? null : userData.user;

    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: "No user session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Service role client (server-only) to delete rows + auth user
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!serviceKey) {
      return new Response(JSON.stringify({ ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 3) Delete app data (add more tables here if needed)
    const [a, t, c] = await Promise.all([
      admin.from("attempts").delete().eq("user_id", user.id),
      admin.from("time_logs").delete().eq("user_id", user.id),
      admin.from("coach_cooldown").delete().eq("user_id", user.id), // if you created this table
    ]);

    const delDataErr = a.error ?? t.error ?? c.error;
    if (delDataErr) {
      return new Response(
        JSON.stringify({ ok: false, error: "Failed to delete user data", detail: delDataErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4) Delete Auth user (requires service_role)
    const { error: delUserErr } = await admin.auth.admin.deleteUser(user.id);
    if (delUserErr) {
      return new Response(
        JSON.stringify({ ok: false, error: "Failed to delete auth user", detail: delUserErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: "delete_failed", detail: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});