// lib/sync/saveTimeLogToSupabase.ts
"use client";

import type { TimeKind } from "@/lib/stats/timeKeys";
import { createClient } from "@/lib/supabase/client";

function isYmd(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function saveTimeLogToSupabase(input: {
  kind: TimeKind;
  date: string;    // "YYYY-MM-DD"
  seconds: number; // total seconds for that day+kind
}) {
  try {
    const supabase = createClient();

    // Must have a logged-in user session
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const user = userErr ? null : userData.user;
    if (!user) return;

    const kind = String(input.kind ?? "").trim();
    const date = String(input.date ?? "").trim();
    const seconds = Number(input.seconds);

    if ((kind !== "test" && kind !== "study") || !isYmd(date) || !Number.isFinite(seconds) || seconds < 0) {
      return;
    }

    const row = {
      user_id: user.id,
      date,
      kind,
      seconds: Math.floor(seconds),
      updated_at: new Date().toISOString(),
    };

    await supabase.from("time_logs").upsert(row, {
      onConflict: "user_id,date,kind",
    });
  } catch {
    // ignore (offline, blocked, etc.)
  }
}