"use client";

import { useRouter, useSearchParams } from "next/navigation";
import styles from "./checkout.module.css";
import { PLAN_MAP, toPlanId, type PlanId } from "@/lib/plans";
import CSRBoundary from "@/components/CSRBoundary";
import BackButton from "@/components/BackButton";

function Inner() {
  const router = useRouter();
  const sp = useSearchParams();

  const plan: PlanId = toPlanId(sp.get("plan"));
  const promoApplied = sp.get("promo") === "1";
  const planData = PLAN_MAP[plan];
  const title = planData.checkoutTitle;
  const price = promoApplied ? planData.promoPrice : planData.price;

  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <header className={styles.topBar}>
          <div className={styles.topBackButton}>
            <BackButton variant="inline" />
          </div>
        </header>

        <div className={styles.content}>
          <div className={styles.summaryRow}>
            <div className={styles.planLabel}>{title}</div>
            <div className={styles.orderNo}>Web checkout unavailable</div>
          </div>

          <div className={styles.price}>{price}</div>

          <div className={styles.divider} />

          <div className={styles.form}>
            <p className={styles.label} style={{ marginBottom: 12 }}>
              Web checkout is not available in this release.
            </p>
            <p style={{ margin: 0, lineHeight: 1.6, opacity: 0.85 }}>
              Premium purchases are currently available only in the mobile app.
              If you already purchased Premium there, open the app and use the
              restore option from your profile if needed.
            </p>
          </div>
        </div>

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.checkoutBtn}
            onClick={() => router.push("/premium")}
          >
            Back to Premium
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
