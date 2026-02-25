'use client';

import type { TestAttemptV1 } from '@/lib/test-engine/attemptStorage';
import { createClient } from '@/lib/supabase/client';

export async function fetchAttemptsFromSupabase(input: {
  datasetId?: string;
  status?: string; // default "submitted"
  limit?: number;  // default 200, clamped to 1..500
}): Promise<TestAttemptV1[] | null> {
  try {
    const supabase = createClient();

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const user = userErr ? null : userData.user;
    if (!user) return null;

    const datasetId = (input.datasetId ?? '').trim();
    const status = (input.status ?? 'submitted').trim() || 'submitted';
    const limit = Math.min(500, Math.max(1, Number(input.limit ?? 200)));

    let q = supabase
      .from('attempts')
      .select('payload, submitted_at_ms, last_active_at_ms, created_at_ms, attempt_id')
      .eq('user_id', user.id)
      .eq('status', status)
      .order('submitted_at_ms', { ascending: false })
      .limit(limit);

    if (datasetId) q = q.eq('dataset_id', datasetId);

    const { data, error } = await q;
    if (error) return null;

    return (data ?? []).map((r: any) => r.payload).filter(Boolean) as TestAttemptV1[];
  } catch {
    return null;
  }
}