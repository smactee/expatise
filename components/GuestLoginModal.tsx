"use client";

import Link from "next/link";
import styles from "./GuestLoginModal.module.css";

type GuestLoginModalProps = {
  open: boolean;
  onClose: () => void;
  nextPath: string; // e.g. "/premium?plan=lifetime"
};

export default function GuestLoginModal({
  open,
  onClose,
  nextPath,
}: GuestLoginModalProps) {
  if (!open) return null;

  const href = `/login?next=${encodeURIComponent(nextPath)}`;

  return (
    <div className={styles.guestOverlay} onClick={onClose}>
      <div className={styles.guestModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.guestTitle}>Log in to save your data.</div>
        <div className={styles.guestText}>
          You are currently logged in as a <strong>guest</strong>. You can
          continue as such, but data will not be saved and some features may be
          reserved for premium users only.
        </div>

        <div className={styles.guestButtons}>
          <Link className={styles.guestPrimary} href={href}>
            Log in
          </Link>

          <button
            type="button"
            className={styles.guestSecondary}
            onClick={onClose}
          >
            Continue as guest
          </button>
        </div>
      </div>
    </div>
  );
}