"use client";

import { useRouter, useSearchParams } from "next/navigation";
import styles from "./checkout.module.css";
import { PLAN_MAP, toPlanId, type PlanId } from "@/lib/plans";
import CSRBoundary from "@/components/CSRBoundary";
import BackButton from "@/components/BackButton";
import { useT } from "@/lib/i18n/useT";
import { useVisualViewportBottomOffset } from "@/lib/utils/useVisualViewportBottomOffset";

const CHECKOUT_PLAN_TITLE_KEYS: Record<PlanId, keyof typeof PLAN_MAP> = {
  monthly: "monthly",
  three_month: "three_month",
  six_month: "six_month",
  lifetime: "lifetime",
};

function Inner() {
  const router = useRouter();
  const sp = useSearchParams();
  const { t } = useT();
  const viewportBottomOffsetStyle = useVisualViewportBottomOffset();

  const plan: PlanId = toPlanId(sp.get("plan"));
  const promoApplied = sp.get("promo") === "1";
  const planData = PLAN_MAP[plan];
  const titleKey = CHECKOUT_PLAN_TITLE_KEYS[plan];
  const title =
    titleKey === "monthly"
      ? t("checkout.planTitles.monthly")
      : titleKey === "three_month"
      ? t("checkout.planTitles.threeMonth")
      : titleKey === "six_month"
      ? t("checkout.planTitles.sixMonth")
      : t("checkout.planTitles.lifetime");
  const price = promoApplied ? planData.promoPrice : planData.price;

  return (
    <main className={styles.page} style={viewportBottomOffsetStyle}>
      <div className={styles.frame}>
        <header className={styles.topBar}>
          <div className={styles.topBackButton}>
            <BackButton variant="inline" />
          </div>
        </header>

        <div className={styles.content}>
          <div className={styles.summaryRow}>
            <div className={styles.planLabel}>{title}</div>
            <div className={styles.orderNo}>{t("checkout.webCheckoutUnavailable")}</div>
          </div>

          <div className={styles.price}>{price}</div>

          <div className={styles.divider} />

          <div className={styles.form}>
            <p className={styles.label} style={{ marginBottom: 12 }}>
              {t("checkout.summary")}
            </p>
            <p style={{ margin: 0, lineHeight: 1.6, opacity: 0.85 }}>
              {t("checkout.detail")}
            </p>
          </div>
        </div>

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.checkoutBtn}
            onClick={() => router.push("/premium")}
          >
            {t("shared.common.backToPremium")}
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
