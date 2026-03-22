'use client';

import { useEffect, useState } from 'react';
import styles from './BrandIntroSplash.module.css';
import { useT } from '@/lib/i18n/useT';

export default function BrandIntroSplash() {
  const [show, setShow] = useState(true);
  const { t } = useT();

  useEffect(() => {
    // optional: don't replay during same session
    if (sessionStorage.getItem('expatise_intro_done') === '1') {
      setShow(false);
      return;
    }

    const t = window.setTimeout(() => {
      sessionStorage.setItem('expatise_intro_done', '1');
      setShow(false);
    }, 1800); // <= 2s total

    return () => window.clearTimeout(t);
  }, []);

  if (!show) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.wordmarkSweep}>
        <img
          className={styles.wordmark}
          src="/splash/wordmark.webp"
          alt={t('shared.brandAlt')}
        />
      </div>
    </div>
  );
}
