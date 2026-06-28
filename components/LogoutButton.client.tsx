// components/LogoutButton.client.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { logout } from "@/lib/auth/logout.client";
import { notifySessionChanged } from "@/lib/auth/notifySessionChanged";
import { useT } from "@/lib/i18n/useT";

export default function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [busy, setBusy] = useState(false);
  const { t } = useT();

  const onLogout = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await supabase.auth.signOut();
      await logout();

      notifySessionChanged();
      try { window.dispatchEvent(new Event("expatise:entitlements-changed")); } catch {}

      router.refresh();
      router.replace("/login");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button className={className} onClick={onLogout} type="button" disabled={busy}>
      {busy ? t("shared.logout.loading") : t("shared.logout.idle")}
    </button>
  );
}
