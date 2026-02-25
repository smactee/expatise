"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "./reset-password.module.css";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = "light";

    (async () => {
      // When opened from the email link, the callback should establish a session.
      const { data } = await supabase.auth.getSession();
      setReady(!!data.session);
    })();
  }, [supabase]);

  const submit = async () => {
    setMsg(null);

    if (pw.length < 8) return setMsg("Password must be at least 8 characters.");
    if (pw !== pw2) return setMsg("Passwords do not match.");

    setLoading(true);
    try {
      // Update password for the currently-authenticated recovery session
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) {
        setMsg(error.message);
        return;
      }

      setMsg("Password updated. Please sign in again.");
      await supabase.auth.signOut();
      router.replace("/login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <section className={styles.sheet}>
          <h1 className={styles.title}>Set a new password</h1>

          {!ready ? (
            <div className={styles.errorBox}>
              This reset link is invalid or expired. Please request a new reset email.
            </div>
          ) : (
            <>
              {msg && <div className={msg.includes("updated") ? styles.successBox : styles.errorBox}>{msg}</div>}

              <label className={styles.label}>New password</label>
              <input
                className={styles.input}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                type="password"
                autoComplete="new-password"
              />

              <label className={styles.label}>Confirm password</label>
              <input
                className={styles.input}
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                type="password"
                autoComplete="new-password"
              />

              <button className={styles.cta} disabled={loading} onClick={submit}>
                {loading ? "Updating..." : "Update password"}
              </button>
            </>
          )}
        </section>
      </div>
    </main>
  );
}