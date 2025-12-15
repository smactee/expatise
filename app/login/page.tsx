'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState, useMemo, useEffect } from 'react';
import styles from './login.module.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import CreateAccountModal from './CreateAccountModal';
import { faGoogle, faApple, faWeixin } from '@fortawesome/free-brands-svg-icons';
import {signIn, getProviders} from "next-auth/react";
import { get } from 'http';
import { sign } from 'crypto';


export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('user@expatise.com');
  const [password, setPassword] = useState('');

  // ✅ modal open/close state (this was missing)
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  
 // ✅ (1) Eye toggle
  const [showPassword, setShowPassword] = useState(false);
  // ✅ (2) Caps Lock warning
  const [capsLockOn, setCapsLockOn] = useState(false);
  // ✅ (4) Friendly error state
  const [error, setError] = useState<string | null>(null);
  // ✅ (6) Loading state
  const [isSubmitting, setIsSubmitting] = useState(false);
  // ✅ (5) Disable sign-in until password not empty
  const canSubmit = useMemo(() => {
    return password.trim().length > 0 && !isSubmitting;
  }, [password, isSubmitting]);

  const [providers, setProviders] = useState<Record<string, any> | null>(null);

useEffect(() => {
  getProviders().then(setProviders);
}, []);

  useEffect (() => {
  document.documentElement.dataset.theme = 'light';
}, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setError(null);
    setIsSubmitting(true);

    try {
      // TODO: replace with real auth later.
      // Temporary demo rule: password must be "password123"
      const ok = password === "password123";

      // simulate network delay (so you can see loading state)
      await new Promise((r) => setTimeout(r, 700));

      if (!ok) {
        setError("Email or password doesn’t match. Try again or reset your password.");
        return;
      }

      router.push("/");
    } finally {
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
          <p className={styles.subtitle}>Sign in to continue</p>

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
              Create an account
              </button>

            <button type="button" className={styles.linkBtn} onClick={() => router.push('/')}>
              Skip as guest
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
    <button type="button" 
    className={styles.snsBtnSmall} 
    aria-label="Continue with Google"
    onClick={() => signIn("google", { callbackUrl: "/" })}>
    <FontAwesomeIcon icon={faGoogle} />
    </button>

    <button type="button" className={styles.snsBtnSmall} aria-label="Continue with Apple"
      onClick={() => alert('TODO: Apple OAuth')}>
      <FontAwesomeIcon icon={faApple} />
    </button>

    <button type="button" className={styles.snsBtnSmall} aria-label="Continue with WeChat"
      onClick={() => alert('TODO: WeChat OAuth')}>
      <FontAwesomeIcon icon={faWeixin} />
    </button>
  </div>
</div>

        </section>
      </div>
    </main>
  );
}
