//components/EntitlementsDebugBadge.client.tsx

"use client";

import { useEntitlements } from "@/components/EntitlementsProvider.client";

export default function EntitlementsDebugBadge() {
  const { userKey, entitlements, isPremium } = useEntitlements();

  if (process.env.NODE_ENV !== "development") return null;

  return (
    <div style={{
      position: "fixed",
      bottom: 80,
      right: 12,
      background: "rgba(0,0,0,0.7)",
      color: "white",
      padding: "8px 10px",
      borderRadius: 10,
      fontSize: 12,
      zIndex: 9999,
      maxWidth: 260,
      lineHeight: 1.3,
    }}>
      <div><b>userKey:</b> {userKey}</div>
      <div><b>premium:</b> {String(isPremium)} ({entitlements.source})</div>
      {entitlements.expiresAt ? (
        <div><b>expires:</b> {new Date(entitlements.expiresAt).toLocaleString()}</div>
      ) : null}
    </div>
  );
}
