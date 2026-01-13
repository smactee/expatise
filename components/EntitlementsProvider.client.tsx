"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { PUBLIC_FLAGS } from "@/lib/flags/public";
import { FREE_ENTITLEMENTS, type EntitlementSource, type Entitlements } from "@/lib/entitlements/types";
import { getLocalEntitlements, setLocalEntitlements, clearLocalEntitlements } from "@/lib/entitlements/localStore";

type EntitlementsContextValue = {
  userKey: string; // for now "guest" (we’ll upgrade to real user scoping later)
  entitlements: Entitlements;
  isPremium: boolean;
  refresh: () => void;
  setEntitlements: (e: Entitlements) => void;
  grantPremium: (source: EntitlementSource, expiresAt?: number) => void;
  revokePremium: () => void;
};

const EntitlementsContext = createContext<EntitlementsContextValue | null>(null);

export function EntitlementsProvider({ children }: { children: React.ReactNode }) {
  // ✅ for now everyone is "guest". We'll swap this to real userKey in the Identity step.
  const userKey = "guest";

  const [entitlements, setState] = useState<Entitlements>(() => {
    if (!PUBLIC_FLAGS.enablePremiumGates) {
      return { isPremium: true, source: "admin", updatedAt: Date.now() };
    }
    return FREE_ENTITLEMENTS;
  });

  const refresh = useCallback(() => {
    if (!PUBLIC_FLAGS.enablePremiumGates) {
      setState({ isPremium: true, source: "admin", updatedAt: Date.now() });
      return;
    }
    const local = getLocalEntitlements(userKey);
    setState(local);
  }, [userKey]);

  const setEntitlements = useCallback((e: Entitlements) => {
    setLocalEntitlements(userKey, e);
    setState(e);
  }, [userKey]);

  const grantPremium = useCallback((source: EntitlementSource, expiresAt?: number) => {
    const next: Entitlements = {
      isPremium: true,
      source,
      expiresAt,
      updatedAt: Date.now(),
    };
    setLocalEntitlements(userKey, next);
    setState(next);
  }, [userKey]);

  const revokePremium = useCallback(() => {
    clearLocalEntitlements(userKey);
    setState(FREE_ENTITLEMENTS);
  }, [userKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo<EntitlementsContextValue>(() => ({
    userKey,
    entitlements,
    isPremium: entitlements.isPremium,
    refresh,
    setEntitlements,
    grantPremium,
    revokePremium,
  }), [userKey, entitlements, refresh, setEntitlements, grantPremium, revokePremium]);

  return (
    <EntitlementsContext.Provider value={value}>
      {children}
    </EntitlementsContext.Provider>
  );
}

export function useEntitlements() {
  const ctx = useContext(EntitlementsContext);
  if (!ctx) throw new Error("useEntitlements must be used inside <EntitlementsProvider>");
  return ctx;
}
