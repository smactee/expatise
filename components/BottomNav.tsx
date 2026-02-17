'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import styles from '../app/page.module.css';
import { useEffect, useRef, useState } from 'react';

type BottomNavProps = {
  onOffsetChange?: (offsetY: number) => void; // keep for compatibility
};

export default function BottomNav({ onOffsetChange }: BottomNavProps) {
  const pathname = usePathname();

  const isHome = pathname === '/';
  const isStats = pathname === '/stats';
  const isProfile = pathname === '/profile';

  const [hidden, setHidden] = useState(false);
  const hiddenRef = useRef(false);

  const lastYRef = useRef(0);
  const downAccumRef = useRef(0);
  const upAccumRef = useRef(0);
  const tickingRef = useRef(false);

  const onOffsetChangeRef = useRef<BottomNavProps['onOffsetChange']>(onOffsetChange);
  useEffect(() => {
    onOffsetChangeRef.current = onOffsetChange;
  }, [onOffsetChange]);

  const setHiddenSafe = (nextHidden: boolean) => {
    if (nextHidden === hiddenRef.current) return;
    hiddenRef.current = nextHidden;
    setHidden(nextHidden);

    // Optional compatibility: 0 when shown, ~hide distance when hidden
    onOffsetChangeRef.current?.(nextHidden ? 90 : 0);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    lastYRef.current = window.scrollY;

    const HIDE_THRESHOLD = 28; // scroll down px before hiding
    const SHOW_THRESHOLD = 14; // scroll up px before showing
    const TOP_LOCK = 8;        // always show near top
    const MIN_SCROLL_TO_HIDE = 40; // avoid hiding immediately at the top

    const onScroll = () => {
      if (tickingRef.current) return;
      tickingRef.current = true;

      requestAnimationFrame(() => {
        tickingRef.current = false;

        const y = window.scrollY;
        const delta = y - lastYRef.current;
        lastYRef.current = y;

        // Always show when near the top
        if (y <= TOP_LOCK) {
          downAccumRef.current = 0;
          upAccumRef.current = 0;
          setHiddenSafe(false);
          return;
        }

        if (delta > 0) {
          // Scrolling DOWN
          downAccumRef.current += delta;
          upAccumRef.current = 0;

          if (y > MIN_SCROLL_TO_HIDE && downAccumRef.current >= HIDE_THRESHOLD) {
            downAccumRef.current = 0;
            setHiddenSafe(true);
          }
        } else if (delta < 0) {
          // Scrolling UP
          upAccumRef.current += -delta;
          downAccumRef.current = 0;

          if (upAccumRef.current >= SHOW_THRESHOLD) {
            upAccumRef.current = 0;
            setHiddenSafe(false);
          }
        }
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={`${styles.bottomNavWrapper} ${hidden ? styles.bottomNavWrapperHidden : ''}`}
    >
      <nav className={styles.bottomNav}>
        {/* Home */}
        <Link href="/" className={`${styles.navItem} ${isHome ? styles.navItemActive : ''}`}>
          {isHome ? (
            <div className={styles.navPill}>
              <span className={styles.navIcon}>
                <Image src="/images/home/icons/navbar-home-icon.png" alt="Navigation bar Home Icon" width={30} height={30} draggable={false} />
              </span>
              <span className={styles.navLabel}>Home</span>
            </div>
          ) : (
            <span className={styles.navIcon}>
              <Image src="/images/home/icons/navbar-home-icon.png" alt="Navigation bar Home Icon" width={30} height={30} draggable={false} />
            </span>
          )}
        </Link>

        {/* Stats */}
        <Link href="/stats" className={`${styles.navItem} ${isStats ? styles.navItemActive : ''}`}>
          {isStats ? (
            <div className={styles.navPill}>
              <span className={styles.navIcon}>
                <Image src="/images/home/icons/navbar-stats-icon.png" alt="Navigation bar Stats Icon" width={30} height={30} draggable={false} />
              </span>
              <span className={styles.navLabel}>Stats</span>
            </div>
          ) : (
            <span className={styles.navIcon}>
              <Image src="/images/home/icons/navbar-stats-icon.png" alt="Navigation bar Stats Icon" width={30} height={30} draggable={false} />
            </span>
          )}
        </Link>

        {/* Profile */}
        <Link href="/profile" className={`${styles.navItem} ${isProfile ? styles.navItemActive : ''}`}>
          {isProfile ? (
            <div className={styles.navPill}>
              <span className={styles.navIcon}>
                <Image src="/images/home/icons/navbar-profile-icon.png" alt="Navigation bar Profile Icon" width={30} height={30} draggable={false} />
              </span>
              <span className={styles.navLabel}>Profile</span>
            </div>
          ) : (
            <span className={styles.navIcon}>
              <Image src="/images/home/icons/navbar-profile-icon.png" alt="Navigation bar Profile Icon" width={30} height={30} draggable={false} />
            </span>
          )}
        </Link>
      </nav>
    </div>
  );
}
