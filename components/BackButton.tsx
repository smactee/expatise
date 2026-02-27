// components/BackButton.tsx

'use client';

import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import type { CSSProperties } from 'react';
import styles from './BackButton.module.css';
import CSRBoundary from '@/components/CSRBoundary';


type BackButtonProps = {
  onClick?: () => void;                 // optional override (modal close)
  variant?: 'fixed' | 'inline';
  ariaLabel?: string;
  style?: CSSProperties;

  // NEW (optional): if there is no history + no returnTo, where to go
  fallbackHref?: string;
};

function safeDecode(v: string) {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

function Inner({
  onClick,
  variant = 'fixed',
  ariaLabel = 'Back',
  style,
  fallbackHref = '/',
}: BackButtonProps) {
  const router = useRouter();
  const sp = useSearchParams();

  const handleClick = () => {
    if (onClick) {
      onClick();
      return;
    }

    // ✅ If the current URL has returnTo, use it.
    const raw = sp?.get('returnTo') ?? '';
    const decoded = raw ? safeDecode(raw) : '';

    if (decoded.startsWith('/') && !decoded.startsWith('//')) {
  router.push(decoded);
  return;
}


    // Otherwise behave like normal back
    // (with a safety fallback if there's no real history)
    if (typeof window !== 'undefined' && window.history.length <= 1) {
      router.push(fallbackHref);
      return;
    }

    router.back();
  };

  const fixedStyle: CSSProperties =
    variant === 'fixed'
      ? {
          position: 'fixed',
          top: 'calc(var(--statusbar-h, 0px) + env(safe-area-inset-top, 0px) + 8px)',
          left: 'calc(env(safe-area-inset-left, 0px) + 10px)',
          zIndex: 9999,
        }
      : { position: 'static' };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={ariaLabel}
      className={styles.backBtn}
      style={{ ...fixedStyle, ...style }}
    >
      <Image
        src="/images/other/turn-back.png"
        alt="Back"
        width={24}
        height={24}
        priority
      />
    </button>
  );
}

export default function BackButton(props: BackButtonProps) {
  return (
    <CSRBoundary>
      <Inner {...props} />
    </CSRBoundary>
  );
}