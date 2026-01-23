'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { CSSProperties } from 'react';
import styles from './BackButton.module.css';

type BackButtonProps = {
  onClick?: () => void;                 // optional override (modal close)
  variant?: 'fixed' | 'inline';         // default keeps your current behavior
  ariaLabel?: string;
  style?: CSSProperties;                // optional extra styles if needed
};

export default function BackButton({
  onClick,
  variant = 'fixed',
  ariaLabel = 'Back',
  style,
}: BackButtonProps) {
  const router = useRouter();

  const handleClick = () => {
    if (onClick) onClick();
    else router.back();
  };

  const fixedStyle: CSSProperties =
    variant === 'fixed'
      ? {
          position: 'fixed',
          top: 'calc(env(safe-area-inset-top, 0px))',
          left: 'calc(env(safe-area-inset-left, 0px) + 10px)',
          zIndex: 9999,
        }
      : {
          position: 'static',
        };

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
