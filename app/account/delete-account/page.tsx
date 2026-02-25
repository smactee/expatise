//app/account/delete-account/page.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { resetAllLocalData } from "@/lib/stats/resetLocalData";
import BackButton from "@/components/BackButton";
import { FunctionsHttpError } from "@supabase/supabase-js";


export default function DeleteAccountPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [typed, setTyped] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canDelete = typed.trim().toUpperCase() === "DELETE";

async function onDelete() {
  if (!canDelete || loading) return;

  setErr(null);
  setLoading(true);

  try {
    const { data, error } = await supabase.functions.invoke("account-delete", { body: {} });
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
      throw new Error(j?.detail ?? j?.error ?? "Delete failed");
    }

    // Local cleanup
    await supabase.auth.signOut();
    await resetAllLocalData({ includeCaches: true });

    setDone(true);
    router.replace("/account-deletion");
  } catch (e: any) {
    setErr(e?.message ?? "Account deletion failed.");
  } finally {
    setLoading(false);
  }
}

  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: "24px 16px" }}>
      <BackButton />
      <h1 style={{ fontSize: 22, marginBottom: 10 }}>Delete Account</h1>

      {done ? (
        <p style={{ opacity: 0.85 }}>Your account has been deleted. Redirecting…</p>
      ) : (
        <>
          <p style={{ opacity: 0.85 }}>
            This will permanently delete your account and server-stored data for this account.
          </p>

          <div style={{ marginTop: 16 }}>
            <label style={{ display: "block", fontSize: 13, opacity: 0.85, marginBottom: 6 }}>
              Type <b>DELETE</b> to confirm
            </label>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="DELETE"
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
            {loading ? "Deleting…" : "Delete My Account"}
          </button>

          <button
            onClick={() => router.back()}
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
            Cancel
          </button>
        </>
      )}
    </main>
  );
}