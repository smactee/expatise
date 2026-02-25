'use client';

import { createClient } from '@/lib/supabase/client';

type GetAttemptsArgs = {
  datasetId?: string;
  status?: string; // default submitted
  limit?: number;  // default 200, clamp 1..500
};

export async function getAttempts(args: GetAttemptsArgs = {}) {
  const supabase = createClient();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  const user = userErr ? null : userData.user;
  if (!user) return { ok: false as const, error: 'No user session', status: 401 as const };

  const datasetId = (args.datasetId ?? '').trim();
  const status = (args.status ?? 'submitted').trim();
  const limit = Math.min(500, Math.max(1, Number(args.limit ?? 200)));

  let q = supabase
    .from('attempts')
    .select('payload, submitted_at_ms, last_active_at_ms, created_at_ms, attempt_id')
    .eq('user_id', user.id)
    .eq('status', status)
    .order('submitted_at_ms', { ascending: false })
    .limit(limit);

  if (datasetId) q = q.eq('dataset_id', datasetId);

  const { data, error } = await q;
  if (error) return { ok: false as const, step: 'select', error: error.message, status: 400 as const };

  const attempts = (data ?? [])
    .map((r: any) => r.payload)
    .filter(Boolean);

  return { ok: true as const, attempts };
}

export async function upsertAttempt(attempt: any) {
  const supabase = createClient();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  const user = userErr ? null : userData.user;
  if (!user) return { ok: false as const, error: 'No user session', status: 401 as const };

  if (!attempt?.attemptId || !attempt?.modeKey || !attempt?.status) {
    return { ok: false as const, error: 'Missing required attempt fields', status: 400 as const };
  }

  const row = {
    user_id: user.id,

    attempt_id: attempt.attemptId,
    user_key: attempt.userKey ?? 'guest',
    schema_version: attempt.schemaVersion ?? 1,

    mode_key: attempt.modeKey,
    dataset_id: attempt.datasetId ?? null,
    dataset_version: attempt.datasetVersion ?? null,

    status: attempt.status,

    created_at_ms: attempt.createdAt ?? null,
    last_active_at_ms: attempt.lastActiveAt ?? null,
    submitted_at_ms: attempt.submittedAt ?? null,

    payload: attempt,
  };

  const { error: upsertErr } = await supabase
    .from('attempts')
    .upsert(row, { onConflict: 'user_id,attempt_id' });

  if (upsertErr) return { ok: false as const, step: 'upsert', error: upsertErr.message, status: 400 as const };

  return { ok: true as const };
}