// supabase/functions/account-delete/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "jsr:@supabase/supabase-js@2/cors";

export const runtime = "edge";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isMissingRelationError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  if (error.code === "42P01") return true;
  return /relation .* does not exist/i.test(String(error.message ?? ""));
}

Deno.serve(async (req: Request) => {
  // CORS
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return json(405, { ok: false, error: "method_not_allowed" });
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
      return json(401, { ok: false, error: "No user session" });
    }

    // 2) Service role client (server-only) to delete rows + auth user
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!serviceKey) {
      return json(500, { ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" });
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

    const cooldownErr = isMissingRelationError(c.error) ? null : c.error;
    const delDataErr = a.error ?? t.error ?? cooldownErr;
    if (delDataErr) {
      return json(500, {
        ok: false,
        error: "Failed to delete user data",
        detail: delDataErr.message,
      });
    }

    // 4) Delete Auth user (requires service_role)
    const { error: delUserErr } = await admin.auth.admin.deleteUser(user.id);
    if (delUserErr) {
      return json(500, {
        ok: false,
        error: "Failed to delete auth user",
        detail: delUserErr.message,
      });
    }

    return json(200, { ok: true });
  } catch (e: any) {
    return json(500, {
      ok: false,
      error: "delete_failed",
      detail: String(e?.message ?? e),
    });
  }
});
