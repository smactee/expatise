// lib/supabase/callSupabaseFunction.ts
import { createClient } from "@/lib/supabase/client";

/**
 * Stage at which a Supabase Edge Function call failed before the network
 * request was made. Each caller maps these stages to its own UI behavior
 * (window.alert vs setCoachError, different i18n keys, etc.), so the helper
 * surfaces the stage instead of deciding how to present it.
 */
export type CallSupabaseFunctionErrorStage =
  | "session_read" // supabase.auth.getSession() returned an error
  | "session_refresh" // supabase.auth.refreshSession() returned an error
  | "no_token" // no access token after getSession + refreshSession
  | "missing_env"; // NEXT_PUBLIC_SUPABASE_URL / anon key missing

export class CallSupabaseFunctionError extends Error {
  readonly stage: CallSupabaseFunctionErrorStage;
  /**
   * Underlying Supabase auth error message, present only for the
   * "session_read" and "session_refresh" stages. Matches the value the
   * original inline code read off `sessionErr.message` / `refreshErr.message`.
   */
  readonly authMessage?: string;

  constructor(stage: CallSupabaseFunctionErrorStage, authMessage?: string) {
    super(stage);
    this.name = "CallSupabaseFunctionError";
    this.stage = stage;
    this.authMessage = authMessage;
  }
}

/**
 * Encapsulates the session/token/env/url/headers/fetch boilerplate shared by
 * the three Supabase Edge Function call sites in stats/page.tsx.
 *
 * Behavior is byte-identical to the original inline code:
 *   1. getSession(); on error -> throw (stage "session_read").
 *   2. token = session.access_token ?? null.
 *   3. if no token -> refreshSession(); on error -> throw (stage "session_refresh");
 *      token = refreshed.access_token ?? null.
 *   4. if still no token -> throw (stage "no_token").
 *   5. read NEXT_PUBLIC supabase url + (publishable ?? anon) key, trimmed.
 *   6. if either missing -> throw (stage "missing_env").
 *   7. fetch `${url}/functions/v1/${name}` (POST, Authorization Bearer + apikey +
 *      Content-Type json, body JSON.stringify(body)) and return the raw Response.
 *
 * The caller handles the returned Response exactly as before.
 */
export async function callSupabaseFunction(
  name: string,
  body?: unknown
): Promise<Response> {
  const supabase = createClient();

  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr) {
    throw new CallSupabaseFunctionError("session_read", sessionErr.message);
  }

  let token = sessionData.session?.access_token ?? null;
  if (!token) {
    const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
    if (refreshErr) {
      throw new CallSupabaseFunctionError("session_refresh", refreshErr.message);
    }
    token = refreshed.session?.access_token ?? null;
  }

  if (!token) {
    throw new CallSupabaseFunctionError("no_token");
  }

  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const anonKey = String(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ""
  ).trim();

  if (!supabaseUrl || !anonKey) {
    throw new CallSupabaseFunctionError("missing_env");
  }

  return fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
