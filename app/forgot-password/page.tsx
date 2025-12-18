"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./forgot-password.module.css";
import { isValidEmail, normalizeEmail } from "../../lib/auth";

type Step = "email" | "verify" | "done";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

const [emailError, setEmailError] = useState<string | null>(null);

const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  
  // Pre-login: force light mode
  useEffect(() => {
    document.documentElement.dataset.theme = "light";
  }, []);

const canSend = useMemo(() => {
  const trimmed = email.trim();
  return trimmed.length > 0 && isValidEmail(trimmed) && !loading;
}, [email, loading]);

  const canReset = useMemo(() => {
    if (loading) return false;
    if (code.trim().length < 4) return false;
    if (newPw.length < 8) return false;
    if (newPw !== confirmPw) return false;
    return true;
  }, [code, newPw, confirmPw, loading]);

  const sendCode = async () => {
    if (!canSend) return;
    setError(null);
    setLoading(true);
    try {
      await fetch("/api/password-reset/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setStep("verify");
    } catch {
      setError("Couldn’t start password reset. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!canReset) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, newPassword: newPw }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data?.message || "Code is invalid or expired.");
        return;
      }

      setStep("done");
    } catch {
      setError("Reset failed. Try again.");
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

          {step === "email" && (
            <>
              <p className={styles.subtitle}>Enter your email to get a one-time code.</p>

              <label className={styles.label}>Email</label>
              <input
  className={styles.input}
  value={email}
  onChange={(e) => {
    setEmail(e.target.value);
    if (emailError) setEmailError(null);
  }}
  onBlur={() => {
    const trimmed = email.trim();
    if (!trimmed) return setEmailError("Email is required.");
    if (!isValidEmail(trimmed)) return setEmailError("Please enter a valid email address.");
    setEmail(trimmed);
    setEmailError(null);
  }}
  type="email"
  autoComplete="email"
  onFocus={() => {
    setError(null);
    if (emailError) setEmailError(null);
  }}
  placeholder="user@expatise.com"
/>
              {emailError && <div className={styles.errorBox}>{emailError}</div>}

              {error && <div className={styles.errorBox}>{error}</div>}

              <button className={styles.cta} disabled={!canSend} onClick={sendCode}>
                {loading ? "Sending..." : "Send code"}
              </button>

              <p className={styles.hint}>
                Dev mode: the code is printed in your terminal (later we’ll email it).
              </p>
            </>
          )}

          {step === "verify" && (
            <>
              <p className={styles.subtitle}>Enter the code and set a new password.</p>

              <label className={styles.label}>One-time code</label>
              <input
                className={styles.input}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                placeholder="6-digit code"
                onFocus={() => setError(null)}
              />

              <label className={styles.label}>New password</label>
              <input
                className={styles.input}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                type="password"
                placeholder="At least 8 characters"
                onFocus={() => setError(null)}
              />

              <label className={styles.label}>Confirm password</label>
              <input
                className={styles.input}
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                type="password"
                onFocus={() => setError(null)}
              />

              {newPw && confirmPw && newPw !== confirmPw && (
                <div className={styles.warn}>Passwords don’t match.</div>
              )}

              {error && <div className={styles.errorBox}>{error}</div>}

              <button className={styles.cta} disabled={!canReset} onClick={resetPassword}>
                {loading ? "Resetting..." : "Reset password"}
              </button>

              <button type="button" className={styles.linkBtn} onClick={sendCode} disabled={!canSend}>
                Resend code
              </button>
            </>
          )}

          {step === "done" && (
            <>
              <div className={styles.successBox}>Password updated. You can sign in now.</div>
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
