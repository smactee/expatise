"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "./reset-password.module.css";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/useT";

type MessageTone = "success" | "error";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { t } = useT();

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgTone, setMsgTone] = useState<MessageTone>("error");
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
    setMsgTone("error");

    if (pw.length < 8) return setMsg(t("resetPassword.errors.passwordMin"));
    if (pw !== pw2) return setMsg(t("resetPassword.errors.passwordMismatch"));

    setLoading(true);
    try {
      // Update password for the currently-authenticated recovery session
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) {
        setMsg(error.message);
        return;
      }

      setMsgTone("success");
      setMsg(t("resetPassword.success"));
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
          <h1 className={styles.title}>{t("resetPassword.title")}</h1>

          {!ready ? (
            <div className={styles.errorBox}>
              {t("resetPassword.invalidLink")}
            </div>
          ) : (
            <>
              {msg && <div className={msgTone === "success" ? styles.successBox : styles.errorBox}>{msg}</div>}

              <label className={styles.label}>{t("resetPassword.newPasswordLabel")}</label>
              <input
                className={styles.input}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                type="password"
                autoComplete="new-password"
              />

              <label className={styles.label}>{t("resetPassword.confirmPasswordLabel")}</label>
              <input
                className={styles.input}
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                type="password"
                autoComplete="new-password"
              />

              <button className={styles.cta} disabled={loading} onClick={submit}>
                {loading ? t("resetPassword.updateLoading") : t("resetPassword.updateIdle")}
              </button>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
