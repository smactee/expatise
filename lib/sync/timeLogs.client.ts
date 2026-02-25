'use client';

import { createClient } from '@/lib/supabase/client';

export type TimeLogKind = 'test' | 'study';
export type TimeLogRow = { date: string; kind: TimeLogKind; seconds: number };

function isYmd(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function fetchTimeLogsFromSupabase(input?: { limit?: number }) {
  try {
    const supabase = createClient();

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const user = userErr ? null : userData.user;
    if (!user) return null;

    const limit = Math.min(400, Math.max(1, Number(input?.limit ?? 200)));

    const { data, error } = await supabase
      .from('time_logs')
      .select('date, kind, seconds')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(limit);

    if (error) return null;
    return (data ?? []) as TimeLogRow[];
  } catch {
    return null;
  }
}

export async function upsertTimeLogToSupabase(input: {
  kind: TimeLogKind;
  date: string; // YYYY-MM-DD
  seconds: number;
}) {
  try {
    const supabase = createClient();

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const user = userErr ? null : userData.user;
    if (!user) return { ok: false as const, error: 'No user session' };

    const kind = String(input.kind ?? '').trim() as TimeLogKind;
    const date = String(input.date ?? '').trim();
    const seconds = Number(input.seconds);

    if ((kind !== 'test' && kind !== 'study') || !isYmd(date) || !Number.isFinite(seconds) || seconds < 0) {
      return { ok: false as const, error: 'Invalid payload' };
    }

    const row = {
      user_id: user.id,
      date,
      kind,
      seconds: Math.floor(seconds),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('time_logs').upsert(row, {
      onConflict: 'user_id,date,kind',
    });

    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  } catch (e: any) {
    return { ok: false as const, error: String(e?.message ?? e) };
  }
}