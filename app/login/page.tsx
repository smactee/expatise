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
import CSRBoundary from '@/components/CSRBoundary';
import { createClient } from '@/lib/supabase/client';


function Inner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = safeNextPath(searchParams.get("next"), "/");


  const [email, setEmail] = useState('user@expatise.com');
  const [password, setPassword] = useState('');

  const [isCreateOpen, setIsCreateOpen] = useState(false);   // modal open/close state
  const [showPassword, setShowPassword] = useState(false);   //  Eye toggle
  const [capsLockOn, setCapsLockOn] = useState(false);      // Caps Lock warning
  const [error, setError] = useState<string | null>(null); // Friendly error state
  const [isSubmitting, setIsSubmitting] = useState(false);// Loading state
  const [emailTouched, setEmailTouched] = useState(false);

const supabase = useMemo(() => createClient(), []);

  const emailNorm = normalizeEmail(email);
  const emailOK = isValidEmail(emailNorm);

  const canSubmit = useMemo(() => {
  return emailOK && password.trim().length > 0 && !isSubmitting;
}, [emailOK, password, isSubmitting]);

const toastTimerRef = useRef<number | null>(null);

const showToast = (msg: string) => {
  setError(msg);
  if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
  toastTimerRef.current = window.setTimeout(() => setError(null), 500);
};
const comingSoon = (provider: string) => showToast(`${provider} sign-in is coming soon.`);



  useEffect (() => {
  document.documentElement.dataset.theme = 'light';
}, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailTouched(true);
    setError(null);

    if (!emailOK) {
      setError("Please enter a valid email address.");
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
        ? "Email or password doesn’t match. Try again or reset your password."
        : error.message;

    setError(msg);
    return;
  }

  // ✅ tell the rest of the app "session changed"
  window.dispatchEvent(new Event("expatise:session-changed"));

  router.replace(nextParam);
} catch {
  setError("Network error. Please try again.");
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
            alt="Welcome background"
            fill
            priority
            className={styles.heroImg}
          />
          <div className={styles.heroOverlay} />
        </div>

        <section className={styles.sheet}>
          <h1 className={styles.title}>Welcome!</h1>
          <p className={styles.subtitle}>Sign in to continue.</p>

          <form onSubmit={onSubmit} className={styles.form}>
            <label className={styles.row}>
              <span className={styles.icon}>
                <Image 
                src="/images/auth/username-icon.png"
                alt="Username"
                width={22}
                height={22}
                />
              </span>
              <input
                className={styles.input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                autoComplete="email"
                type="email"
              />
            </label>

            <label className={styles.row}>
              <span className={styles.icon}>
                <Image 
                src="/images/auth/password-icon.png"
                alt="Password"
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
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
              </button>
            </label>

            {/* ✅ (2) Caps Lock warning */}
            {capsLockOn && (
              <div className={styles.capsWarning}>Caps Lock is on</div>
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
                Forgot password?
              </button>
            </div>

            <button type="submit" className={styles.cta} disabled={!canSubmit}>
              {/* ✅ (6) Loading state */}
              <span>{isSubmitting ? "Signing in..." : "Sign In"}</span>
              <span className={styles.arrow}>→</span>
            </button>
          </form>


          <div className={styles.links}>
            <button 
            type="button" 
            className={styles.linkBtn}
            onClick={() => setIsCreateOpen(true)}
            >
              Create a new account
              </button>

            <button
  type="button"
  className={styles.linkBtn}
  onClick={async () => {
    setError(null);
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      setError(error.message);
      return;
    }
    window.dispatchEvent(new Event("expatise:session-changed"));
    router.replace(nextParam);
  }}
>
  Continue as guest
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
    <span>or continue with</span>
  </div>

  <div className={styles.snsRowSmall}>



    <button
  type="button"
  className={styles.snsBtnSmall}
  aria-label="Continue with Google"
  onClick={async () => {
    setError(null);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextParam)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) setError(error.message);
  }}
>
  <FontAwesomeIcon icon={faGoogle} />
</button>



<button
  type="button"
  className={`${styles.snsBtnSmall} ${styles.snsBtnSoon}`}
  aria-label="Continue with Apple"
  aria-disabled="true"
  onClick={() => comingSoon("Apple")}
  title="Coming soon"
>
  <FontAwesomeIcon icon={faApple} />
</button>



<button
  type="button"
  className={`${styles.snsBtnSmall} ${styles.snsBtnSoon}`}
  aria-label="Continue with WeChat"
  aria-disabled="true"
  onClick={() => comingSoon("WeChat")}
  title="Coming soon"
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