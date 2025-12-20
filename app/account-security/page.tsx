'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './account-security.module.css';
import { useAuthStatus } from '../../components/useAuthStatus';

export default function AccountSecurityPage() {
  const router = useRouter();
  const { authed, method, loading } = useAuthStatus();

  const allowed = useMemo(() => authed && method === 'email', [authed, method]);

  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNext, setPwNext] = useState('');
  const [pwNext2, setPwNext2] = useState('');

  const [emailNext, setEmailNext] = useState('');
  const [emailPw, setEmailPw] = useState('');

  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function changePassword() {
    setMsg(null);

    if (!pwCurrent || !pwNext || !pwNext2) {
      setMsg('Please fill all password fields.');
      return;
    }
    if (pwNext !== pwNext2) {
      setMsg('New passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/account/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: pwCurrent,
          newPassword: pwNext,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMsg(data?.error ?? 'Failed to change password.');
        return;
      }

      setPwCurrent('');
      setPwNext('');
      setPwNext2('');
      setMsg('Password updated.');
    } finally {
      setBusy(false);
    }
  }

  async function changeEmail() {
    setMsg(null);

    if (!emailNext || !emailPw) {
      setMsg('Please enter your new email and password.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/account/change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newEmail: emailNext,
          password: emailPw,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMsg(data?.error ?? 'Failed to change email.');
        return;
      }

      setEmailNext('');
      setEmailPw('');
      setMsg('Email updated.');
      // optional: send user back to profile
      // router.push('/profile');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;

  if (!allowed) {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>Account Security</h1>
          <p className={styles.text}>
            This page is only available for accounts created with Email + Password.
          </p>
          <div className={styles.row}>
            <Link className={styles.linkBtn} href="/login">
              Go to login
            </Link>
            <button className={styles.ghostBtn} onClick={() => router.back()}>
              Back
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <button className={styles.backBtn} onClick={() => router.back()}>
          ‹ Back
        </button>

        <h1 className={styles.title}>Change Email / Password</h1>

        {msg && <div className={styles.msg}>{msg}</div>}

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Change Email</h2>
          <input
            className={styles.input}
            placeholder="New email"
            value={emailNext}
            onChange={(e) => setEmailNext(e.target.value)}
          />
          <input
            className={styles.input}
            placeholder="Current password"
            type="password"
            value={emailPw}
            onChange={(e) => setEmailPw(e.target.value)}
          />
          <button className={styles.primaryBtn} disabled={busy} onClick={changeEmail}>
            Update Email
          </button>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Change Password</h2>
          <input
            className={styles.input}
            placeholder="Current password"
            type="password"
            value={pwCurrent}
            onChange={(e) => setPwCurrent(e.target.value)}
          />
          <input
            className={styles.input}
            placeholder="New password"
            type="password"
            value={pwNext}
            onChange={(e) => setPwNext(e.target.value)}
          />
          <input
            className={styles.input}
            placeholder="Confirm new password"
            type="password"
            value={pwNext2}
            onChange={(e) => setPwNext2(e.target.value)}
          />
          <button className={styles.primaryBtn} disabled={busy} onClick={changePassword}>
            Update Password
          </button>
        </section>
      </div>
    </main>
  );
}
