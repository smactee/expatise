"use client";

import { useEffect } from "react";
import { safeNextPath } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";

const OAUTH_NEXT_KEY = "expatise:oauth:next";

export default function CapacitorOAuthBridge() {
  useEffect(() => {
    let removeListener: null | (() => void) = null;

    (async () => {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform()) return;

      const { App } = await import("@capacitor/app");
      const { Browser } = await import("@capacitor/browser");

      const supabase = createClient();

      const handleUrl = async (url?: string) => {
        if (!url) return;

       // Only handle OAuth returns with PKCE code
let parsed: URL;
try {
  parsed = new URL(url);
} catch {
  return;
}

const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ""));
const pickParam = (name: string) =>
  parsed.searchParams.get(name) ?? hashParams.get(name);

const err =
  pickParam("error_description") ??
  pickParam("error");

if (err) {
  await Browser.close().catch(() => {});
  window.location.replace("/login?error=oauth");
  return;
}

const code = pickParam("code");
const accessToken = pickParam("access_token");
const refreshToken = pickParam("refresh_token");
if (!code && !(accessToken && refreshToken)) return;

try {
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
  } else {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken!,
      refresh_token: refreshToken!,
    });
    if (error) throw error;
  }
  await Browser.close().catch(() => {});

  try { window.dispatchEvent(new Event("expatise:session-changed")); } catch {}
  try { window.dispatchEvent(new Event("expatise:entitlements-changed")); } catch {}

  const nextFromUrl = safeNextPath(pickParam("next"), "");
  const nextFromStorage = safeNextPath(localStorage.getItem(OAUTH_NEXT_KEY), "/");
  const next = nextFromUrl || nextFromStorage || "/";
  localStorage.removeItem(OAUTH_NEXT_KEY);
  window.location.replace(next);
} catch (e: unknown) {
  await Browser.close().catch(() => {});
  window.location.replace("/login?error=oauth");
}};

      // ✅ Case A: app already running and receives deep link
      const sub = await App.addListener("appUrlOpen", async ({ url }) => {
        await handleUrl(url);
      });
      removeListener = () => sub.remove();

      // ✅ Case B: cold start (app launched by the deep link)
      const launch = await App.getLaunchUrl();
      if (launch?.url) {
        await handleUrl(launch.url);
      }
    })();

    return () => {
      removeListener?.();
    };
  }, []);

  return null;
}
