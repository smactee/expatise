'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import styles from '../app/page.module.css';   // reuse your current CSS
import  { useEffect, useState, useRef } from 'react';


export default function BottomNav() {
  const pathname = usePathname();

  const isHome = pathname === '/';
  const isStats = pathname === '/stats';
  const isProfile = pathname === '/profile';

  // How far the nav is pushed down (0 = fully visible)
  const [offsetY, setOffsetY] = useState(0);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // start from current scroll
    lastScrollYRef.current = window.scrollY;

    const handleScroll = () => {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollYRef.current; // + when scrolling down
      lastScrollYRef.current = currentY;

      setOffsetY((prev) => {
        const maxOffset = 90; // how far we allow it to slide down (px)
        let next = prev + delta;

        if (next < 0) next = 0;            // don’t go above original spot
        if (next > maxOffset) next = maxOffset; // fully hidden past this

        return next;
      });
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
          className={`${styles.navItem} ${
            isProfile ? styles.navItemActive : ''
          }`}
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
