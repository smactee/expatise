'use client';

import React from 'react';
import Image from 'next/image';
import styles from './profile.module.css';

type ProfileToastProps = {
  /** Resolved message text (pass the t() result, not a key). */
  message: React.ReactNode;
  /** Resolved alt text for the green-check icon (pass the t() result). */
  alt: string;
};

export default function ProfileToast({ message, alt }: ProfileToastProps) {
  return (
    <div className={styles.toastOverlay} aria-live="polite">
      <div className={styles.toastCard}>
        <Image
          src="/images/profile/greencheck-icon.png"
          alt={alt}
          width={16}
          height={16}
          className={styles.toastIcon}
          priority
        />
        <span className={styles.toastText}>{message}</span>
      </div>
    </div>
  );
}
