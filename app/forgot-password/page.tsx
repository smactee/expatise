"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./forgot-password.module.css";
import { isValidEmail, normalizeEmail } from "../../lib/auth";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // Pre-login: force light mode (keep your behavior)
  useEffect(() => {
    document.documentElement.dataset.theme = "light";
  }, []);

  const canSend = useMemo(() => {
    const trimmed = email.trim();
    return trimmed.length > 0 && isValidEmail(trimmed) && !loading;
  }, [email, loading]);

  const sendLink = async () => {
    setError(null);
    setSent(false);

    const emailNorm = normalizeEmail(email);
    if (!isValidEmail(emailNorm)) {
      setError("Please enter a valid email.");
      return;
    }

    setLoading(true);
    try {
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`;

      const { error } = await supabase.auth.resetPasswordForEmail(emailNorm, { redirectTo });
      if (error) {
        setError(error.message);
        return;
      }

      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <section className={styles.sheet}>
          <button type="button" className={styles.backBtn} onClick={() => router.back()}>
            ← Back
          </button>

          <h1 className={styles.title}>Reset password</h1>

          {!sent ? (
            <>
              <p className={styles.subtitle}>Enter your email and we’ll send you a reset link.</p>

              <label className={styles.label}>Email</label>
              <input
                className={styles.input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                onFocus={() => setError(null)}
                placeholder="user@expatise.com"
              />

              {error && <div className={styles.errorBox}>{error}</div>}

              <button className={styles.cta} disabled={!canSend} onClick={sendLink}>
                {loading ? "Sending..." : "Send reset link"}
              </button>
            </>
          ) : (
            <>
              <div className={styles.successBox}>
                If that email exists, we sent a reset link. Open it to set a new password.
              </div>
              <button className={styles.cta} onClick={() => router.push("/login")}>
                Back to sign in
              </button>
            </>
          )}
        </section>
      </div>
    </main>
  );
}