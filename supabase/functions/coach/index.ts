// supabase/functions/coach/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "jsr:@supabase/supabase-js@2/cors";
import {
  buildCoachFallbackInstructions,
  buildCoachInstructions,
} from "../_shared/coachPrompt.ts";
import {
  getCoachLocaleConfig,
  getCoachWindowLabels,
  resolveCoachLocale,
} from "../../../lib/coach/locale.ts";
import {
  COACH_REPORT_CACHE_VERSION,
  parseCoachReportDataFromText,
  type CoachReportData,
} from "../../../lib/coach/report.ts";

function json(status: number, body: unknown, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });
}

function normalizeProjectUrl(raw: string) {
  const withScheme = raw.startsWith("http") ? raw : `https://${raw}`;
  const u = new URL(withScheme);
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

const COOLDOWN_MS = 24 * 60 * 60 * 1000;
const COOLDOWN_TABLE = "coach_cooldown";

function isLocalHost(url: string) {
  try {
    const { hostname } = new URL(url);
    return hostname === "127.0.0.1" || hostname === "localhost";
  } catch {
    return false;
  }
}

function isDevCooldownDiagnosticsEnabled() {
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

type CoachPayload = {
  coachContractVersion: string;
  locale?: string;
  uiLanguageLabel?: string;
  skillWindowLabel: "30d" | "all";
  habitWindowLabel: "7d";
  skill: {
    attemptsCount: number;
    attemptedTotal: number;
    scorePoints: Array<{ t: number; scorePct: number; answered: number; totalQ: number }>;
  };
  habits?: {
    timeThisWeekMin?: number;
    timeBestDayMin?: number;
    timeStreakDays?: number;
    activeDays?: number;
    requiredDays?: number;
  };
};

function num(n: unknown, d = 0) {
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

type CoachRequestResult =
  | {
      ok: true;
      reportData: CoachReportData;
    }
  | {
      ok: false;
      error: string;
      detail?: unknown;
    };

async function requestCoachReport(
  openaiKey: string,
  instructions: string,
  inputJson: string,
  outputLanguage: string
): Promise<CoachRequestResult> {
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
      instructions,
      input:
        `Task: Generate a Stats Coach report for the user in ${outputLanguage}.\n` +
        `Rules: Output strict JSON only. No markdown. No headings.\n\nJSON:\n${inputJson}`,
      max_output_tokens: 900,
    }),
  });

  const openaiJson = await openaiRes.json().catch(() => null);

  if (!openaiRes.ok || !openaiJson) {
    return {
      ok: false,
      error: "openai_failed",
      detail: openaiJson ?? null,
    };
  }

  const reportText = extractText(openaiJson);
  if (!reportText) {
    return { ok: false, error: "empty_output" };
  }

  const reportData = parseCoachReportDataFromText(reportText);
  if (!reportData) {
    return {
      ok: false,
      error: "invalid_output",
      detail: reportText,
    };
  }

  return { ok: true, reportData };
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return json(405, { ok: false, error: "method_not_allowed" });
    }

    const { user, supabase, reason } = await requireUser(req);
    if (!user) {
      return json(401, { ok: false, error: "unauthorized", detail: reason });
    }

    const now = Date.now();

    const { data: cdRow, error: cdErr } = await supabase
      .from(COOLDOWN_TABLE)
      .select("last_ms")
      .eq("user_id", user.id)
      .maybeSingle();

    if (cdErr) {
      return json(500, { ok: false, error: "cooldown_read_failed", detail: cdErr.message });
    }

    const last = Number(cdRow?.last_ms ?? 0);
    if (Number.isFinite(last) && last > 0 && now - last < COOLDOWN_MS) {
      const nextAllowedAt = last + COOLDOWN_MS;
      const debug =
        isDevCooldownDiagnosticsEnabled()
          ? {
              userId: user.id,
              projectHost: getProjectHost(),
              last_ms: last,
              now,
              nextAllowedAt,
            }
          : null;

      if (debug) {
        console.log("[coach-cooldown-429]", JSON.stringify(debug));
      }

      return json(429, {
        ok: false,
        error: "cooldown",
        nextAllowedAt,
        retryAfterSec: Math.ceil((nextAllowedAt - now) / 1000),
        ...(debug ? { debug } : {}),
      });
    }

    const body = (await req.json().catch(() => null)) as CoachPayload | null;
    if (!body || typeof body !== "object") {
      return json(400, { ok: false, error: "Invalid JSON" });
    }

    const coachLocale = resolveCoachLocale(body.locale);
    const localeConfig = getCoachLocaleConfig(coachLocale);
    const windowLabels = getCoachWindowLabels(
      coachLocale,
      body.skillWindowLabel,
      body.habitWindowLabel
    );

    const attemptsCount = num(body?.skill?.attemptsCount);
    const attemptedTotal = num(body?.skill?.attemptedTotal);
    const maxAnswered = Math.max(0, ...(body?.skill?.scorePoints ?? []).map((p) => num(p.answered)));
    const meetsMinimum = (attemptsCount >= 1 && maxAnswered >= 80) || attemptedTotal >= 120;

    if (!meetsMinimum) {
      return json(400, {
        ok: false,
        error: "insufficient_data",
        required: "Submit 1 Real Test with ≥80 answered OR reach 120 questions answered total.",
      });
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
    if (!openaiKey) {
      return json(500, { ok: false, error: "missing_openai_key" });
    }

    const inputJson = JSON.stringify({
      ...body,
      locale: coachLocale,
      uiLanguageLabel: localeConfig.label,
      skillWindowLabel: windowLabels.skill,
      habitWindowLabel: windowLabels.habit,
    });

    let coachResult = await requestCoachReport(
      openaiKey,
      buildCoachInstructions(coachLocale, windowLabels),
      inputJson,
      localeConfig.outputLanguage
    );

    if (!coachResult.ok && coachResult.error === "invalid_output") {
      coachResult = await requestCoachReport(
        openaiKey,
        buildCoachFallbackInstructions(coachLocale, windowLabels),
        inputJson,
        localeConfig.outputLanguage
      );
    }

    if (!coachResult.ok) {
      return json(502, {
        ok: false,
        error: coachResult.error,
        detail: coachResult.detail ?? null,
      });
    }

    const { error: cdWriteErr } = await supabase
      .from(COOLDOWN_TABLE)
      .upsert({ user_id: user.id, last_ms: now }, { onConflict: "user_id" });

    if (cdWriteErr) {
      return json(500, {
        ok: false,
        error: "cooldown_write_failed",
        detail: cdWriteErr.message,
      });
    }

    return json(200, {
      ok: true,
      reportData: coachResult.reportData,
      createdAt: now,
      reportLocale: coachLocale,
      version: COACH_REPORT_CACHE_VERSION,
    });
  } catch (err: any) {
    return json(500, {
      ok: false,
      error: "server_error",
      detail: String(err?.message ?? err),
    });
  }
});
