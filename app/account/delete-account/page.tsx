//app/account/delete-account/page.tsx
"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { resetAllLocalData } from "@/lib/stats/resetLocalData";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { useT } from "@/lib/i18n/useT";

const DELETE_SUCCESS_PATH = "/account-deletion?deleted=1";

export default function DeleteAccountPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const deleteBusyRef = useRef(false);
  const { t } = useT();

  const [typed, setTyped] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canDelete = typed.trim().toUpperCase() === "DELETE";

async function onDelete() {
  if (!canDelete || loading || deleteBusyRef.current) return;

  deleteBusyRef.current = true;
  setErr(null);
  setLoading(true);

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token ?? null;
    if (!token) {
      setErr(t("deleteAccount.loginRequired"));
      return;
    }

    const anonKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!anonKey) {
      throw new Error(t("deleteAccount.missingEnv"));
    }

    const { data, error } = await supabase.functions.invoke("account-delete", {
      body: {},
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
      },
    });
    let j: any = data ?? null;

    // When the function returns 4xx/5xx, supabase-js can return a FunctionsHttpError,
    // and the response JSON is available via error.context.json(). :contentReference[oaicite:1]{index=1}
    if (error) {
      if (error instanceof FunctionsHttpError) {
        j = await error.context.json().catch(() => null);
      }
      throw new Error(j?.detail ?? j?.error ?? error.message);
    }

    if (!j?.ok) {
      throw new Error(j?.detail ?? j?.error ?? t("deleteAccount.failed"));
    }

    // Backend deletion succeeded. From here on, local cleanup must be best-effort.
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {}

    try {
      await resetAllLocalData({ includeCaches: true });
    } catch {}

    try { window.dispatchEvent(new Event("expatise:session-changed")); } catch {}
    try { window.dispatchEvent(new Event("expatise:entitlements-changed")); } catch {}

    setDone(true);
    window.location.replace(DELETE_SUCCESS_PATH);
  } catch (e: any) {
    setErr(e?.message ?? t("deleteAccount.failed"));
  } finally {
    setLoading(false);
    deleteBusyRef.current = false;
  }
}

  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: "24px 16px" }}>
      <h1 style={{ fontSize: 22, marginBottom: 10 }}>{t("deleteAccount.title")}</h1>

      {done ? (
        <p style={{ opacity: 0.85 }}>{t("deleteAccount.done")}</p>
      ) : (
        <>
          <p style={{ opacity: 0.85 }}>
            {t("deleteAccount.body")}
          </p>

          <div style={{ marginTop: 16 }}>
            <label style={{ display: "block", fontSize: 13, opacity: 0.85, marginBottom: 6 }}>
              {t("deleteAccount.confirmLabel")}
            </label>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={t("deleteAccount.confirmPlaceholder")}
              style={{
                width: "100%",
                padding: "12px 12px",
                borderRadius: 12,
                border: "1px solid rgba(148,163,184,0.5)",
                outline: "none",
              }}
            />
          </div>

          {err ? (
            <div style={{ marginTop: 10, color: "rgba(185,28,28,0.95)", fontSize: 13 }}>
              {err}
            </div>
          ) : null}

          <button
            onClick={onDelete}
            disabled={!canDelete || loading}
            style={{
              marginTop: 16,
              width: "100%",
              height: 44,
              borderRadius: 14,
              border: "1px solid rgba(148,163,184,0.5)",
              background: canDelete ? "rgba(239,68,68,0.95)" : "rgba(148,163,184,0.25)",
              color: "white",
              fontWeight: 800,
              cursor: canDelete && !loading ? "pointer" : "not-allowed",
            }}
          >
            {loading ? t("deleteAccount.deleting") : t("deleteAccount.deleteButton")}
          </button>

          <button
            onClick={() => router.push("/profile")}
            disabled={loading}
            style={{
              marginTop: 10,
              width: "100%",
              height: 44,
              borderRadius: 14,
              border: "1px solid rgba(148,163,184,0.5)",
              background: "transparent",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {t("shared.common.cancel")}
          </button>
        </>
      )}
    </main>
  );
}
