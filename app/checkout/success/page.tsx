// app/checkout/success/page.tsx

"use client";

import Image from "next/image";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import styles from "./success.module.css";

export default function CheckoutSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    // Respect reduced motion
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const duration = 1000;
    const end = Date.now() + duration;

    // A nice “burst for 3s” effect
    (function frame() {
      confetti({
        particleCount: 4,
        spread: 70,
        startVelocity: 35,
        ticks: 200,
        origin: { x: 0.2, y: 0.35 },
      });
      confetti({
        particleCount: 4,
        spread: 70,
        startVelocity: 35,
        ticks: 200,
        origin: { x: 0.8, y: 0.35 },
      });

      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  }, []);

  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <div className={styles.confettieWrap}>
        {/* Static confetti BG (stays after animation ends) */}
        <Image
          src="/images/checkout/confetti-bg.png"
          alt="confetti background"
          fill
          priority
          className={styles.confettiBg}
          sizes="390px"
        />
        </div>

        <div className={styles.centerBlock}>
          {/* Center check icon */}
          <Image
            src="/images/checkout/bluecheck-icon.png"
            alt="Payment successful"
            width={100}
            height={100}
            priority
            className={styles.checkIcon}
          />

          <h1 className={styles.title}>Payment Successful</h1>
          <p className={styles.subtitle}>
            Congratulations! Your purchase has been successful.
          </p>
        </div>

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.homeBtn}
            onClick={() => router.push("/")}
          >
            Back to Home
          </button>
        </footer>
      </div>
    </main>
  );
}
