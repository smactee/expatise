// lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // ✅ use ONE key

  if (!url || !anon) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  browserClient = createBrowserClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
      // optional but helps prevent weird collisions if you ever change project URLs
      storageKey: "sb-expatise-auth",
    },
  });

  return browserClient;
}
