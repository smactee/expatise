// lib/sync/saveAttemptToSupabase.ts
"use client";

import type { TestAttemptV1 } from "@/lib/test-engine/attemptStorage";
import { createClient } from "@/lib/supabase/client";

export async function saveAttemptToSupabase(attempt: TestAttemptV1) {
  try {
    const supabase = createClient();

    // Must have a logged-in user session
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const user = userErr ? null : userData.user;
    if (!user) return;

    // Keep the same required fields as your old API route
    if (!attempt?.attemptId || !attempt?.modeKey || !attempt?.status) return;

    const row = {
      user_id: user.id,

      attempt_id: attempt.attemptId,
      user_key: attempt.userKey ?? "guest",
      schema_version: attempt.schemaVersion ?? 1,

      mode_key: attempt.modeKey,
      dataset_id: attempt.datasetId ?? null,
      dataset_version: attempt.datasetVersion ?? null,

      status: attempt.status,

      // These may not be in TestAttemptV1's typing; keep them safely
      created_at_ms: (attempt as any).createdAt ?? null,
      last_active_at_ms: (attempt as any).lastActiveAt ?? null,
      submitted_at_ms: (attempt as any).submittedAt ?? null,

      payload: attempt,
    };

    // Mirrors your server route:
    // upsert(row, { onConflict: "user_id,attempt_id" })
    await supabase.from("attempts").upsert(row, {
      onConflict: "user_id,attempt_id",
    });
    // Supabase upsert + onConflict is the documented way to do this.
  } catch {
    // ignore (offline, blocked, etc.)
  }
}