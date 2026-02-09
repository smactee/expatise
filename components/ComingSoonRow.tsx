// components/ComingSoonRow.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';

type SettingsRowStyles = {
  settingsRow: string;
  settingsLeft: string;
  settingsIcon: string;
  settingsLabel: string;
  chevron: string;
};

type Props = {
  label: string;
  feature?: string;
  iconSrc: string;
  iconAlt: string;
  styles: SettingsRowStyles;
  comingSoonBaseHref?: string;
  onBeforeNavigate?: (e: React.MouseEvent<HTMLAnchorElement>) => boolean | void;
  className?: string;
};

export default function ComingSoonRow({
  label,
  feature,
  iconSrc,
  iconAlt,
  styles,
  comingSoonBaseHref = '/coming-soon',
  onBeforeNavigate,
  className,
}: Props) {
  const pathname = usePathname();
  const sp = useSearchParams();

  const featureText = feature ?? label;

  // ✅ capture current route so "Back" returns here (works from ANY page)
  const qs = sp?.toString();
  const returnTo = `${pathname}${qs ? `?${qs}` : ''}`;

  const href =
    `${comingSoonBaseHref}` +
    `?feature=${encodeURIComponent(featureText)}` +
    `&returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <Link
      href={href}
      className={`${styles.settingsRow} ${className ?? ''}`}
      onClick={(e) => {
        // 1) If you have a guard (login), honor it first
        if (onBeforeNavigate) {
          const ok = onBeforeNavigate(e);
          if (ok === false) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
        }

        // 2) ✅ Store a fallback returnTo (in case URL params get lost)
        try {
          sessionStorage.setItem('expatise:returnTo', returnTo);
          sessionStorage.setItem('expatise:returnTo:ts', String(Date.now()));
        } catch {
          // ignore
        }
      }}
    >
      <div className={styles.settingsLeft}>
        <span className={styles.settingsIcon}>
          <Image src={iconSrc} alt={iconAlt} width={24} height={24} />
        </span>
        <span className={styles.settingsLabel}>{label}</span>
      </div>
      <span className={styles.chevron}>›</span>
    </Link>
  );
}
