//  app/login/page.tsx

'use client';

import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useMemo, useEffect, useRef } from 'react';
import styles from './login.module.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import CreateAccountModal from './CreateAccountModal';
import { faGoogle, faApple, faWeixin } from '@fortawesome/free-brands-svg-icons';
import { isValidEmail, normalizeEmail, safeNextPath } from '@/lib/auth';
import { NATIVE_OAUTH_REDIRECT_URI } from '@/lib/auth/oauth';
import CSRBoundary from '@/components/CSRBoundary';
import { createClient } from '@/lib/supabase/client';
import { useT } from '@/lib/i18n/useT';


function Inner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = safeNextPath(searchParams.get("next"), "/");
  const { t } = useT();


  const [email, setEmail] = useState('user@expatise.com');
  const [password, setPassword] = useState('');

  const [isCreateOpen, setIsCreateOpen] = useState(false);   // modal open/close state
  const [showPassword, setShowPassword] = useState(false);   //  Eye toggle
  const [capsLockOn, setCapsLockOn] = useState(false);      // Caps Lock warning
  const [error, setError] = useState<string | null>(null); // Friendly error state
  const [isSubmitting, setIsSubmitting] = useState(false);// Loading state
  const [emailTouched, setEmailTouched] = useState(false);
  const [oauthSubmitting, setOauthSubmitting] = useState(false);
  const authBusyRef = useRef(false); // instant mutex (prevents micro double-tap window)


const supabase = useMemo(() => createClient(), []);

  const emailNorm = normalizeEmail(email);
  const emailOK = isValidEmail(emailNorm);

const canSubmit = useMemo(() => {
  return emailOK && password.trim().length > 0 && !isSubmitting && !oauthSubmitting;
}, [emailOK, password, isSubmitting, oauthSubmitting]);

const toastTimerRef = useRef<number | null>(null);

const showToast = (msg: string) => {
  setError(msg);
  if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
  toastTimerRef.current = window.setTimeout(() => setError(null), 500);
};
const comingSoon = (provider: string) => showToast(t('login.social.comingSoon', { provider }));



  useEffect (() => {
  document.documentElement.dataset.theme = 'light';
}, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailTouched(true);
    setError(null);

    if (!emailOK) {
      setError(t('login.errors.invalidEmail'));
      return;
    }
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
  // ✅ Supabase email/password login (creates a real Supabase session)
  const { error } = await supabase.auth.signInWithPassword({
    email: emailNorm,
    password,
  });

  // optional delay (purely UI)
  await new Promise((r) => setTimeout(r, 150));

  if (error) {
    // Friendly message for bad credentials
    const msg =
      /invalid login credentials/i.test(error.message)
        ? t('login.errors.invalidCredentials')
        : error.message;

    setError(msg);
    return;
  }

  // ✅ tell the rest of the app "session changed"
try { window.dispatchEvent(new Event("expatise:session-changed")); } catch {}
try { window.dispatchEvent(new Event("expatise:entitlements-changed")); } catch {}

// ✅ force App Router to re-evaluate any cookie/session-based server state
router.refresh();

router.replace(nextParam);
} catch {
  setError(t('login.errors.network'));
}

  finally {
  setIsSubmitting(false);
}
  };

  const handleCaps = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Works in modern browsers
    const caps = e.getModifierState?.("CapsLock") ?? false;
    setCapsLockOn(caps);
  };


  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <div className={styles.hero}>
          <Image
            src="/images/auth/login-screen.png"
            alt={t('login.heroAlt')}
            fill
            priority
            className={styles.heroImg}
          />
          <div className={styles.heroOverlay} />
        </div>

        <section className={styles.sheet}>
          <h1 className={styles.title}>{t('login.title')}</h1>
          <p className={styles.subtitle}>{t('login.subtitle')}</p>

          <form onSubmit={onSubmit} className={styles.form}>
            <label className={styles.row}>
              <span className={styles.icon}>
                <Image 
                src="/images/auth/username-icon.png"
                alt={t('login.emailIconAlt')}
                width={22}
                height={22}
                />
              </span>
              <input
                className={styles.input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('login.emailPlaceholder')}
                autoComplete="email"
                type="email"
              />
            </label>

            <label className={styles.row}>
              <span className={styles.icon}>
                <Image 
                src="/images/auth/password-icon.png"
                alt={t('login.passwordIconAlt')}
                width={22}
                height={22}
                />
              </span>
              <input
                className={styles.input}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                onKeyUp={handleCaps}
                onKeyDown={handleCaps}
                onFocus={() => setError(null)}
              />
{/* ✅ (1) Eye toggle using Font Awesome */}
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t('login.passwordToggleHide') : t('login.passwordToggleShow')}
              >
                <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
              </button>
            </label>

            {/* ✅ (2) Caps Lock warning */}
            {capsLockOn && (
              <div className={styles.capsWarning}>{t('login.capsLockWarning')}</div>
            )}

            {/* ✅ (4) Friendly error state */}
            <div
  className={`${styles.toast} ${error ? styles.toastShow : ""}`}
  role="alert"
  aria-live="polite"
>
  {error}
</div>


            {/* ✅ (3) Forgot password link */}
            <div className={styles.forgotRow}>
              <button
                type="button"
                className={styles.linkInline}
                onClick={() => router.push("/forgot-password")}
              >
                {t('login.forgotPassword')}
              </button>
            </div>

            <button type="submit" className={styles.cta} disabled={!canSubmit}>
              {/* ✅ (6) Loading state */}
              <span>{isSubmitting ? t('login.submitLoading') : t('login.submitIdle')}</span>
              <span className={styles.arrow}>→</span>
            </button>
          </form>


          <div className={styles.links}>
            <button 
            type="button" 
            className={styles.linkBtn}
            onClick={() => setIsCreateOpen(true)}
            >
              {t('login.createAccount')}
              </button>

<button
  type="button"
  className={styles.linkBtn}
  disabled={oauthSubmitting || isSubmitting}
  onClick={async () => {
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      if ((data.session?.user as any)?.is_anonymous) {
        await supabase.auth.signOut();
      }
    } catch {
      // keep guest mode local-only even if cleanup fails
    }
    try { window.dispatchEvent(new Event("expatise:session-changed")); } catch {}
    try { window.dispatchEvent(new Event("expatise:entitlements-changed")); } catch {}
    router.refresh();
    router.replace(nextParam);
  }}
>
  {t('login.continueAsGuest')}
</button>

          </div>
          <CreateAccountModal
            open={isCreateOpen}
            onClose={() => setIsCreateOpen(false)}
            onCreated={(newEmail) => {
              setEmail(newEmail);
            }}
            />  
            <div className={styles.snsBlock}>
  <div className={styles.snsDivider}>
    <span>{t('login.socialDivider')}</span>
  </div>

  <div className={styles.snsRowSmall}>



<button
  type="button"
  className={styles.snsBtnSmall}
  aria-label={t('login.social.googleAria')}
  disabled={oauthSubmitting || isSubmitting}
  aria-busy={oauthSubmitting ? "true" : "false"}
  onClick={async () => {
    // ✅ hard guard: prevents micro double-tap before state updates
    if (authBusyRef.current) return;
    authBusyRef.current = true;

    // ✅ soft guard: prevents repeated taps once state applies
    if (oauthSubmitting || isSubmitting) {
      authBusyRef.current = false;
      return;
    }

    setOauthSubmitting(true);
    setError(null);

    try {
      // Store "next" so the deep-link handler can send the user back correctly
      try {
        localStorage.setItem("expatise:oauth:next", nextParam);
      } catch {}

      // Detect native (Capacitor) at runtime
      const { Capacitor } = await import("@capacitor/core");

      if (Capacitor.isNativePlatform()) {
        const { Browser } = await import("@capacitor/browser");

        const redirectTo = NATIVE_OAUTH_REDIRECT_URI;

        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo, queryParams: { prompt: "select_account" } },
          skipBrowserRedirect: true,
        });

        if (error) {
          setError(error.message);
          return;
        }

        const url = data?.url;
if (!url) {
  setError(t('login.errors.noOauthUrl'));
  return;
}
await Browser.open({ url });
return;
      }

      // ✅ Web: SSR callback flow
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
        nextParam
      )}`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, queryParams: { prompt: "select_account" } },
      });

      if (error) setError(error.message);
    } catch (err: any) {
      setError(err?.message ?? t('login.errors.googleFailed'));
    } finally {
      setOauthSubmitting(false);
      authBusyRef.current = false;
    }
  }}
>
  <FontAwesomeIcon icon={faGoogle} />
</button>



<button
  type="button"
  className={`${styles.snsBtnSmall} ${styles.snsBtnSoon}`}
  aria-label={t('login.social.appleAria')}
  aria-disabled="true"
  onClick={() => comingSoon(t('login.providers.apple'))}
  title={t('login.social.comingSoonTitle')}
>
  <FontAwesomeIcon icon={faApple} />
</button>



<button
  type="button"
  className={`${styles.snsBtnSmall} ${styles.snsBtnSoon}`}
  aria-label={t('login.social.wechatAria')}
  aria-disabled="true"
  onClick={() => comingSoon(t('login.providers.wechat'))}
  title={t('login.social.comingSoonTitle')}
>
  <FontAwesomeIcon icon={faWeixin} />
</button>

  </div>
</div>

        </section>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <CSRBoundary>
      <Inner />
    </CSRBoundary>
  );
}
