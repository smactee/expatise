//components/BottonNav.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import styles from './BottomNav.module.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/i18n/useT';

type BottomNavProps = {
  onOffsetChange?: (offsetY: number) => void; // keep for compatibility
};

export default function BottomNav({ onOffsetChange }: BottomNavProps) {
  const pathname = usePathname();
  const { t } = useT();

  const isHome = pathname === '/';
  const isStats = pathname === '/stats' || pathname?.startsWith('/stats/');
  const isProfile = pathname === '/profile' || pathname?.startsWith('/profile/');

  const [hidden, setHidden] = useState(false);
  const hiddenRef = useRef(false);
  const autoHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastYRef = useRef(0);
  const downAccumRef = useRef(0);
  const upAccumRef = useRef(0);
  const tickingRef = useRef(false);

  const onOffsetChangeRef = useRef<BottomNavProps['onOffsetChange']>(onOffsetChange);
  useEffect(() => {
    onOffsetChangeRef.current = onOffsetChange;
  }, [onOffsetChange]);

  const clearAutoHideTimer = useCallback(() => {
    if (!autoHideTimerRef.current) return;
    clearTimeout(autoHideTimerRef.current);
    autoHideTimerRef.current = null;
  }, []);

  const scheduleAutoHide = useCallback(() => {
    clearAutoHideTimer();
    autoHideTimerRef.current = setTimeout(() => {
      if (hiddenRef.current) return;
      hiddenRef.current = true;
      setHidden(true);
      onOffsetChangeRef.current?.(90);
    }, 10000);
  }, [clearAutoHideTimer]);

  const setHiddenSafe = useCallback((nextHidden: boolean) => {
    if (nextHidden === hiddenRef.current) return;
    hiddenRef.current = nextHidden;
    setHidden(nextHidden);

    if (nextHidden) {
      clearAutoHideTimer();
    } else {
      scheduleAutoHide();
    }

    // Optional compatibility: 0 when shown, ~hide distance when hidden
    onOffsetChangeRef.current?.(nextHidden ? 90 : 0);
  }, [clearAutoHideTimer, scheduleAutoHide]);

  useEffect(() => {
    scheduleAutoHide();
    return () => clearAutoHideTimer();
  }, [clearAutoHideTimer, scheduleAutoHide]);

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
  }, [setHiddenSafe]);

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
                <Image src="/images/home/icons/navbar-home-icon.png" alt={t('shared.nav.homeIconAlt')} width={30} height={30} draggable={false} />
              </span>
              <span className={styles.navLabel}>{t('shared.nav.home')}</span>
            </div>
          ) : (
            <span className={styles.navIcon}>
              <Image src="/images/home/icons/navbar-home-icon.png" alt={t('shared.nav.homeIconAlt')} width={30} height={30} draggable={false} />
            </span>
          )}
        </Link>

        {/* Stats */}
        <Link href="/stats" className={`${styles.navItem} ${isStats ? styles.navItemActive : ''}`}>
          {isStats ? (
            <div className={styles.navPill}>
              <span className={styles.navIcon}>
                <Image src="/images/home/icons/navbar-stats-icon.png" alt={t('shared.nav.statsIconAlt')} width={30} height={30} draggable={false} />
              </span>
              <span className={styles.navLabel}>{t('shared.nav.stats')}</span>
            </div>
          ) : (
            <span className={styles.navIcon}>
              <Image src="/images/home/icons/navbar-stats-icon.png" alt={t('shared.nav.statsIconAlt')} width={30} height={30} draggable={false} />
            </span>
          )}
        </Link>

        {/* Profile */}
        <Link href="/profile" className={`${styles.navItem} ${isProfile ? styles.navItemActive : ''}`}>
          {isProfile ? (
            <div className={styles.navPill}>
              <span className={styles.navIcon}>
                <Image src="/images/home/icons/navbar-profile-icon.png" alt={t('shared.nav.profileIconAlt')} width={30} height={30} draggable={false} />
              </span>
              <span className={styles.navLabel}>{t('shared.nav.profile')}</span>
            </div>
          ) : (
            <span className={styles.navIcon}>
              <Image src="/images/home/icons/navbar-profile-icon.png" alt={t('shared.nav.profileIconAlt')} width={30} height={30} draggable={false} />
            </span>
          )}
        </Link>
      </nav>
    </div>
  );
}
