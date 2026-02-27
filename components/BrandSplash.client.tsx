'use client';

import { useEffect, useId, useState } from 'react';
import styles from './BrandSplash.module.css';

type BrandSplashProps = {
  /** Called when the splash finishes (after durationMs). */
  onDone?: () => void;

  /** Total animation time. Default 2000ms. */
  durationMs?: number;

  /** Background color. Default matches your Figma blue. */
  bg?: string;

  /** Wordmark image path (put it in /public). */
  wordmarkSrc?: string;

  /** Don't replay splash on same session. Default true. */
  oncePerSession?: boolean;

  /** Session storage key. */
  storageKey?: string;
};

export default function BrandSplash({
  onDone,
  durationMs = 2000,
  bg = '#012FA7',
  wordmarkSrc = '/assets/wordmark.webp',
  oncePerSession = true,
  storageKey = 'expatise_brand_splash_done',
}: BrandSplashProps) {
  const [show, setShow] = useState(true);
  const uid = useId();
  const maskId = `pillarHoleMask-${uid}`;

  useEffect(() => {
  const img = new Image();
  img.src = wordmarkSrc;
}, [wordmarkSrc]);

  useEffect(() => {
    if (oncePerSession && sessionStorage.getItem(storageKey) === '1') {
      setShow(false);
      return;
    }

    const t = window.setTimeout(() => {
      if (oncePerSession) sessionStorage.setItem(storageKey, '1');
      setShow(false);
      onDone?.();
    }, durationMs);

    return () => window.clearTimeout(t);
  }, [durationMs, onDone, oncePerSession, storageKey]);

  if (!show) return null;

  return (
    <div className={styles.splash} style={{ ['--bg' as any]: bg }}>
      <div className={styles.logo} aria-hidden>
        {/* Thin pillar */}
        <div className={`${styles.piece} ${styles.thin}`}>
          <div className={styles.thinRect} />
        </div>

        {/* Thick pillar with REAL hole (SVG mask) */}
        <div className={`${styles.piece} ${styles.thick}`}>
          <svg className={styles.pillarSvg} viewBox="0 0 100 360" role="presentation">
            <defs>
              <mask id={maskId}>
                {/* white = keep */}
                <rect x="0" y="0" width="100" height="360" rx="18" fill="white" />
                {/* black = cut out (the hole) */}
                <rect x="62" y="34" width="26" height="26" rx="6" fill="black" />
              </mask>
            </defs>

            <rect
              x="0"
              y="0"
              width="100"
              height="360"
              rx="18"
              fill="white"
              mask={`url(#${maskId})`}
            />
          </svg>
        </div>

        {/* Extra strokes (your Splash_03 “accents”) */}
        <div className={`${styles.accent} ${styles.accentA}`} />
        <div className={`${styles.accent} ${styles.accentB}`} />
      </div>

      {/* Wordmark reveal (your Splash_05) */}
      <div className={styles.wordmarkWrap} aria-hidden>
        <img className={styles.wordmark} src={wordmarkSrc} alt="Expatise" />
      </div>
    </div>
  );
}