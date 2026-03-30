import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const COACH_COOLDOWN_TABLE = "coach_cooldown";

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

function isLocalHost(url: string) {
  try {
    const { hostname } = new URL(url);
    return hostname === "127.0.0.1" || hostname === "localhost";
  } catch {
    return false;
  }
}

function isDevOnlyCoachResetEnabled() {
  if (isLocalHost(SUPABASE_URL)) return true;
  return (Deno.env.get("ENABLE_DEV_COACH_COOLDOWN_RESET") ?? "").trim() === "1";
}

function getProjectHost() {
  try {
    return new URL(SUPABASE_URL).host;
  } catch {
    return SUPABASE_URL;
  }
}

type CooldownRow = {
  user_id: string;
  last_ms: number | null;
};

async function readCoachCooldown(
  admin: ReturnType<typeof createClient>,
  userId: string
): Promise<{ row: CooldownRow | null; error: string | null }> {
  const { data, error } = await admin
    .from(COACH_COOLDOWN_TABLE)
    .select("user_id,last_ms")
    .eq("user_id", userId)
    .maybeSingle();

  return {
    row: (data as CooldownRow | null) ?? null,
    error: error?.message ?? null,
  };
}

type ResetStatsPayload = {
  scope?: "all" | "coach_cooldown";
};

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

    const body = (await req.json().catch(() => ({}))) as ResetStatsPayload;
    const scope = body?.scope === "coach_cooldown" ? "coach_cooldown" : "all";

    // 2) Admin client: performs destructive deletes
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (scope === "coach_cooldown") {
      if (!isDevOnlyCoachResetEnabled()) {
        return json(404, { ok: false, error: "not_found" });
      }

      const before = await readCoachCooldown(admin, user.id);
      if (before.error) {
        return json(500, {
          ok: false,
          error: `Failed to read Coach cooldown before reset: ${before.error}`,
          userId: user.id,
          projectHost: getProjectHost(),
          beforeLastMs: null,
        });
      }

      const { data: writeRow, error: resetError } = await admin
        .from(COACH_COOLDOWN_TABLE)
        .upsert({ user_id: user.id, last_ms: 0 }, { onConflict: "user_id" })
        .select("user_id,last_ms")
        .maybeSingle();

      if (resetError) {
        return json(500, {
          ok: false,
          error: `Failed to reset Coach cooldown: ${resetError.message}`,
          userId: user.id,
          projectHost: getProjectHost(),
          beforeLastMs: before.row?.last_ms ?? null,
        });
      }

      const after = await readCoachCooldown(admin, user.id);
      if (after.error) {
        return json(500, {
          ok: false,
          error: `Failed to read Coach cooldown after reset: ${after.error}`,
          userId: user.id,
          projectHost: getProjectHost(),
          beforeLastMs: before.row?.last_ms ?? null,
        });
      }

      return json(200, {
        ok: true,
        scope,
        userId: user.id,
        projectHost: getProjectHost(),
        beforeLastMs: before.row?.last_ms ?? null,
        afterLastMs: after.row?.last_ms ?? null,
        actionTaken: before.row ? "upsert_last_ms_zero" : "insert_last_ms_zero",
        rowsAffected: writeRow ? 1 : 0,
      });
    }

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
  } catch (err: unknown) {
    return json(500, {
      ok: false,
      error: err instanceof Error ? err.message : "Unexpected reset error.",
    });
  }
});
