"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();

  const onLogout = async () => {
    await fetch("/api/logout", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    });

    // ✅ tell the rest of the app "session changed"
    try { window.dispatchEvent(new Event("expatise:session-changed")); } catch {}

    // Optional: if anything listens to this specifically
    try { window.dispatchEvent(new Event("expatise:entitlements-changed")); } catch {}

    // ✅ force App Router to re-evaluate cookie-based server state
    router.refresh();
    router.replace("/login");
  };

  return (
    <button className={className} onClick={onLogout} type="button">
      Log out
    </button>
  );
}