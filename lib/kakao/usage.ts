// lib/kakao/usage.ts
//
// Central, app-wide daily usage counter for Kakao APIs, enforced in Supabase
// (static export = no Next server runtime, and a per-device localStorage counter
// can't protect an app-wide quota). The atomic RPC increment_kakao_usage()
// computes "today" in Asia/Seoul server-side so the reset matches Kakao's
// midnight-KST reset regardless of device clock or timezone.
//
// Best-effort guard against YOUR OWN overage — not tamper-proof.

import { createClient } from '@/lib/supabase/client';

export type KakaoUsageCategory = 'local' | 'map';

// Daily caps = floor(freeQuota * 0.99). Re-confirm the raw free quotas against
// the Kakao console: 통계 → 쿼터 (they can differ from the standard free tier).
const LOCAL_API_FREE_QUOTA = 100_000; // Local API (geocoding / place search) — RE-CONFIRM in console
const MAP_API_FREE_QUOTA = 300_000; //   Map API (map display)              — RE-CONFIRM in console

export const LOCAL_API_DAILY_CAP = Math.floor(LOCAL_API_FREE_QUOTA * 0.99); // 99_000
export const MAP_API_DAILY_CAP = Math.floor(MAP_API_FREE_QUOTA * 0.99); //    297_000

// Soft heads-up threshold for the (un-blockable) map-display monitor.
const MAP_API_WARN_AT = Math.floor(MAP_API_FREE_QUOTA * 0.9); // 270_000

export const DAILY_CAP: Record<KakaoUsageCategory, number> = {
  local: LOCAL_API_DAILY_CAP,
  map: MAP_API_DAILY_CAP,
};

/**
 * Atomically count one call against today's (KST) quota for `category` and
 * return the NEW count. Returns null if the counter is unreachable — callers
 * decide their own fail-open/closed policy.
 */
export async function incrementKakaoUsage(category: KakaoUsageCategory): Promise<number | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('increment_kakao_usage', { p_category: category });
    if (error) {
      console.error('[Kakao usage] increment failed:', error.message);
      return null;
    }
    const count = typeof data === 'number' ? data : Number(data);
    return Number.isFinite(count) ? count : null;
  } catch (err) {
    console.error('[Kakao usage] increment threw:', err);
    return null;
  }
}

/**
 * Map display is a SOFT monitor: count once per map instantiation, never block
 * render on it. Logs a heads-up as usage approaches the cap. Fire-and-forget;
 * never throws.
 */
export function monitorMapUsage(): void {
  void incrementKakaoUsage('map').then((count) => {
    if (count == null) return;
    if (count >= MAP_API_DAILY_CAP) {
      console.error(`[Kakao usage] MAP display at/over cap: ${count}/${MAP_API_DAILY_CAP} (KST day).`);
    } else if (count >= MAP_API_WARN_AT) {
      const pct = Math.round((count / MAP_API_DAILY_CAP) * 100);
      console.warn(`[Kakao usage] MAP display at ${count}/${MAP_API_DAILY_CAP} (~${pct}%).`);
    }
  });
}
