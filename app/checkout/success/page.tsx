"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import styles from "./success.module.css";
import CSRBoundary from "@/components/CSRBoundary";
import { useT } from "@/lib/i18n/useT";

function Inner() {
  const router = useRouter();
  const { t } = useT();

  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <div className={styles.confettieWrap}>
          <Image
            src="/images/checkout/confetti-bg.png"
            alt={t("checkout.backgroundAlt")}
            fill
            priority
            className={styles.confettiBg}
            sizes="390px"
          />
        </div>

        <div className={styles.centerBlock}>
          <Image
            src="/images/checkout/bluecheck-icon.png"
            alt={t("checkout.iconAlt")}
            width={100}
            height={100}
            priority
            className={styles.checkIcon}
          />

          <h1 className={styles.title}>{t("checkout.successTitle")}</h1>
          <p className={styles.subtitle}>
            {t("checkout.successSubtitle")}
          </p>
        </div>

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.homeBtn}
            onClick={() => router.push("/premium")}
          >
            {t("shared.common.backToPremium")}
          </button>
        </footer>
      </div>
    </main>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <CSRBoundary>
      <Inner />
    </CSRBoundary>
  );
}
