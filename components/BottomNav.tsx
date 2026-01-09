'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import styles from '../app/page.module.css';
import { useEffect, useRef, useState } from 'react';

type BottomNavProps = {
  onOffsetChange?: (offsetY: number) => void;
};

export default function BottomNav({ onOffsetChange }: BottomNavProps) {
  const pathname = usePathname();

  const isHome = pathname === '/';
  const isStats = pathname === '/stats';
  const isProfile = pathname === '/profile';

  const [offsetY, setOffsetY] = useState(0);

  const lastScrollYRef = useRef(0);
  const offsetYRef = useRef(0);

  // keep latest callback without re-binding scroll listener
  const onOffsetChangeRef = useRef<BottomNavProps['onOffsetChange']>(onOffsetChange);
  useEffect(() => {
    onOffsetChangeRef.current = onOffsetChange;
  }, [onOffsetChange]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    lastScrollYRef.current = window.scrollY;
    offsetYRef.current = 0;

    const handleScroll = () => {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollYRef.current;
      lastScrollYRef.current = currentY;

      const maxOffset = 90;
      let next = offsetYRef.current + delta;

      if (next < 0) next = 0;
      if (next > maxOffset) next = maxOffset;

      if (next !== offsetYRef.current) {
        offsetYRef.current = next;
        setOffsetY(next); // ✅ BottomNav state update
        onOffsetChangeRef.current?.(next); // ✅ Parent update (safe: not inside updater)
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div
      className={styles.bottomNavWrapper}
      style={{ transform: `translate(-50%, ${offsetY}px)` }}
    >
      <nav className={styles.bottomNav}>
        {/* Home */}
        <Link
          href="/"
          className={`${styles.navItem} ${isHome ? styles.navItemActive : ''}`}
        >
          {isHome ? (
            <div className={styles.navPill}>
              <span className={styles.navIcon}>
                <Image
                  src="/images/home/icons/navbar-home-icon.png"
                  alt="Navigation bar Home Icon"
                  width={30}
                  height={30}
                  draggable={false}
                />
              </span>
              <span className={styles.navLabel}>Home</span>
            </div>
          ) : (
            <span className={styles.navIcon}>
              <Image
                src="/images/home/icons/navbar-home-icon.png"
                alt="Navigation bar Home Icon"
                width={30}
                height={30}
                draggable={false}
              />
            </span>
          )}
        </Link>

        {/* Stats */}
        <Link
          href="/stats"
          className={`${styles.navItem} ${isStats ? styles.navItemActive : ''}`}
        >
          {isStats ? (
            <div className={styles.navPill}>
              <span className={styles.navIcon}>
                <Image
                  src="/images/home/icons/navbar-stats-icon.png"
                  alt="Navigation bar Stats Icon"
                  width={30}
                  height={30}
                  draggable={false}
                />
              </span>
              <span className={styles.navLabel}>Stats</span>
            </div>
          ) : (
            <span className={styles.navIcon}>
              <Image
                src="/images/home/icons/navbar-stats-icon.png"
                alt="Navigation bar Stats Icon"
                width={30}
                height={30}
                draggable={false}
              />
            </span>
          )}
        </Link>

        {/* Profile */}
        <Link
          href="/profile"
          className={`${styles.navItem} ${isProfile ? styles.navItemActive : ''}`}
        >
          {isProfile ? (
            <div className={styles.navPill}>
              <span className={styles.navIcon}>
                <Image
                  src="/images/home/icons/navbar-profile-icon.png"
                  alt="Navigation bar Profile Icon"
                  width={30}
                  height={30}
                  draggable={false}
                />
              </span>
              <span className={styles.navLabel}>Profile</span>
            </div>
          ) : (
            <span className={styles.navIcon}>
              <Image
                src="/images/home/icons/navbar-profile-icon.png"
                alt="Navigation bar Profile Icon"
                width={30}
                height={30}
                draggable={false}
              />
            </span>
          )}
        </Link>
      </nav>
    </div>
  );
}
