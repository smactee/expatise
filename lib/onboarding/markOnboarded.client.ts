"use client";

import { ONBOARDING_COOKIE } from "@/lib/middleware/paths";

const LS_KEY = "expatise:onboarded";

export function markOnboarded() {
  // 1) LocalStorage (works great in Capacitor)
  try {
    localStorage.setItem(LS_KEY, "1");
  } catch {}

  // 2) Cookie (optional, keeps old behavior)
  // max-age is in SECONDS
  const oneYearSec = 60 * 60 * 24 * 365;
  document.cookie = `${ONBOARDING_COOKIE}=1; Max-Age=${oneYearSec}; Path=/; SameSite=Lax`;
}

export function isOnboarded(): boolean {
  try {
    if (localStorage.getItem(LS_KEY) === "1") return true;
  } catch {}

  // cookie fallback
  return typeof document !== "undefined" && document.cookie.includes(`${ONBOARDING_COOKIE}=1`);
}