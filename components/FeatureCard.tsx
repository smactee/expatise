// components/FeatureCard.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import styles from '../app/page.module.css';
import { useRef } from 'react';
import type { MouseEvent, PointerEvent } from 'react';

type FeatureCardProps = {
  href: string;
  ariaLabel: string;

  bgSrc: string;
  bgAlt: string;

  iconSrc: string;
  iconAlt: string;

  topText: string;
  title: string;

  // optional now, useful later
  prefetch?: boolean;
  onClick?: () => void;
};

export default function FeatureCard({
    
  href,
  ariaLabel,
  bgSrc,
  bgAlt,
  iconSrc,
  iconAlt,
  topText,
  title,
  prefetch,
  onClick,
}: FeatureCardProps) {
      const dragRef = useRef({ x: 0, y: 0, moved: false });

  const handlePointerDown = (e: PointerEvent<HTMLAnchorElement>) => {
    dragRef.current.x = e.clientX;
    dragRef.current.y = e.clientY;
    dragRef.current.moved = false;
  };

  const handlePointerMove = (e: PointerEvent<HTMLAnchorElement>) => {
    if (dragRef.current.moved) return;

    const dx = Math.abs(e.clientX - dragRef.current.x);
    const dy = Math.abs(e.clientY - dragRef.current.y);

    // If user moved more than a few pixels, we treat it as a drag/scroll gesture
    if (dx > 8 || dy > 8) dragRef.current.moved = true;
  };

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // If the pointer moved, user was dragging — don't navigate
    if (dragRef.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Otherwise, it was a real click/tap
    onClick?.();
  };

  const handlePointerUp = () => {
    // reset after the click event has a chance to run
    setTimeout(() => {
      dragRef.current.moved = false;
    }, 0);
  };

  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={styles.featureCard}
      aria-label={ariaLabel}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={handleClick}
    >
      <Image
        src={bgSrc}
        alt={bgAlt}
        fill
        className={styles.cardBgImage}
        draggable={false}
      />

      <div className={styles.cardTopRow}>
        <div className={styles.cardIcon}>
          <Image
            src={iconSrc}
            alt={iconAlt}
            fill
            draggable={false}
          />
        </div>

        <p className={styles.cardTopText}>{topText}</p>
      </div>

      <div className={styles.cardContent}>
        <p className={styles.cardTitle}>{title}</p>
      </div>
    </Link>
  );
}
