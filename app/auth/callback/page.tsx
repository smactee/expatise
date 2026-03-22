//app/auth/callback/page.tsx
'use client';

import { useEffect, useState } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useT } from '@/lib/i18n/useT';

function safeNextPathClient(nextRaw: string | null | undefined, fallback = '/') {
  const v = String(nextRaw ?? '').trim();
  if (!v) return fallback;
  if (!v.startsWith('/')) return fallback;
  if (v.startsWith('//')) return fallback;
  if (v.includes('://')) return fallback;
  return v;
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const { t } = useT();
  const [msg, setMsg] = useState(t('authCallback.completing'));

  useEffect(() => {
    const supabase = createClient();
    const url = new URL(window.location.href);

    const next = safeNextPathClient(url.searchParams.get('next'), '/');

    // If provider sent an error back
    const err = url.searchParams.get('error_description') ?? url.searchParams.get('error');
    if (err) {
      setMsg(t('authCallback.failed', { reason: decodeURIComponent(err) }));
      return;
    }

    let done = false;

    const finish = async () => {
      if (done) return;
      done = true;

      try { window.dispatchEvent(new Event('expatise:session-changed')); } catch {}
      try { window.dispatchEvent(new Event('expatise:entitlements-changed')); } catch {}

      // Clean URL (optional)
      try { window.history.replaceState({}, '', next); } catch {}

      router.refresh();
      router.replace(next);
    };

    // ✅ Wait for Supabase to finish auto-exchange (detectSessionInUrl=true does it)
    const { data } = supabase.auth.onAuthStateChange(
  (_evt: AuthChangeEvent, session: Session | null) => {
    if (session) finish();
  }
);

    // Also handle the case where the session is already ready
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (s.session) finish();
    })();

    // Safety timeout so you see a useful message instead of silently landing as guest
    const timeoutId = window.setTimeout(async () => {
      if (done) return;
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) {
        setMsg(t('authCallback.noSession'));
      }
    }, 5000);

    return () => {
      window.clearTimeout(timeoutId);
      data.subscription.unsubscribe();
    };
  }, [router, t]);

  return <div style={{ padding: 16 }}>{msg}</div>;
}
