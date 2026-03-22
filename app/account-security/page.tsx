// app/account-security/page.tsx
'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './account-security.module.css';
import { useAuthStatus } from '../../components/useAuthStatus';
import { createClient } from '@/lib/supabase/client';
import { isValidEmail, normalizeEmail } from '@/lib/auth';
import { buildAuthCallbackUrl } from '@/lib/auth/oauth';
import { useT } from '@/lib/i18n/useT';

export default function AccountSecurityPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { authed, method, loading, email: currentEmail } = useAuthStatus();
  const { t } = useT();

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
    if (!emailNorm) throw new Error(t('accountSecurity.messages.missingCurrentEmail'));
    const { error } = await supabase.auth.signInWithPassword({
      email: emailNorm,
      password,
    });
    if (error) throw new Error(t('accountSecurity.messages.currentPasswordIncorrect'));
  }

  async function changePassword() {
    setMsg(null);

    if (!pwCurrent || !pwNext || !pwNext2) {
      setMsg(t('accountSecurity.messages.fillAllPasswordFields'));
      return;
    }
    if (pwNext.length < 8) {
      setMsg(t('accountSecurity.messages.newPasswordMin'));
      return;
    }
    if (pwNext !== pwNext2) {
      setMsg(t('accountSecurity.messages.newPasswordsMismatch'));
      return;
    }

    setBusy(true);
    try {
      // 1) Re-auth to prove the user knows their current password
      await reauthWithCurrentPassword(pwCurrent);

      // 2) Update password
      const { error } = await supabase.auth.updateUser({ password: pwNext });
      if (error) {
        setMsg(error.message || t('accountSecurity.messages.changePasswordFailed'));
        return;
      }

      setPwCurrent('');
      setPwNext('');
      setPwNext2('');
      setMsg(t('accountSecurity.messages.passwordUpdated'));

      try { window.dispatchEvent(new Event('expatise:session-changed')); } catch {}
      try { window.dispatchEvent(new Event('expatise:entitlements-changed')); } catch {}
      router.refresh();
    } catch (e: any) {
      setMsg(e?.message ?? t('accountSecurity.messages.changePasswordFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function changeEmail() {
    setMsg(null);

    const nextNorm = normalizeEmail(emailNext);
    if (!nextNorm || !isValidEmail(nextNorm)) {
      setMsg(t('accountSecurity.messages.invalidNewEmail'));
      return;
    }
    if (!emailPw) {
      setMsg(t('accountSecurity.messages.enterCurrentPassword'));
      return;
    }

    setBusy(true);
    try {
      // 1) Re-auth
      await reauthWithCurrentPassword(emailPw);

      // 2) Update email (may require confirmation email depending on Supabase settings)
      const redirectTo = await buildAuthCallbackUrl('/profile');
      const { error } = await supabase.auth.updateUser({
        email: nextNorm,
        options: { emailRedirectTo: redirectTo },
      } as any);

      if (error) {
        setMsg(error.message || t('accountSecurity.messages.changeEmailFailed'));
        return;
      }

      setEmailNext('');
      setEmailPw('');

      // Supabase often sends a confirmation email for email change.
      setMsg(t('accountSecurity.messages.emailUpdateRequested'));

      try { window.dispatchEvent(new Event('expatise:session-changed')); } catch {}
      try { window.dispatchEvent(new Event('expatise:entitlements-changed')); } catch {}
      router.refresh();
    } catch (e: any) {
      setMsg(e?.message ?? t('accountSecurity.messages.changeEmailFailed'));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;

  if (!allowed) {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>{t('accountSecurity.pageTitle')}</h1>
          <p className={styles.text}>
            {t('accountSecurity.emailPasswordOnly')}
          </p>
          <div className={styles.row}>
            <Link className={styles.linkBtn} href="/login">
              {t('accountSecurity.goToLogin')}
            </Link>
            <Link className={styles.ghostBtn} href="/profile">
              {t('accountSecurity.profile')}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>{t('accountSecurity.title')}</h1>

        {msg && <div className={styles.msg}>{msg}</div>}

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('accountSecurity.changeEmail')}</h2>
          <input
            className={styles.input}
            placeholder={t('accountSecurity.newEmailPlaceholder')}
            value={emailNext}
            onChange={(e) => setEmailNext(e.target.value)}
          />
          <input
            className={styles.input}
            placeholder={t('accountSecurity.currentPasswordPlaceholder')}
            type="password"
            value={emailPw}
            onChange={(e) => setEmailPw(e.target.value)}
          />
          <button className={styles.primaryBtn} disabled={busy} onClick={changeEmail}>
            {t('shared.common.updateEmail')}
          </button>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('accountSecurity.changePassword')}</h2>
          <input
            className={styles.input}
            placeholder={t('accountSecurity.currentPasswordPlaceholder')}
            type="password"
            value={pwCurrent}
            onChange={(e) => setPwCurrent(e.target.value)}
          />
          <input
            className={styles.input}
            placeholder={t('accountSecurity.newPasswordPlaceholder')}
            type="password"
            value={pwNext}
            onChange={(e) => setPwNext(e.target.value)}
          />
          <input
            className={styles.input}
            placeholder={t('accountSecurity.confirmNewPasswordPlaceholder')}
            type="password"
            value={pwNext2}
            onChange={(e) => setPwNext2(e.target.value)}
          />
          <button className={styles.primaryBtn} disabled={busy} onClick={changePassword}>
            {t('shared.common.updatePassword')}
          </button>
        </section>
      </div>
    </main>
  );
}
