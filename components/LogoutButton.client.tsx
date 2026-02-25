// components/LogoutButton.client.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { logout } from "@/lib/auth/logout.client";

export default function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [busy, setBusy] = useState(false);

  const onLogout = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await supabase.auth.signOut();
      await logout();

      try { window.dispatchEvent(new Event("expatise:session-changed")); } catch {}
      try { window.dispatchEvent(new Event("expatise:entitlements-changed")); } catch {}

      router.refresh();
      router.replace("/login");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button className={className} onClick={onLogout} type="button" disabled={busy}>
      {busy ? "Logging out..." : "Log out"}
    </button>
  );
}