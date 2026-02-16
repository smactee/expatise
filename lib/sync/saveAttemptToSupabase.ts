// lib/sync/saveAttemptToSupabase.ts
"use client";

import type { TestAttemptV1 } from "@/lib/test-engine/attemptStorage";

export async function saveAttemptToSupabase(attempt: TestAttemptV1) {
  try {
    await fetch("/api/attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // keepalive helps if user navigates immediately after submit
      keepalive: true,
      body: JSON.stringify({ attempt }),
    });
  } catch {
    // ignore (offline, blocked, etc.)
  }
}
