// supabase/functions/coach/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "jsr:@supabase/supabase-js@2/cors";
import { MASTER_PROMPT, FALLBACK_PROMPT } from "../_shared/coachPrompt.ts";

function json(status: number, body: unknown, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });
}

function normalizeProjectUrl(raw: string) {
  const withScheme = raw.startsWith("http") ? raw : `https://${raw}`;
  const u = new URL(withScheme);
  // strip any path like /functions/v1/...
  return `${u.protocol}//${u.host}`;
}

const RAW_SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
if (!RAW_SUPABASE_URL) throw new Error("Missing SUPABASE_URL");

const SUPABASE_URL = normalizeProjectUrl(RAW_SUPABASE_URL);

const SUPABASE_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ??
  Deno.env.get("SB_PUBLISHABLE_KEY") ??
  "";

if (!SUPABASE_KEY) {
  throw new Error("Missing SUPABASE_ANON_KEY / SB_PUBLISHABLE_KEY in function env");
}

function getJwtFromReq(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return (m?.[1] ?? "").trim();
}

async function requireUser(req: Request) {
  const jwt = getJwtFromReq(req);

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
    },
  });

  if (!jwt) return { user: null, supabase, reason: "Missing Authorization Bearer token" };

  const { data, error } = await supabase.auth.getUser(jwt);
  const user = data?.user ?? null;

  if (error || !user) return { user: null, supabase, reason: error?.message ?? "No user" };
  return { user, supabase, reason: null };
}
// Keep same contract you had
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

// DB table used for cooldown (we'll create it below)
const COOLDOWN_TABLE = "coach_cooldown";

type CoachPayload = {
  coachContractVersion: string;
  skillWindowLabel: "30d" | "all";
  habitWindowLabel: "7d";
  skill: {
    attemptsCount: number;
    attemptedTotal: number;
    scorePoints: Array<{ t: number; scorePct: number; answered: number; totalQ: number }>;
  };
};

function num(n: any, d = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : d;
}

function extractText(openaiJson: any): string {
  const t = typeof openaiJson?.output_text === "string" ? openaiJson.output_text.trim() : "";
  if (t) return t;

  const out = Array.isArray(openaiJson?.output) ? openaiJson.output : [];
  const chunks: string[] = [];

  for (const item of out) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const c of content) {
      if (typeof c?.text === "string") chunks.push(c.text);
      if (typeof c?.refusal === "string") chunks.push(c.refusal);
    }
  }
  return chunks.join("").trim();
}

Deno.serve(async (req: Request) => {
  try {
   // CORS preflight (required for browser invoke)
if (req.method === "OPTIONS") {
  return new Response("ok", { headers: corsHeaders });
}

// Only POST
if (req.method !== "POST") {
  return json(405, { ok: false, error: "method_not_allowed" });
}

const { user, supabase, reason } = await requireUser(req);
if (!user) {
  return json(401, { ok: false, error: "unauthorized", detail: reason });
}
    const now = Date.now();

    // ---- 1) Cooldown check (DB-based)
    const { data: cdRow, error: cdErr } = await supabase
      .from(COOLDOWN_TABLE)
      .select("last_ms")
      .eq("user_id", user.id)
      .maybeSingle();

    if (cdErr) {
      return new Response(JSON.stringify({ ok: false, error: "cooldown_read_failed", detail: cdErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const last = Number(cdRow?.last_ms ?? 0);
    if (Number.isFinite(last) && last > 0 && now - last < COOLDOWN_MS) {
      const nextAllowedAt = last + COOLDOWN_MS;
      return new Response(
        JSON.stringify({
          ok: false,
          error: "cooldown",
          nextAllowedAt,
          retryAfterSec: Math.ceil((nextAllowedAt - now) / 1000),
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- 2) Parse payload
    const body = (await req.json().catch(() => null)) as CoachPayload | null;
    if (!body || typeof body !== "object") {
      return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- 3) Minimum data gate
    const attemptsCount = num(body?.skill?.attemptsCount);
    const attemptedTotal = num(body?.skill?.attemptedTotal);
    const maxAnswered = Math.max(0, ...(body?.skill?.scorePoints ?? []).map((p) => num(p.answered)));
    const meetsMinimum = (attemptsCount >= 1 && maxAnswered >= 80) || attemptedTotal >= 120;

    if (!meetsMinimum) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "insufficient_data",
          required: "Submit 1 Real Test with ≥80 answered OR reach 120 questions answered total.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- 4) Call OpenAI
    const openaiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
    if (!openaiKey) {
      return new Response(JSON.stringify({ ok: false, error: "missing_openai_key" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const inputJson = JSON.stringify(body);

    const openaiRes = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        reasoning: { effort: "minimal" },
        text: { verbosity: "low" },
        instructions: MASTER_PROMPT || FALLBACK_PROMPT,
        input:
          `Task: Generate a Stats Coach report for the user.\n` +
          `Rules: <=250 words. Use ONLY the JSON.\n\nJSON:\n${inputJson}`,
        max_output_tokens: 900,
      }),
    });

    const openaiJson = await openaiRes.json().catch(() => null);

    if (!openaiRes.ok || !openaiJson) {
      return new Response(JSON.stringify({ ok: false, error: "openai_failed", detail: openaiJson ?? null }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const report = extractText(openaiJson);
    if (!report) {
      return new Response(JSON.stringify({ ok: false, error: "empty_output" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- 5) Write cooldown only after success
    const { error: cdWriteErr } = await supabase
      .from(COOLDOWN_TABLE)
      .upsert({ user_id: user.id, last_ms: now }, { onConflict: "user_id" });

    if (cdWriteErr) {
      return new Response(JSON.stringify({ ok: false, error: "cooldown_write_failed", detail: cdWriteErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, report, createdAt: now }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return json(500, {
      ok: false,
      error: "Stats Coach API failed",
      detail: String(err?.message ?? err),
    });
  }
});