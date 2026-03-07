"use client";

import Link from "next/link";
import styles from "./PremiumFeatureModal.module.css";

type PremiumFeatureModalProps = {
  open: boolean;
  onClose: () => void;
  nextPath: string;      // where user should return after login
  isAuthed: boolean;     // true = logged-in free user, false = guest
  premiumPath?: string;  // optional override, default = "/premium"
};

export default function PremiumFeatureModal({
  open,
  onClose,
  nextPath,
  isAuthed,
  premiumPath = "/premium",
}: PremiumFeatureModalProps) {
  if (!open) return null;

  const loginHref = `/login?next=${encodeURIComponent(nextPath)}`;

  const title = "This feature is available with Premium.";

  const text = isAuthed
    ? "You are currently on the free plan. Upgrade to Premium to access this feature and other premium tools."
    : "You are currently using a free guest account. Log in to save your progress and upgrade to Premium to access this feature.";

  return (
    <div className={styles.guestOverlay} onClick={onClose}>
      <div className={styles.guestModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.guestTitle}>{title}</div>

        <div className={styles.guestText}>{text}</div>

        <div className={styles.guestButtons}>
          {isAuthed ? (
            <>
              <button
                type="button"
                className={styles.guestPrimary}
                onClick={onClose}
              >
                Not now
              </button>

              <Link className={styles.guestSecondary} href={premiumPath}>
                Upgrade to Premium
              </Link>
            </>
          ) : (
            <>
              <button
                type="button"
                className={styles.guestPrimary}
                onClick={onClose}
              >
                Continue as guest
              </button>

              <Link className={styles.guestSecondary} href={loginHref}>
                Log in
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}