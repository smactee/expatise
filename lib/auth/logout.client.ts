'use client';

import { createClient } from '@/lib/supabase/client';

export async function logout() {
  const supabase = createClient();

  // Browser logout: clears stored auth data + triggers SIGNED_OUT
  const { error } = await supabase.auth.signOut();
  if (error) throw error;

  return { ok: true as const };
}