'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Client-safe version of your safeNextPath()
// Only allow same-site relative paths like "/stats".
// Anything else falls back to "/".
function safeNextPathClient(nextRaw: string | null | undefined, fallback = '/') {
  const v = String(nextRaw ?? '').trim();
  if (!v) return fallback;
  if (!v.startsWith('/')) return fallback;
  if (v.startsWith('//')) return fallback; // protocol-relative
  if (v.includes('://')) return fallback; // absolute URL
  return v;
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const [msg, setMsg] = useState('Completing sign-in…');

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const supabase = createClient();

        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        const nextRaw = url.searchParams.get('next');
        const next = safeNextPathClient(nextRaw, '/');

        // In PKCE, Supabase redirects back with ?code=...
        // Exchange it for a session on the client.
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            if (!alive) return;
            setMsg(`Sign-in failed: ${error.message}`);
            return;
          }
        }

        // Optional: clean URL params (purely cosmetic)
        try {
          window.history.replaceState({}, '', next);
        } catch {}

        router.replace(next);
      } catch (e: any) {
        if (!alive) return;
        setMsg(`Sign-in failed: ${e?.message ?? 'Unknown error'}`);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  return <div style={{ padding: 16 }}>{msg}</div>;
}