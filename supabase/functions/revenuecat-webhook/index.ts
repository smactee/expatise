import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "jsr:@supabase/supabase-js@2/cors";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

type EntitlementSource =
  | "none"
  | "trial"
  | "subscription"
  | "lifetime"
  | "admin"
  | "dev"
  | "demo";

type RevenueCatEvent = {
  id?: string;
  event_id?: string;
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  entitlement_id?: string;
  entitlement_ids?: string[];
  expiration_at_ms?: number | string | null;
  expires_date_ms?: number | string | null;
  expiration_at?: string | null;
  period_type?: string | null;
  event_timestamp_ms?: number | string | null;
  purchased_at_ms?: number | string | null;
  [k: string]: unknown;
};

const CORS = {
  ...corsHeaders,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RC_WEBHOOK_AUTH = Deno.env.get("REVENUECAT_WEBHOOK_AUTH") ?? "";
const RC_ENTITLEMENT_ID = (Deno.env.get("REVENUECAT_ENTITLEMENT_ID") ?? "Premium").trim();

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

function normalizeStr(v: unknown): string {
  return String(v ?? "").trim();
}

function normalizeLower(v: unknown): string {
  return normalizeStr(v).toLowerCase();
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function parseMs(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n < 1_000_000_000_000 ? Math.trunc(n * 1000) : Math.trunc(n);
}

function pickEvent(body: unknown): RevenueCatEvent | null {
  if (!body || typeof body !== "object") return null;
  const obj = body as Record<string, unknown>;
  const event = obj.event;
  if (event && typeof event === "object") return event as RevenueCatEvent;
  return obj as RevenueCatEvent;
}

function getEventId(e: RevenueCatEvent): string {
  const explicit = normalizeStr(e.id || e.event_id);
  if (explicit) return explicit;
  const t = normalizeStr(e.type).toUpperCase() || "UNKNOWN";
  const u = normalizeStr(e.app_user_id) || normalizeStr(e.original_app_user_id) || "unknown";
  const ts = parseMs(e.event_timestamp_ms) ?? parseMs(e.purchased_at_ms) ?? Date.now();
  return `${t}:${u}:${ts}`;
}

function entitlementMatches(e: RevenueCatEvent, targetEntitlementId: string): boolean {
  if (!targetEntitlementId) return true;

  const target = normalizeLower(targetEntitlementId);
  const single = normalizeLower(e.entitlement_id);
  if (single && single === target) return true;

  const list = Array.isArray(e.entitlement_ids) ? e.entitlement_ids : [];
  return list.some((x) => normalizeLower(x) === target);
}

function extractExpiresAtMs(e: RevenueCatEvent): number | null {
  const msFromMs = parseMs(e.expiration_at_ms ?? e.expires_date_ms);
  if (msFromMs) return msFromMs;

  const iso = normalizeStr(e.expiration_at);
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

function computePremium(e: RevenueCatEvent, nowMs: number): {
  isPremium: boolean;
  source: EntitlementSource;
  expiresAtMs: number | null;
} {
  const eventType = normalizeStr(e.type).toUpperCase();
  const expiresAtMs = extractExpiresAtMs(e);
  const periodType = normalizeStr(e.period_type).toUpperCase();

  const forceInactive = new Set(["EXPIRATION", "REFUND", "SUBSCRIPTION_PAUSED"]);
  if (forceInactive.has(eventType)) {
    return { isPremium: false, source: "none", expiresAtMs };
  }

  const notExpired = !expiresAtMs || expiresAtMs > nowMs;
  if (!notExpired) {
    return { isPremium: false, source: "none", expiresAtMs };
  }

  const source: EntitlementSource =
    expiresAtMs == null ? "lifetime" : periodType === "TRIAL" ? "trial" : "subscription";
  return { isPremium: true, source, expiresAtMs };
}

async function resolveUserId(
  admin: SupabaseClient<any>,
  appUserCandidates: string[]
): Promise<string | null> {
  for (const raw of appUserCandidates) {
    const appUser = normalizeStr(raw);
    if (!appUser) continue;

    const prefixed = appUser.startsWith("sb:") ? appUser.slice(3) : appUser;
    if (isUuid(prefixed)) return prefixed;

    if (isEmail(appUser)) {
      const { data, error } = await (admin as any).rpc("find_auth_user_id_by_email", {
  p_email: appUser.toLowerCase(),
});
      if (!error && typeof data === "string" && isUuid(data)) {
        return data;
      }
    }
  }

  return null;
}

function matchesWebhookAuthHeader(headers: Headers, expected: string): boolean {
  const expectedTrim = normalizeStr(expected);
  if (!expectedTrim) return true;

  const auth = normalizeStr(headers.get("authorization") ?? headers.get("Authorization"));
  if (!auth) return false;

  if (auth === expectedTrim) return true;
  if (auth === `Bearer ${expectedTrim}`) return true;
  return false;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });

  try {
    if (!matchesWebhookAuthHeader(req.headers, RC_WEBHOOK_AUTH)) {
      return json(401, { ok: false, error: "unauthorized" });
    }

    const body = await req.json().catch(() => null);
const event = pickEvent(body);
if (!event) return json(400, { ok: false, error: "invalid_payload" });

const eventType = normalizeStr(event.type).toUpperCase();

// ✅ RevenueCat “TEST” events don’t include entitlements.
// Treat as a delivery check only (no DB writes).
if (eventType === "TEST") {
  return json(200, { ok: true, test: true, received: true });
}

if (!entitlementMatches(event, RC_ENTITLEMENT_ID)) {
  return json(200, { ok: true, ignored: true, reason: "different_entitlement" });
}

    const appUserId = normalizeStr(event.app_user_id || event.original_app_user_id);
    const aliases = Array.isArray(event.aliases) ? event.aliases : [];
    const userCandidates = [appUserId, normalizeStr(event.original_app_user_id), ...aliases];

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const userId = await resolveUserId(admin, userCandidates);
    if (!userId) {
      return json(422, {
        ok: false,
        error: "unresolved_user",
        appUserId,
      });
    }

    const eventId = getEventId(event);
    const eventTypeSafe = eventType || "UNKNOWN";
    const insertedAtIso = new Date().toISOString();

    const { error: insertEventErr } = await admin.from("revenuecat_webhook_events").insert({
      event_id: eventId,
      app_user_id: appUserId || normalizeStr(event.original_app_user_id),
      user_id: userId,
      event_type: eventTypeSafe,
      processed_at: insertedAtIso,
      payload: body,
    });

    if (insertEventErr) {
      // Postgres unique violation: already processed
      if ((insertEventErr as { code?: string }).code === "23505") {
        return json(200, { ok: true, duplicate: true, eventId });
      }
      return json(500, {
        ok: false,
        error: "event_insert_failed",
        detail: insertEventErr.message,
      });
    }

    const nowMs = Date.now();
    const premium = computePremium(event, nowMs);
    const expiresAtIso = premium.expiresAtMs ? new Date(premium.expiresAtMs).toISOString() : null;

    const { error: upsertErr } = await admin.from("premium_entitlements").upsert(
      {
        user_id: userId,
        is_premium: premium.isPremium,
        source: premium.source,
        expires_at: premium.isPremium ? expiresAtIso : null,
        updated_at: insertedAtIso,
        rc_app_user_id: appUserId || null,
        rc_original_app_user_id: normalizeStr(event.original_app_user_id) || null,
        rc_last_event_type: eventTypeSafe,
        rc_last_event_id: eventId,
      },
      { onConflict: "user_id" }
    );

    if (upsertErr) {
      return json(500, {
        ok: false,
        error: "entitlement_upsert_failed",
        detail: upsertErr.message,
      });
    }

    return json(200, {
      ok: true,
      eventId,
      userId,
      entitlementId: RC_ENTITLEMENT_ID,
      isPremium: premium.isPremium,
      source: premium.source,
      expiresAtMs: premium.expiresAtMs,
    });
  } catch (e) {
    return json(500, {
      ok: false,
      error: "revenuecat_webhook_failed",
      detail: String(e),
    });
  }
});
