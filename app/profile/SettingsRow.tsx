'use client';

import React from 'react';
import Image from 'next/image';
import styles from './profile.module.css';

type SettingsRowProps = {
  /** Resolved label text (pass the t() result, not a key). */
  label: React.ReactNode;
  onClick: React.ButtonHTMLAttributes<HTMLButtonElement>['onClick'];
  disabled?: boolean;
  /**
   * Leading icon. Either an <Image> spec (src/alt/width/height) or a custom
   * node (e.g. the CSS-driven restore icon span).
   */
  icon?: {
    src: string;
    alt: string;
    width: number;
    height: number;
  };
  iconNode?: React.ReactNode;
  /**
   * Trailing element. Defaults to the › chevron. Pass a node (e.g. the
   * light/dark toggle) to override.
   */
  trailing?: React.ReactNode;
};

export default function SettingsRow({
  label,
  onClick,
  disabled,
  icon,
  iconNode,
  trailing,
}: SettingsRowProps) {
  return (
    <button
      type="button"
      className={styles.settingsRow}
      onClick={onClick}
      disabled={disabled}
    >
      <div className={styles.settingsLeft}>
        {iconNode ?? (
          <span className={styles.settingsIcon}>
            <Image
              src={icon!.src}
              alt={icon!.alt}
              width={icon!.width}
              height={icon!.height}
            />
          </span>
        )}
        <span className={styles.settingsLabel}>{label}</span>
      </div>
      {trailing ?? <span className={styles.chevron}>›</span>}
    </button>
  );
}
