'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import styles from './login.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('Huni');
  const [password, setPassword] = useState('');

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: wire real auth later
    router.push('/');
  };

  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <div className={styles.hero}>
          <Image
            src="/images/auth/onboarding-hero.jpg"
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
              <span className={styles.icon}>👤</span>
              <input
                className={styles.input}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                autoComplete="username"
              />
            </label>

            <label className={styles.row}>
              <span className={styles.icon}>🔒</span>
              <input
                className={styles.input}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                type="password"
                autoComplete="current-password"
              />
              <span className={styles.eye}>👁️</span>
            </label>

            <button type="submit" className={styles.cta}>
              <span>Sign In</span>
              <span className={styles.arrow}>→</span>
            </button>
          </form>

          <div className={styles.links}>
            <button type="button" className={styles.linkBtn}>Create an account</button>
            <button type="button" className={styles.linkBtn} onClick={() => router.push('/')}>
              Skip as guest
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
