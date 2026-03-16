"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import styles from "./success.module.css";
import CSRBoundary from "@/components/CSRBoundary";

function Inner() {
  const router = useRouter();

  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <div className={styles.confettieWrap}>
          <Image
            src="/images/checkout/confetti-bg.png"
            alt="checkout background"
            fill
            priority
            className={styles.confettiBg}
            sizes="390px"
          />
        </div>

        <div className={styles.centerBlock}>
          <Image
            src="/images/checkout/bluecheck-icon.png"
            alt="Checkout unavailable"
            width={100}
            height={100}
            priority
            className={styles.checkIcon}
          />

          <h1 className={styles.title}>Web Checkout Unavailable</h1>
          <p className={styles.subtitle}>
            Premium purchases are currently available only in the mobile app.
          </p>
        </div>

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.homeBtn}
            onClick={() => router.push("/premium")}
          >
            Back to Premium
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
