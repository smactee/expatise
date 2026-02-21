//components/EntitlementsProvider.client.tsx
"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { PUBLIC_FLAGS } from "@/lib/flags/public";
import { FREE_ENTITLEMENTS, type EntitlementSource, type Entitlements } from "@/lib/entitlements/types";
import { getLocalEntitlements, setLocalEntitlements, clearLocalEntitlements } from "@/lib/entitlements/localStore";
import { useUserKey } from "@/components/useUserKey.client";
import { getEntitlements } from "@/lib/entitlements/getEntitlements";


type EntitlementsContextValue = {
  userKey: string; // for now "guest" (we’ll upgrade to real user scoping later)
  entitlements: Entitlements;
  isPremium: boolean;
  loading: boolean;
  refresh: () => void;
  setEntitlements: (e: Entitlements) => void;
  grantPremium: (source: EntitlementSource, expiresAt?: number) => void;
  revokePremium: () => void;
};

const DEMO_PREMIUM_ALL = (process.env.NEXT_PUBLIC_DEMO_SEED_ALL ?? "") === "1";

function isDemoHost() {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h.endsWith(".vercel.app");
}

const EntitlementsContext = createContext<EntitlementsContextValue | null>(null);

export function EntitlementsProvider({ children }: { children: React.ReactNode }) {
  // ✅ for now everyone is "guest". We'll swap this to real userKey in the Identity step.
  const userKey = useUserKey();

  const [entitlements, setState] = useState<Entitlements>(() => {
    if (!PUBLIC_FLAGS.enablePremiumGates) {
      return { isPremium: true, source: "admin", updatedAt: Date.now() };
    }
    return FREE_ENTITLEMENTS;
  });

  const [loading, setLoading] = useState<boolean>(true);
const fetchSeqRef = useRef(0);

const demoPremium = DEMO_PREMIUM_ALL && isDemoHost();

const refresh = useCallback(() => {
  if (!PUBLIC_FLAGS.enablePremiumGates) {
    setState({ isPremium: true, source: "admin", updatedAt: Date.now() });
    setLoading(false);
    return;
  }
if (demoPremium) {
  setState({ isPremium: true, source: "demo", updatedAt: Date.now() });
  setLoading(false);
  return;
}

  // increment request id so older async results can't overwrite newer userKey
  const seq = ++fetchSeqRef.current;

  setLoading(true);

  const keyAtStart = userKey;

  // 1) apply local immediately (fast)
  const local = getLocalEntitlements(keyAtStart) ?? FREE_ENTITLEMENTS;
  setState(local);

  // 2) then fetch remote (authoritative)
  void (async () => {
    try {
      const e = await getEntitlements(keyAtStart);

      // ignore stale result if a newer refresh started
      if (seq !== fetchSeqRef.current) return;

      // optional but recommended: persist remote result so next refresh is instant
      setLocalEntitlements(keyAtStart, e);
      setState(e);
    } catch {
      // keep local if remote fails
    } finally {
      if (seq === fetchSeqRef.current) setLoading(false);
    }
  })();
}, [userKey, demoPremium]);


  const setEntitlements = useCallback((e: Entitlements) => {
    setLocalEntitlements(userKey, e);
    setState(e);
    try { window.dispatchEvent(new Event("expatise:entitlements-changed")); } catch {}
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
    try { window.dispatchEvent(new Event("expatise:entitlements-changed")); } catch {}
  }, [userKey]);

  const revokePremium = useCallback(() => {
    clearLocalEntitlements(userKey);
    setState(FREE_ENTITLEMENTS);
    try { window.dispatchEvent(new Event("expatise:entitlements-changed")); } catch {}
  }, [userKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

useEffect(() => {
  const onEntChanged = () => refresh();
  window.addEventListener("expatise:entitlements-changed", onEntChanged);
  return () => window.removeEventListener("expatise:entitlements-changed", onEntChanged);
}, [refresh]);

useEffect(() => {
  const onSessionChanged = () => refresh();
  window.addEventListener("expatise:session-changed", onSessionChanged);
  return () => window.removeEventListener("expatise:session-changed", onSessionChanged);
}, [refresh]);


  const value = useMemo<EntitlementsContextValue>(() => ({
    userKey,
    entitlements,
    isPremium: entitlements.isPremium,
    loading,
    refresh,
    setEntitlements,
    grantPremium,
    revokePremium,
  }), [userKey, entitlements, loading, refresh, setEntitlements, grantPremium, revokePremium]);

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
