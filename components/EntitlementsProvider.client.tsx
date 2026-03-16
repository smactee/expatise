// components/EntitlementsProvider.client.tsx
"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { PUBLIC_FLAGS } from "@/lib/flags/public";
import {
  FREE_ENTITLEMENTS,
  type EntitlementSource,
  type Entitlements,
} from "@/lib/entitlements/types";
import {
  clearLocalEntitlements,
  getLocalEntitlements,
  setLocalEntitlements,
} from "@/lib/entitlements/localStore";
import { useUserKey } from "@/components/useUserKey.client";
import { getEntitlements } from "@/lib/entitlements/getEntitlements";

import { createClient } from "@/lib/supabase/client";

import { Capacitor } from "@capacitor/core";
import { Purchases, type CustomerInfo } from "@revenuecat/purchases-capacitor";
import { ensureRevenueCat } from "@/lib/billing/revenuecat";

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

const RC_ENTITLEMENT_ID =
  process.env.NEXT_PUBLIC_REVENUECAT_ENTITLEMENT_ID ?? "Premium";



const EntitlementsContext = createContext<EntitlementsContextValue | null>(null);

export function EntitlementsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const userKey = useUserKey();

  const [entitlements, setState] = useState<Entitlements>(() => {
    if (!PUBLIC_FLAGS.enablePremiumGates) {
      return { isPremium: true, source: "admin", updatedAt: Date.now() };
    }
    return FREE_ENTITLEMENTS;
  });

  const [loading, setLoading] = useState<boolean>(true);

  // Prevent older async refresh() calls from overwriting newer ones
  const fetchSeqRef = useRef(0);

  const demoPremium = DEMO_PREMIUM_ALL && isDemoHost();

  // RevenueCat: configure ONCE + keep a listener id so we can remove it cleanly

  const rcListenerIdRef = useRef<string | null>(null);

const ensureRevenueCatConfigured = useCallback(async () => {
  if (!Capacitor.isNativePlatform()) return false;

  // You decided: guests cannot purchase, so don’t even bind RC identity to "guest"
  if (userKey === "guest") return false;

  try {
    // Central, safe implementation:
    // - uses Purchases.isConfigured()
    // - configures once
    // - logs in when userKey changes
    return await ensureRevenueCat(userKey);
  } catch {
    return false;
  }
}, [userKey]);

useEffect(() => {
  if (!Capacitor.isNativePlatform()) return;

  // When user logs out -> reset RevenueCat identity to anonymous
  if (userKey !== "guest") return;

  void (async () => {
    try {
      const { isConfigured } = await Purchases.isConfigured();
      if (!isConfigured) return;
      await Purchases.logOut();
    } catch {
      // ignore
    }
  })();
}, [userKey]);

  function entitlementsFromCustomerInfo(customerInfo: CustomerInfo): Entitlements | null {
    const active = customerInfo?.entitlements?.active?.[RC_ENTITLEMENT_ID];
    if (!active) return null;

    // From RevenueCat docs: expirationDateMillis can be null for lifetime access.
    const expMs: number | null =
      typeof active.expirationDateMillis === "number"
        ? active.expirationDateMillis
        : null;

    const periodType = String(active.periodType ?? "").toUpperCase();
const source: EntitlementSource =
      expMs === null
        ? "lifetime"
        : periodType === "TRIAL"
        ? "trial"
        : "subscription";
    return {
      isPremium: true,
      source,
      updatedAt: Date.now(),
      ...(typeof expMs === "number" ? { expiresAt: expMs } : {}),
    };
  }

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
    let local = getLocalEntitlements(keyAtStart) ?? FREE_ENTITLEMENTS;

    // ✅ hard rule: guest is never premium
    // If you ever want to allow purchasing while logged-out, remove this block.
    if (keyAtStart === "guest" && local.isPremium) {
      clearLocalEntitlements("guest");
      local = FREE_ENTITLEMENTS;
    }

    setState(local);

    // 2) then fetch the best available truth source
    void (async () => {
      try {
        // A) Native: RevenueCat-first
        if (Capacitor.isNativePlatform()) {
          const ok = await ensureRevenueCatConfigured();
          if (seq !== fetchSeqRef.current) return;

          if (ok) {
            const { customerInfo } = await Purchases.getCustomerInfo();
            if (seq !== fetchSeqRef.current) return;

            const rcEnt = entitlementsFromCustomerInfo(customerInfo);

            if (rcEnt) {
              setLocalEntitlements(keyAtStart, rcEnt);
              setState(rcEnt);
              return; // ✅ do NOT fall through to server overwrite
            } else {
              // If local shows premium from purchase sources but RC says no, clear it.
              const current = getLocalEntitlements(keyAtStart) ?? FREE_ENTITLEMENTS;
              if (
                current.isPremium &&
                (current.source === "subscription" ||
                  current.source === "lifetime" ||
                  current.source === "trial")
              ) {
                setLocalEntitlements(keyAtStart, FREE_ENTITLEMENTS);
                setState(FREE_ENTITLEMENTS);
              }
            }
          }
        }

        // B) Fallback: your existing server entitlements
        const e = await getEntitlements(keyAtStart);

        if (seq !== fetchSeqRef.current) return;
        setLocalEntitlements(keyAtStart, e);
        setState(e);
      } catch {
        // keep local if remote fails
      } finally {
        if (seq === fetchSeqRef.current) setLoading(false);
      }
    })();
  }, [demoPremium, ensureRevenueCatConfigured, userKey]);

  // Refresh entitlements when Supabase auth session changes (login/logout/refresh)
  useEffect(() => {
    const supabase = createClient();

    const { data } = supabase.auth.onAuthStateChange(() => {
      try {
        window.dispatchEvent(new Event("expatise:session-changed"));
      } catch {}
      refresh();
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, [refresh]);

  const setEntitlements = useCallback(
    (e: Entitlements) => {
      setLocalEntitlements(userKey, e);
      setState(e);
      try {
        window.dispatchEvent(new Event("expatise:entitlements-changed"));
      } catch {}
    },
    [userKey]
  );

  const grantPremium = useCallback(
    (source: EntitlementSource, expiresAt?: number) => {
      const next: Entitlements = {
        isPremium: true,
        source,
        expiresAt,
        updatedAt: Date.now(),
      };
      setLocalEntitlements(userKey, next);
      setState(next);
      try {
        window.dispatchEvent(new Event("expatise:entitlements-changed"));
      } catch {}
    },
    [userKey]
  );

  const revokePremium = useCallback(() => {
    clearLocalEntitlements(userKey);
    setState(FREE_ENTITLEMENTS);
    try {
      window.dispatchEvent(new Event("expatise:entitlements-changed"));
    } catch {}
  }, [userKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onEntChanged = () => refresh();
    window.addEventListener("expatise:entitlements-changed", onEntChanged);
    return () =>
      window.removeEventListener("expatise:entitlements-changed", onEntChanged);
  }, [refresh]);

  // RevenueCat: listen for customerInfo updates and update entitlements cache.
  // Per purchases-capacitor API: addCustomerInfoUpdateListener returns an id, and remove uses that id.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;

    void (async () => {
      const ok = await ensureRevenueCatConfigured();
      if (!ok || cancelled) return;

      // Remove previous listener (if any) before adding a new one
      if (rcListenerIdRef.current) {
        try {
          await Purchases.removeCustomerInfoUpdateListener({
            listenerToRemove: rcListenerIdRef.current,
          });
        } catch {}
        rcListenerIdRef.current = null;
      }

      const id = await Purchases.addCustomerInfoUpdateListener((customerInfo) => {
        const rcEnt = entitlementsFromCustomerInfo(customerInfo);
        if (rcEnt) {
          setLocalEntitlements(userKey, rcEnt);
          setState(rcEnt);
          try {
            window.dispatchEvent(new Event("expatise:entitlements-changed"));
          } catch {}
          return;
        }

        // If RevenueCat reports no active entitlement, clear purchase-based premium locally.
        const current = getLocalEntitlements(userKey) ?? FREE_ENTITLEMENTS;
        if (
          current.isPremium &&
          (current.source === "subscription" ||
            current.source === "lifetime" ||
            current.source === "trial")
        ) {
          setLocalEntitlements(userKey, FREE_ENTITLEMENTS);
          setState(FREE_ENTITLEMENTS);
          try {
            window.dispatchEvent(new Event("expatise:entitlements-changed"));
          } catch {}
        }
      });

      rcListenerIdRef.current = id;
    })();

    return () => {
      cancelled = true;
      const id = rcListenerIdRef.current;
      if (!id) return;

      rcListenerIdRef.current = null;
      void (async () => {
        try {
          await Purchases.removeCustomerInfoUpdateListener({ listenerToRemove: id });
        } catch {}
      })();
    };
  }, [ensureRevenueCatConfigured, userKey]);

  const value = useMemo<EntitlementsContextValue>(
    () => ({
      userKey,
      entitlements,
      isPremium: entitlements.isPremium,
      loading,
      refresh,
      setEntitlements,
      grantPremium,
      revokePremium,
    }),
    [
      userKey,
      entitlements,
      loading,
      refresh,
      setEntitlements,
      grantPremium,
      revokePremium,
    ]
  );

  return (
    <EntitlementsContext.Provider value={value}>{children}</EntitlementsContext.Provider>
  );
}

export function useEntitlements() {
  const ctx = useContext(EntitlementsContext);
  if (!ctx)
    throw new Error("useEntitlements must be used inside <EntitlementsProvider>");
  return ctx;
}
