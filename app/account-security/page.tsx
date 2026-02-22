// app/account-security/page.tsx
'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './account-security.module.css';
import { useAuthStatus } from '../../components/useAuthStatus';
import BackButton from '../../components/BackButton';
import { createClient } from '@/lib/supabase/client';
import { isValidEmail, normalizeEmail } from '@/lib/auth';

export default function AccountSecurityPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { authed, method, loading, email: currentEmail } = useAuthStatus();

  // Only allow email/password accounts here
  const allowed = useMemo(() => authed && method === 'email', [authed, method]);

  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNext, setPwNext] = useState('');
  const [pwNext2, setPwNext2] = useState('');

  const [emailNext, setEmailNext] = useState('');
  const [emailPw, setEmailPw] = useState('');

  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reauthWithCurrentPassword(password: string) {
    const emailNorm = normalizeEmail(currentEmail ?? '');
    if (!emailNorm) throw new Error('Missing current email.');
    const { error } = await supabase.auth.signInWithPassword({
      email: emailNorm,
      password,
    });
    if (error) throw new Error('Current password is incorrect.');
  }

  async function changePassword() {
    setMsg(null);

    if (!pwCurrent || !pwNext || !pwNext2) {
      setMsg('Please fill all password fields.');
      return;
    }
    if (pwNext.length < 8) {
      setMsg('New password must be at least 8 characters.');
      return;
    }
    if (pwNext !== pwNext2) {
      setMsg('New passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      // 1) Re-auth to prove the user knows their current password
      await reauthWithCurrentPassword(pwCurrent);

      // 2) Update password
      const { error } = await supabase.auth.updateUser({ password: pwNext });
      if (error) {
        setMsg(error.message || 'Failed to change password.');
        return;
      }

      setPwCurrent('');
      setPwNext('');
      setPwNext2('');
      setMsg('Password updated.');

      try { window.dispatchEvent(new Event('expatise:session-changed')); } catch {}
      try { window.dispatchEvent(new Event('expatise:entitlements-changed')); } catch {}
      router.refresh();
    } catch (e: any) {
      setMsg(e?.message ?? 'Failed to change password.');
    } finally {
      setBusy(false);
    }
  }

  async function changeEmail() {
    setMsg(null);

    const nextNorm = normalizeEmail(emailNext);
    if (!nextNorm || !isValidEmail(nextNorm)) {
      setMsg('Please enter a valid new email.');
      return;
    }
    if (!emailPw) {
      setMsg('Please enter your current password.');
      return;
    }

    setBusy(true);
    try {
      // 1) Re-auth
      await reauthWithCurrentPassword(emailPw);

      // 2) Update email (may require confirmation email depending on Supabase settings)
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent('/profile')}`;
      const { error } = await supabase.auth.updateUser({
        email: nextNorm,
        options: { emailRedirectTo: redirectTo },
      } as any);

      if (error) {
        setMsg(error.message || 'Failed to change email.');
        return;
      }

      setEmailNext('');
      setEmailPw('');

      // Supabase often sends a confirmation email for email change.
      setMsg('Email update requested. Please check your email to confirm the change.');

      try { window.dispatchEvent(new Event('expatise:session-changed')); } catch {}
      try { window.dispatchEvent(new Event('expatise:entitlements-changed')); } catch {}
      router.refresh();
    } catch (e: any) {
      setMsg(e?.message ?? 'Failed to change email.');
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
        <BackButton />

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