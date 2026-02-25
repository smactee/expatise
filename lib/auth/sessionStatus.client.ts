'use client';

import { createClient } from '@/lib/supabase/client';

export type SessionStatus =
  | { ok: false; authed: false; method: 'guest'; email: null; provider: null }
  | { ok: true; authed: true; method: 'email' | 'social'; email: string | null; provider: string | null };

function detectProvider(user: any): string | null {
  if (!user) return null;
  if (user.is_anonymous) return 'anonymous';

  const am = user.app_metadata ?? {};
  if (typeof am.provider === 'string' && am.provider) return am.provider;
  if (Array.isArray(am.providers) && am.providers.length) return am.providers[0];

  const ident = user.identities?.[0]?.provider;
  return ident ?? null;
}

export async function getSessionStatus(): Promise<SessionStatus> {
  const supabase = createClient();

  // getUser() performs a network request and returns an authentic user if a session exists
  const { data, error } = await supabase.auth.getUser();
  const user = error ? null : data.user;

  if (!user || detectProvider(user) === 'anonymous') {
    return { ok: false, authed: false, method: 'guest', email: null, provider: null };
  }

  const provider = detectProvider(user);
  const isEmail = provider === 'email' || (!!user.email && !provider);

  return {
    ok: true,
    authed: true,
    method: isEmail ? 'email' : 'social',
    email: user.email ?? null,
    provider: isEmail ? 'email' : provider,
  };
}