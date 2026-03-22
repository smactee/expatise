"use client";

import Link from "next/link";
import styles from "./PremiumFeatureModal.module.css";
import { useT } from "@/lib/i18n/useT";

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
  const { t } = useT();

  if (!open) return null;

  const loginHref = `/login?next=${encodeURIComponent(nextPath)}`;
  const title = t("shared.premiumFeatureModal.title");
  const text = isAuthed
    ? t("shared.premiumFeatureModal.authedText")
    : t("shared.premiumFeatureModal.guestText");

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
                {t("shared.premiumFeatureModal.notNow")}
              </button>

              <Link className={styles.guestSecondary} href={premiumPath}>
                {t("shared.premiumFeatureModal.upgrade")}
              </Link>
            </>
          ) : (
            <>
              <button
                type="button"
                className={styles.guestPrimary}
                onClick={onClose}
              >
                {t("shared.premiumFeatureModal.continueAsGuest")}
              </button>

              <Link className={styles.guestSecondary} href={loginHref}>
                {t("shared.premiumFeatureModal.login")}
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
