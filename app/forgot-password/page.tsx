"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./forgot-password.module.css";
import { isValidEmail, normalizeEmail } from "../../lib/auth";
import { buildAuthCallbackUrl } from "@/lib/auth/oauth";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/useT";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { t } = useT();

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
      setError(t("forgotPassword.invalidEmail"));
      return;
    }

    setLoading(true);
    try {
      const redirectTo = await buildAuthCallbackUrl("/reset-password");

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
          <h1 className={styles.title}>{t("forgotPassword.title")}</h1>

          {!sent ? (
            <>
              <p className={styles.subtitle}>{t("forgotPassword.subtitle")}</p>

              <label className={styles.label}>{t("forgotPassword.emailLabel")}</label>
              <input
                className={styles.input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                onFocus={() => setError(null)}
                placeholder={t("forgotPassword.emailPlaceholder")}
              />

              {error && <div className={styles.errorBox}>{error}</div>}

              <button className={styles.cta} disabled={!canSend} onClick={sendLink}>
                {loading ? t("forgotPassword.sendLoading") : t("forgotPassword.sendIdle")}
              </button>
            </>
          ) : (
            <>
              <div className={styles.successBox}>
                {t("forgotPassword.success")}
              </div>
              <button className={styles.cta} onClick={() => router.push("/login")}>
                {t("shared.common.backToSignIn")}
              </button>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
