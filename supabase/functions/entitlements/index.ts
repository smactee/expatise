// supabase/functions/entitlements/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "jsr:@supabase/supabase-js@2/cors";

function normalizeEmail(s: unknown) {
  return String(s ?? "").trim().toLowerCase();
}

const CORS = {
  ...corsHeaders,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

type EntitlementSource =
  | "none"
  | "trial"
  | "subscription"
  | "lifetime"
  | "admin"
  | "dev"
  | "demo";

type Entitlements = {
  isPremium: boolean;
  source: EntitlementSource;
  updatedAt: number; // unix ms
  expiresAt?: number; // unix ms
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

function toMs(ts: unknown): number | null {
  if (!ts) return null;
  const d = new Date(String(ts));
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : null;
}

function parseCsvEnv(name: string, fallbackCsv: string) {
  const raw = (Deno.env.get(name) ?? "").trim();
  const csv = raw ? raw : fallbackCsv;
  return Array.from(
    new Set(
      csv
        .split(",")
        .map(normalizeEmail)
        .filter(Boolean)
    )
  );
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SB_PUBLISHABLE_KEY") ?? "";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY/SB_PUBLISHABLE_KEY");
}

const ADMIN_EMAILS = parseCsvEnv("ADMIN_PREMIUM_EMAILS", "user@expatise.com");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });

  try {
    // Accept guest calls (verify_jwt=false), but only return premium if we can verify a user.
    const authHeader =
  req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";

// Extract raw JWT from "Bearer <token>"
const m = authHeader.match(/^Bearer\s+(.+)$/i);
const jwt = (m?.[1] ?? "").trim();

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  // Set auth context for PostgREST + RLS reads
  global: jwt ? { headers: { Authorization: `Bearer ${jwt}` } } : undefined,
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

let user: any = null;

if (jwt) {
  const { data, error } = await supabase.auth.getUser(jwt);
  user = error ? null : data.user;
}

    // Stable userKey for your existing local storage keys
    const userEmail = normalizeEmail(user?.email ?? "");
    const userKey = user ? (userEmail ? userEmail : `sb:${user.id}`) : "guest";

    // Guest => always free
    if (!user) {
      const entitlements: Entitlements = { isPremium: false, source: "none", updatedAt: Date.now() };
      return json(200, { ok: true, userKey, entitlements });
    }

    // Admin email override (still useful)
    if (userEmail && ADMIN_EMAILS.includes(userEmail)) {
      const entitlements: Entitlements = { isPremium: true, source: "admin", updatedAt: Date.now() };
      return json(200, { ok: true, userKey, entitlements, userId: user.id });
    }

    // DB truth: premium_entitlements keyed by user.id
    const { data: row, error: rowErr } = await supabase
      .from("premium_entitlements")
      .select("is_premium, source, expires_at, updated_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (rowErr) {
      // If DB lookup fails, fail "closed" (free) but keep ok:true so UI doesn't crash
      const entitlements: Entitlements = { isPremium: false, source: "none", updatedAt: Date.now() };
      return json(200, { ok: true, userKey, entitlements, userId: user.id });
    }

    const now = Date.now();
    const expiresAt = toMs(row?.expires_at);
    const updatedAt = toMs(row?.updated_at) ?? now;

    const notExpired = !expiresAt || expiresAt > now;
    const isPremium = row?.is_premium === true && notExpired;

    const source = (String(row?.source ?? "none") as EntitlementSource) || "none";

    const entitlements: Entitlements = isPremium
      ? { isPremium: true, source, updatedAt, ...(expiresAt ? { expiresAt } : {}) }
      : { isPremium: false, source: "none", updatedAt };

    return json(200, { ok: true, userKey, entitlements, userId: user.id });
  } catch (e) {
    return json(500, { ok: false, error: "entitlements_failed", detail: String(e) });
  }
});