// app/premium/page.tsx
"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./premium.module.css";
import { PLAN_LIST, type PlanId } from "../../lib/plans";
import BackButton from "@/components/BackButton";

const VALID_PROMO_CODES = ["EXP30"];

export default function PremiumPage() {
    const router = useRouter();
    const [selected, setSelected] = useState<PlanId>("lifetime");
    const [promo, setPromo] = useState("");
    const [showPromo, setShowPromo] = useState(false);
    const [promoApplied, setPromoApplied] = useState(false);
    const [promoError, setPromoError] = useState("");

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
      <BackButton />
      <div className={styles.frame}>
        {/* Top safe area + back */}


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

        {/* Title block (290x62) */}
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Get premium today</h1>
          <p className={styles.subtitle}>Remove ads and unlock all features:</p>
        </div>

        {/* Features grid (335.04 x 172) */}
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
              <p className={styles.featureDesc}>
                Global + My Mistakes review
              </p>
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
              <p className={styles.featureDesc}>
                All questions & Bookmarks
              </p>
            </div>
          </div>
        </section>

        {/* Plan pills (328 x 61, radius 20) */}
        <section className={styles.planList} aria-label="Choose a plan">
          {PLAN_LIST.map((p) => {
            const active = selected === p.id;
            
            return (
              <button
                key={p.id}
                type="button"
                className={`${styles.planPill} ${active ? styles.planPillActive : ""}`}
                onClick={() => setSelected(p.id)}
              >
                <div className={styles.planLeft}>
                  <div className={styles.planTitle}>{p.pillTitle}</div>
                
               {/* 3) Subtext disappears after promo applied */}
                  {!promoApplied && <div className={styles.planSub}>{p.sub}</div>}
                </div>

               <div className={styles.planRight}>
                  {/* 4) Old price left w/ diagonal slash + promo price in original spot */}
                  {!promoApplied ? (
                    <div className={styles.planPrice}>{p.price}</div>
                  ) : (
                    <div className={styles.priceCombo}>
                      <span className={styles.oldPrice}>{p.price}</span>
                      <span className={styles.planPrice}>{p.promoPrice}</span>
                    </div>
                  )}

                  <span className={`${styles.radio} ${active ? styles.radioOn : ""}`} />
                </div>
              </button>
            );
          })}
        </section>

{/* Got a Promocode row (always visible) */}
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
      Leave a 5 star review on the app store, and send us the screenshot via our WeChat. We
      will give you a <strong>30%</strong> discount code for ALL plans!
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
       {/* 1) Apply Code button is an event listener */}
      <button type="button" className={styles.promoApply} onClick={handleApplyCode}>
        Apply Code
      </button>
    </div>
    {/* 2) Error message if invalid code */}
    {promoError && <div className={styles.promoError}>{promoError}</div>}

  </>
)}
        {/* CTA (327 x 52) */}
        <button
          type="button"
          className={styles.cta}
          onClick={() =>
            router.push(`/checkout?plan=${selected}${promoApplied ? "&promo=1" : ""}`)
          }
        >
          <span className={styles.ctaText}>Get Premium Now</span>
          <span className={styles.ctaChevron}>›</span>
        </button>
      </div>
    </main>
  );
}
