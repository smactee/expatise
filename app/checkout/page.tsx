// app/checkout/page.tsx

"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./checkout.module.css";
import { PLAN_MAP, toPlanId, type PlanId } from "@/lib/plans";
import { safeNextPath } from "@/lib/auth";
import CSRBoundary from "@/components/CSRBoundary";

type PayMethod = "alipay" | "gpay" | "applepay" | "wechat";


function onlyDigits(s: string) {
  return s.replace(/\D/g, "");
}

function formatCardNumber(raw: string) {
  const digits = onlyDigits(raw).slice(0, 19); // allow up to 19
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(raw: string) {
  const digits = onlyDigits(raw).slice(0, 4); // MMYY
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function Inner() {
  const router = useRouter();
  const sp = useSearchParams();

  const plan: PlanId = toPlanId(sp.get("plan"));
  const promoApplied = sp.get("promo") === "1";
  const next = safeNextPath(sp.get("next"), "/");

  const planData = PLAN_MAP[plan];
  const title = planData.checkoutTitle;
  const price = promoApplied ? planData.promoPrice : planData.price;

  // simple “order no” for UI (you’ll replace with real order id later)
  /* const orderNo = useMemo(() => {
    const n = Date.now().toString().slice(-7);
    return `№${n}`;
  }, []); */

  const [method, setMethod] = useState<PayMethod>("wechat");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");


  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        {/* Top bar */}
        <header className={styles.topBar}>
          <button type="button" className={styles.backButton} onClick={() => router.back()}>
            <span className={styles.backIcon}>‹</span>
            <span className={styles.backText}></span>
          </button>
        </header>

        {/* Content */}
        <div className={styles.content}>
          <div className={styles.summaryRow}>
            <div className={styles.planLabel}>{title}</div>
            <div className={styles.orderNo}>Order Summary</div>
          </div>

          <div className={styles.price}>{price}</div>

          <div className={styles.divider} />

          {/* Payment methods */}
          <div className={styles.payRow} role="tablist" aria-label="Payment methods">
  <button
    type="button"
    className={`${styles.payItem} ${method === "alipay" ? styles.payItemActive : ""}`}
    onClick={() => setMethod("alipay")}
  >
    <span className={styles.payLogoBox}>
      <Image src="/images/checkout/alipay-logo.png" alt="AliPay" width={34} height={34} />
    </span>
    <span className={styles.pgLabel}>AliPay</span>
  </button>

  <button
    type="button"
    className={`${styles.payItem} ${method === "gpay" ? styles.payItemActive : ""}`}
    onClick={() => setMethod("gpay")}
  >
    <span className={styles.payLogoBox}>
      <Image src="/images/checkout/googlepay-logo.png" alt="Google Pay" width={70} height={22} />
    </span>
    <span className={styles.pgLabel}>Google Pay</span>
  </button>

  <button
    type="button"
    className={`${styles.payItem} ${method === "applepay" ? styles.payItemActive : ""}`}
    onClick={() => setMethod("applepay")}
  >
    <span className={styles.payLogoBox}>
      <Image src="/images/checkout/applepay-logo.png" alt="Apple Pay" width={70} height={22} />
    </span>
    <span className={styles.pgLabel}>Apple Pay</span>
  </button>

  <button
    type="button"
    className={`${styles.payItem} ${method === "wechat" ? styles.payItemActive : ""}`}
    onClick={() => setMethod("wechat")}
  >
    <span className={styles.payLogoBox}>
      <Image src="/images/checkout/wechat-logo.png" alt="WeChat Pay" width={34} height={34} />
    </span>
    <span className={styles.pgLabel}>WeChat Pay</span>
  </button>
</div>

          {/* Form */}
          <div className={styles.form}>
            <label className={styles.label}>Card Number</label>
            <div className={styles.inputWrap}>
              <span className={styles.leftIcon} aria-hidden="true">
      <Image
        src="/images/checkout/creditcard-icon.png"
        alt="credit card"
        width={18}
        height={18}
        priority={false}
        />
      </span>
              <input
                className={styles.input}
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                placeholder="Card number"
                inputMode="numeric"
                autoComplete="cc-number"
              />
            </div>

            <div className={styles.twoCol}>
              <div>
                <label className={styles.label}>Expiry Date</label>
                <div className={styles.inputWrap}>
                  <input
                    className={styles.input}
                    value={expiry}
                    onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                    placeholder="8/24"
                    inputMode="numeric"
                    autoComplete="cc-exp"
                  />
                </div>
              </div>

              <div>
                <label className={styles.label}>CVV/CVC</label>
                <div className={styles.inputWrap}>
                 <span className={styles.leftIcon} aria-hidden="true">
      <Image
        src="/images/checkout/lock-icon.png"
        alt="lock icon"
        width={18}
        height={18}
        priority={false}
      />
    </span>
                   <input
      className={styles.input}
      value={cvv}
      onChange={(e) => setCvv(onlyDigits(e.target.value).slice(0, 4))}
      placeholder="•••"
      inputMode="numeric"
      autoComplete="cc-csc"
    />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.checkoutBtn}
            onClick={() => {
              router.push(
  `/checkout/success?plan=${encodeURIComponent(plan)}${promoApplied ? "&promo=1" : ""}&next=${encodeURIComponent(next)}`
);
              // TODO: integrate real payment provider later
            }}
          >
            Checkout
          </button>
        </footer>
      </div>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <CSRBoundary>
      <Inner />
    </CSRBoundary>
  );
}