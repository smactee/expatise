//  app/login/page.tsx

'use client';

import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useMemo, useEffect } from 'react';
import styles from '@/login.module.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import CreateAccountModal from './CreateAccountModal';
import { faGoogle, faApple, faWeixin } from '@fortawesome/free-brands-svg-icons';
import {signIn, getProviders} from "next-auth/react";
import { isValidEmail, normalizeEmail, safeNextPath } from '@/lib/auth';
import CSRBoundary from '@/components/CSRBoundary';



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


  const [providers, setProviders] = useState<Record<string, any> | null>(null);

  const emailNorm = normalizeEmail(email);
  const emailOK = isValidEmail(emailNorm);

  const canSubmit = useMemo(() => {
  return emailOK && password.trim().length > 0 && !isSubmitting;
}, [emailOK, password, isSubmitting]);



useEffect(() => {
  let mounted = true;
  getProviders()
    .then((p) => { if (mounted) setProviders(p); })
    .catch(() => { if (mounted) setProviders(null); });
  return () => { mounted = false; };
}, []);


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
    try {   // call server to check password against the same store reset uses
      const res = await fetch("/api/local-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: emailNorm, password }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      await new Promise((r) => setTimeout(r, 300)); // simulate network delay (optional)
  
      if (!data.ok) {
    setError("Email or password doesn’t match. Try again or reset your password.");
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
            {error && <div className={styles.errorBox}>{error}</div>}

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

            <button type="button" className={styles.linkBtn} onClick={() => router.push('/')}>
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
    {providers?.google && (
    <button type="button" 
    className={styles.snsBtnSmall} 
    aria-label="Continue with Google"
    onClick={() => signIn("google", { callbackUrl: nextParam })}>
    <FontAwesomeIcon icon={faGoogle} />
    </button>
    )}

    {providers?.apple && (
    <button 
    type="button" 
    className={styles.snsBtnSmall} 
    aria-label="Continue with Apple"
    onClick={() => signIn("apple", { callbackUrl: nextParam })}>
    <FontAwesomeIcon icon={faApple} />
    </button>
    )}

    {providers?.wechat && (
    <button 
    type="button" 
    className={styles.snsBtnSmall} 
    aria-label="Continue with WeChat"
    onClick={() => signIn("wechat", { callbackUrl: nextParam })}>
    <FontAwesomeIcon icon={faWeixin} />
    </button>
    )}
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