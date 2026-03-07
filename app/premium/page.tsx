// app/premium/page.tsx
"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import styles from "./premium.module.css";
import { PLAN_LIST, type PlanId } from "../../lib/plans";
import BackButton from "@/components/BackButton";
import { Capacitor } from "@capacitor/core";
import {
  Purchases,
  type CustomerInfo,
  type PurchasesPackage,
} from "@revenuecat/purchases-capacitor";
import { ensureRevenueCat } from "@/lib/billing/revenuecat";
import { useEntitlements } from "@/components/EntitlementsProvider.client";
import { useSearchParams } from "next/navigation";
import PremiumFeatureModal from "@/components/PremiumFeatureModal";
import type { EntitlementSource } from "@/lib/entitlements/types";



const VALID_PROMO_CODES = ["EXP30"];

const RC_ENTITLEMENT_ID =
  process.env.NEXT_PUBLIC_REVENUECAT_ENTITLEMENT_ID ?? "Premium";

function premiumSourceFromCustomerInfo(
  customerInfo: CustomerInfo
): { source: EntitlementSource; expiresAt?: number } | null {
  const active = customerInfo.entitlements.active?.[RC_ENTITLEMENT_ID];
  if (!active) return null;

  const expMs =
    typeof active.expirationDateMillis === "number"
      ? active.expirationDateMillis
      : undefined;
  const periodType = String(active.periodType ?? "").toUpperCase();
  const source: EntitlementSource =
    expMs == null ? "lifetime" : periodType === "TRIAL" ? "trial" : "subscription";

  return { source, expiresAt: expMs };
}

export default function PremiumPage() {
  return (
    <Suspense fallback={null}>
      <PremiumInner />
    </Suspense>
  );
}

function PremiumInner() {
  const router = useRouter();

  const [selected, setSelected] = useState<PlanId | null>(null);

  // Promo UI (you can hide later if you decide)
  const [promo, setPromo] = useState("");
  const [showPromo, setShowPromo] = useState(false);
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState("");
  const [planError, setPlanError] = useState("");

  const { refresh, grantPremium, userKey } = useEntitlements();

  // ✅ Hooks MUST be inside the component
  const [priceByPlanId, setPriceByPlanId] = useState<
    Partial<Record<PlanId, string>>
  >({});

  const [showPremiumModal, setShowPremiumModal] = useState(false);
const [pendingPremiumPlan, setPendingPremiumPlan] = useState<PlanId | null>(null);

  const searchParams = useSearchParams();

useEffect(() => {
  const p = searchParams.get("plan") as PlanId | null;
  if (p && (p === "monthly" || p === "three_month" || p === "six_month" || p === "lifetime")) {
    setSelected(p);
  }
}, [searchParams]);

  useEffect(() => {
  if (!Capacitor.isNativePlatform()) return;

  (async () => {
    try {
      await ensureRevenueCat(); // ✅ add this line

      const offerings = await Purchases.getOfferings();
console.log("[RC] current offering:", offerings.current?.identifier);
console.log("[RC] packages:", offerings.current?.availablePackages?.map(p => p.identifier));
      
      const o = offerings.current;
      if (!o) return;

      setPriceByPlanId({
        monthly: o.monthly?.product.priceString,
        three_month: o.threeMonth?.product.priceString,
        six_month: o.sixMonth?.product.priceString,
        lifetime: o.lifetime?.product.priceString,
      });
    } catch {
      // fallback prices will display
    }
  })();
}, []);

  const handleApplyCode = () => {
    const code = promo.trim().toUpperCase();
    const ok = VALID_PROMO_CODES.includes(code);

    if (!code) {
      setPromoApplied(false);
      setPromoError("Please enter a promo code.");
      return;
    }
    if (!ok) {
      setPromoApplied(false);
      setPromoError("Invalid promo code.");
      return;
    }

    setPromoApplied(true);
    setPromoError("");
    setShowPromo(false);
  };

    return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <div className={styles.topRow}>
          <div className={styles.topBackButton}>
            <BackButton variant="inline" />
          </div>
        </div>

        {/* Crown */}
        <div className={styles.crownWrap}>
          <Image
            src="/images/premium/crown-icon.png"
            alt="Premium"
            width={66}
            height={66}
            className={styles.crownIcon}
            priority
          />
        </div>

        {/* Title block */}
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Get premium today</h1>
          <p className={styles.subtitle}>Remove ads and unlock all features:</p>
        </div>

        {/* Features grid */}
        <section className={styles.featuresBox} aria-label="Premium features">
          <div className={styles.featureGrid}>
            <div className={`${styles.featureCell} ${styles.cellTL}`}>
              <div className={styles.featureHead}>
                <Image
                  src="/images/premium/stats-icon.png"
                  alt=""
                  width={28}
                  height={28}
                />
                <span className={styles.featureTitle}>Personal Stats</span>
              </div>
              <p className={styles.featureDesc}>Track scores, time & progress</p>
            </div>

            <div className={`${styles.featureCell} ${styles.cellTR}`}>
              <div className={styles.featureHead}>
                <Image
                  src="/images/premium/bolt-icon.png"
                  alt=""
                  width={28}
                  height={28}
                />
                <span className={styles.featureTitle}>Test Modes</span>
              </div>
              <p className={styles.featureDesc}>
                Real, Practice, Rapid Fire & more
              </p>
            </div>

            <div className={`${styles.featureCell} ${styles.cellBL}`}>
              <div className={styles.featureHead}>
                <Image
                  src="/images/premium/stopsign-icon.png"
                  alt=""
                  width={28}
                  height={28}
                />
                <span className={styles.featureTitle}>Mistakes Hub</span>
              </div>
              <p className={styles.featureDesc}>Global + My Mistakes review</p>
            </div>

            <div className={`${styles.featureCell} ${styles.cellBR}`}>
              <div className={styles.featureHead}>
                <Image
                  src="/images/premium/shield-icon.png"
                  alt=""
                  width={28}
                  height={28}
                />
                <span className={styles.featureTitle}>Question Bank</span>
              </div>
              <p className={styles.featureDesc}>All questions & Bookmarks</p>
            </div>
          </div>
        </section>

        {/* Plan pills */}
        <section className={styles.planList} aria-label="Choose a plan">
          {PLAN_LIST.map((p) => {
            const active = selected === p.id;
            const displayPrice = priceByPlanId[p.id] || p.price;

            return (
              <button
                key={p.id}
                type="button"
                className={`${styles.planPill} ${
                  active ? styles.planPillActive : ""
                }`}
                onClick={() => {
                  setPlanError("");
                  setSelected((prev) => (prev === p.id ? null : p.id));
                }}
              >
                <div className={styles.planLeft}>
                  <div className={styles.planTitle}>{p.pillTitle}</div>
                  
                </div>

                <div className={styles.planRight}>
                  {!promoApplied ? (
                    <div className={styles.planPrice}>{displayPrice}</div>
                  ) : (
                    <div className={styles.priceCombo}>
                      <span className={styles.oldPrice}>{p.price}</span>
                      <span className={styles.planPrice}>{p.promoPrice}</span>
                    </div>
                  )}

                  <span
                    className={`${styles.radio} ${active ? styles.radioOn : ""}`}
                  />
                </div>
              </button>
            );
          })}
        </section>

        {/* Got a Promocode row */}
        <div className={styles.gotPromoRow}>
          <span className={styles.gotPromoText}>Got a Promocode?</span>

          <button
            type="button"
            className={styles.applyHereBtn}
            onClick={() => setShowPromo((v) => !v)}
            aria-expanded={showPromo}
          >
            Apply Here
          </button>
        </div>

        {/* Promo area */}
        {showPromo && (
          <>
            <p className={styles.note}>
              Enjoying the app? A quick review helps a lot and goes a long way for
              me. That&apos;s right <strong>me</strong>. I used to be on the same
              side of that screen as <strong>you</strong>. I got fed up with the
              options I had and learned how to make this app just for you. Enjoy!
            </p>

            <div className={styles.promoRow}>
              <input
                className={styles.promoInput}
                value={promo}
                onChange={(e) => {
                  setPromo(e.target.value);
                  if (promoError) setPromoError("");
                }}
                placeholder="Enter Promo Code"
              />

              <button
                type="button"
                className={styles.promoApply}
                onClick={handleApplyCode}
              >
                Apply Code
              </button>
            </div>

            {promoError && <div className={styles.promoError}>{promoError}</div>}
          </>
        )}

        {/* CTA */}
        <button
          type="button"
          className={styles.cta}
          disabled={!selected}
          onClick={async () => {
            setPlanError("");

            if (!selected) {
              setPlanError("Please select a plan.");
              return;
            }

            const plan = selected;

            // ✅ Guest: show modal (NO redirect)
            if (userKey === "guest") {
  setPendingPremiumPlan(plan);
  setShowPremiumModal(true);
  return;
}

            if (Capacitor.isNativePlatform()) {
              try {
                await ensureRevenueCat(userKey);
                const offerings = await Purchases.getOfferings();
                const o = offerings.current;
                if (!o) throw new Error("No current offering configured in RevenueCat.");

                let pkg: PurchasesPackage | null = null;
                if (plan === "monthly") pkg = o.monthly;
                else if (plan === "three_month") pkg = o.threeMonth;
                else if (plan === "six_month") pkg = o.sixMonth;
                else if (plan === "lifetime") pkg = o.lifetime;

                if (!pkg) {
                  pkg =
                    o.availablePackages.find((p) => p.identifier === `$rc_${plan}`) ??
                    o.availablePackages.find((p) => p.identifier === plan) ??
                    null;
                }
                if (!pkg) throw new Error(`No package found for plan: ${plan}`);

                const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
console.log("[RC] purchase ok, appUserId:", customerInfo.originalAppUserId);
console.log("[RC] active entitlements:", Object.keys(customerInfo.entitlements.active ?? {}));
console.log("[RC] premium active:", !!customerInfo.entitlements.active?.[RC_ENTITLEMENT_ID]);
console.log("[RC] post-purchase customerInfo premium:", !!customerInfo.entitlements.active?.[RC_ENTITLEMENT_ID]);
                const premiumData = premiumSourceFromCustomerInfo(customerInfo);
                if (!premiumData) return;

                grantPremium(premiumData.source, premiumData.expiresAt);
                refresh();

                const next = new URLSearchParams(window.location.search).get("next");
                router.replace(next ? decodeURIComponent(next) : "/");
              } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                const cancelled =
                  msg.toLowerCase().includes("cancel") ||
                  msg.toLowerCase().includes("usercancelled");
                if (!cancelled) setPlanError(msg || "Purchase failed. Please try again.");
              }
              return;
            }

            // Web fallback
            router.push(
              `/checkout?plan=${encodeURIComponent(plan)}${promoApplied ? "&promo=1" : ""}`
            );
          }}
        >
          <span className={styles.ctaText}>Get Premium Now</span>
          <span className={styles.ctaChevron}>›</span>
        </button>

        {planError && <div className={styles.planError}>{planError}</div>}
      </div>
     <PremiumFeatureModal
  open={showPremiumModal}
  onClose={() => setShowPremiumModal(false)}
  nextPath={`/premium?plan=${pendingPremiumPlan ?? "lifetime"}`}
  isAuthed={false}
/>
    </main>
  );
}
