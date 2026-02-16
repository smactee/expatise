// lib/sync/saveTimeLogToSupabase.ts
"use client";

import type { TimeKind } from "@/lib/stats/timeKeys";

export async function saveTimeLogToSupabase(input: {
  kind: TimeKind;
  date: string;    // "YYYY-MM-DD"
  seconds: number; // total seconds for that day+kind
}) {
  try {
    await fetch("/api/time-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify(input),
    });
  } catch {
    // ignore (offline, blocked, etc.)
  }
}
