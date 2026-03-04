//app/auth/callback/page.tsx
'use client';

import { useEffect, useState } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

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
  const [msg, setMsg] = useState('Completing sign-in…');

  useEffect(() => {
    const supabase = createClient();
    const url = new URL(window.location.href);

    const next = safeNextPathClient(url.searchParams.get('next'), '/');

    // If provider sent an error back
    const err = url.searchParams.get('error_description') ?? url.searchParams.get('error');
    if (err) {
      setMsg(`Sign-in failed: ${decodeURIComponent(err)}`);
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
    const t = window.setTimeout(async () => {
      if (done) return;
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) {
        setMsg('Sign-in failed: no session created. (Likely PKCE storage mismatch or blocked callback.)');
      }
    }, 5000);

    return () => {
      window.clearTimeout(t);
      data.subscription.unsubscribe();
    };
  }, [router]);

  return <div style={{ padding: 16 }}>{msg}</div>;
}