import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return json(200, { ok: true });
  }

  try {
    const authHeader =
      req.headers.get("authorization") ??
      req.headers.get("Authorization");

    if (!authHeader) {
      return json(401, { ok: false, error: "Missing authorization header." });
    }

    // 1) User-scoped client: verifies whoever called the function
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return json(401, {
        ok: false,
        error: userError?.message ?? "Invalid session.",
      });
    }

    // 2) Admin client: performs destructive deletes
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { error: attemptsError } = await admin
      .from("attempts")
      .delete()
      .eq("user_id", user.id);

    if (attemptsError) {
      return json(500, {
        ok: false,
        error: `Failed to delete attempts: ${attemptsError.message}`,
      });
    }

    const { error: timeLogsError } = await admin
      .from("time_logs")
      .delete()
      .eq("user_id", user.id);

    if (timeLogsError) {
      return json(500, {
        ok: false,
        error: `Failed to delete time logs: ${timeLogsError.message}`,
      });
    }

    return json(200, { ok: true });
  } catch (err: any) {
    return json(500, {
      ok: false,
      error: err?.message ?? "Unexpected reset error.",
    });
  }
});