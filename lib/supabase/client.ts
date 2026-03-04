// lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";
import { createClient as createSupabaseClient, processLock } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";

let webClient: ReturnType<typeof createBrowserClient> | null = null;
let nativeClient: ReturnType<typeof createSupabaseClient> | null = null;

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)"
    );
  }

  const isNative =
    typeof window !== "undefined" && Capacitor.isNativePlatform();

  // ✅ Native (Capacitor): use supabase-js directly + processLock
  if (isNative) {
    if (nativeClient) return nativeClient;

    nativeClient = createSupabaseClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,

        // ✅ You’re handling OAuth return via deep link + exchangeCodeForSession
        detectSessionInUrl: false,

        flowType: "pkce",
        storageKey: "sb-expatise-auth",

        // ✅ Avoid "Navigator LockManager lock timed out" on Android/Chrome/WebView
        lock: processLock,
      },
    });

    return nativeClient;
  }

  // ✅ Web: keep @supabase/ssr browser client, but ALSO use processLock
  if (webClient) return webClient;

  webClient = createBrowserClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
      storageKey: "sb-expatise-auth",

      // ✅ same lock fix for Android emulator Chrome browser too
      lock: processLock,
    },
  });

  return webClient;
}