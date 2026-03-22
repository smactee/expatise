'use client';

import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGoogle, faApple, faWeixin } from '@fortawesome/free-brands-svg-icons';
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';

import styles from './create-account-modal.module.css';
import { isValidEmail, normalizeEmail } from '@/lib/auth';
import { buildAuthCallbackUrl, NATIVE_OAUTH_REDIRECT_URI } from '@/lib/auth/oauth';
import { createClient } from '@/lib/supabase/client';
import { useT } from '@/lib/i18n/useT';

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: (email: string) => void;
};

export default function CreateAccountModal({ open, onClose, onCreated }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { t } = useT();

  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);
  const [oauthSubmitting, setOauthSubmitting] = useState(false);
  const oauthBusyRef = useRef(false);

  const canSubmit = useMemo(() => {
    if (isSubmitting || oauthSubmitting) return false;
    if (!isValidEmail(email)) return false;
    if (pw.trim().length < 8) return false;
    if (pw !== pw2) return false;
    return true;
}, [email, pw, pw2, isSubmitting, oauthSubmitting]);

  if (!open) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNeedsEmailConfirm(false);

    const trimmedEmail = normalizeEmail(email);

    if (!isValidEmail(trimmedEmail)) return setError(t('createAccount.errors.invalidEmail'));
    if (pw.trim().length < 8) return setError(t('createAccount.errors.passwordMin'));
    if (pw !== pw2) return setError(t('createAccount.errors.passwordMismatch'));

    setIsSubmitting(true);
    try {
      const emailRedirectTo = await buildAuthCallbackUrl("/");
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: pw,
        options: {
          emailRedirectTo,
        },
      });

      if (error) {
        if (/already registered/i.test(error.message) || /already exists/i.test(error.message)) {
          setError(t('createAccount.errors.alreadyRegistered'));
        } else {
          setError(error.message);
        }
        return;
      }

      const signedInNow = !!data?.session;

      if (!signedInNow) {
        setNeedsEmailConfirm(true);
        onCreated?.(trimmedEmail);
        return;
      }

      try { window.dispatchEvent(new Event('expatise:session-changed')); } catch {}
      try { window.dispatchEvent(new Event('expatise:entitlements-changed')); } catch {}

      router.refresh();

      onCreated?.(trimmedEmail);
      onClose();
    } catch {
      setError(t('createAccount.errors.network'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <h2 className={styles.title}>{t('createAccount.title')}</h2>
        <p className={styles.subtitle}>{t('createAccount.subtitle')}</p>

        {/* ✅ Email confirmation message */}
        {needsEmailConfirm && (
          <div
            className={styles.errorBox}
            style={{
              background: 'rgba(43,124,175,0.10)',
              borderColor: 'rgba(43,124,175,0.25)',
            }}
          >
            <strong>{t('createAccount.checkEmailTitle')}</strong>
            <div style={{ marginTop: 6 }}>
              {t('createAccount.checkEmailBody', { email: normalizeEmail(email) })}
              <br />
              {t('createAccount.checkEmailHelp')}
            </div>

            <button
              type="button"
              className={styles.cta}
              style={{ marginTop: 10 }}
              onClick={() => {
                setNeedsEmailConfirm(false);
                onClose();
              }}
            >
              {t('createAccount.gotIt')}
            </button>
          </div>
        )}

        <form onSubmit={submit} className={styles.form}>
          <label className={styles.row}>
            <span className={styles.label}>{t('createAccount.emailLabel')}</span>
            <input
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('createAccount.emailPlaceholder')}
              type="email"
              autoComplete="email"
              onFocus={() => setError(null)}
            />
          </label>

          <label className={styles.row}>
            <span className={styles.label}>{t('createAccount.passwordLabel')}</span>
            <div className={styles.pwWrap}>
              <input
                className={styles.input}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder={t('createAccount.passwordPlaceholder')}
                type={showPw ? 'text' : 'password'}
                autoComplete="new-password"
                onFocus={() => setError(null)}
              />
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? t('createAccount.passwordToggleHide') : t('createAccount.passwordToggleShow')}
              >
                <FontAwesomeIcon icon={showPw ? faEyeSlash : faEye} />
              </button>
            </div>
          </label>

          <label className={styles.row}>
            <span className={styles.label}>{t('createAccount.confirmLabel')}</span>
            <div className={styles.pwWrap}>
              <input
                className={styles.input}
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                placeholder={t('createAccount.confirmPlaceholder')}
                type={showPw2 ? 'text' : 'password'}
                autoComplete="new-password"
                onFocus={() => setError(null)}
              />
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => setShowPw2((v) => !v)}
                aria-label={showPw2 ? t('createAccount.passwordToggleHide') : t('createAccount.passwordToggleShow')}
              >
                <FontAwesomeIcon icon={showPw2 ? faEyeSlash : faEye} />
              </button>
            </div>
          </label>

          {error && <div className={styles.errorBox}>{error}</div>}

          <button type="submit" className={styles.cta} disabled={!canSubmit}>
            {isSubmitting ? t('createAccount.submitLoading') : t('createAccount.submitIdle')}
          </button>
        </form>

        <div className={styles.dividerRow}>
          <span className={styles.dividerLine} />
          <span className={styles.dividerText}>{t('createAccount.divider')}</span>
          <span className={styles.dividerLine} />
        </div>

        <div className={styles.snsRow}>
          <button
  type="button"
  className={styles.snsBtn}
  aria-label={t('createAccount.social.googleAria')}
  disabled={isSubmitting || oauthSubmitting}
  aria-busy={oauthSubmitting ? "true" : "false"}
  onClick={async () => {
    // ✅ hard guard (prevents super-fast double taps)
    if (oauthBusyRef.current) return;
    oauthBusyRef.current = true;

    setError(null);
    setOauthSubmitting(true);

    try {
      // Keep behavior consistent with your login page (deep-link handler uses this)
      try {
        localStorage.setItem("expatise:oauth:next", "/");
      } catch {}

      const { Capacitor } = await import("@capacitor/core");

      // ✅ Force account chooser every time
      const queryParams = { prompt: "select_account" as const };

      if (Capacitor.isNativePlatform()) {
        const { Browser } = await import("@capacitor/browser");

        const redirectTo = NATIVE_OAUTH_REDIRECT_URI;

        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo, queryParams },
          skipBrowserRedirect: true,
        });

        if (error) {
          setError(error.message);
          return;
        }

       const url = data?.url;
if (!url) {
  setError(t('createAccount.errors.noOauthUrl'));
  return;
}
await Browser.open({ url });
return;
      }

      // ✅ Web (SSR callback)
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/")}`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, queryParams },
      });

      if (error) setError(error.message);
    } catch (err: any) {
      setError(err?.message ?? t('createAccount.errors.googleFailed'));
    } finally {
      setOauthSubmitting(false);
      oauthBusyRef.current = false;
    }
  }}
>
  <FontAwesomeIcon icon={faGoogle} />
</button>

          <button type="button" className={styles.snsBtn} aria-label={t('createAccount.social.appleAria')}>
            <FontAwesomeIcon icon={faApple} />
          </button>

          <button type="button" className={styles.snsBtn} aria-label={t('createAccount.social.wechatAria')}>
            <FontAwesomeIcon icon={faWeixin} />
          </button>
        </div>
      </div>

      {/* click outside to close */}
      <button type="button" className={styles.backdropClose} onClick={onClose} aria-label={t('createAccount.closeAria')} />
    </div>
  );
}
