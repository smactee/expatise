'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import styles from './onboarding.module.css';

export default function OnboardingPage() {
  const router = useRouter();

  const handleGetStarted = async () => {
    const res = await fetch('/api/onboarding', { method: 'POST' });
    if (!res.ok) return;
    router.replace('/login'); // replace = “don’t show onboarding on back”
  };

  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <div className={styles.hero}>
          <Image
            src="/images/auth/onboarding-girl.png"
            alt="Onboarding hero"
            fill
            priority
            className={styles.heroImg}
          />
          <div className={styles.heroFade} />
        </div>

        <section className={styles.sheet}>
          <h1 className={styles.title}>
  Study For The <span className={styles.highlight}>Driver&apos;s&nbsp;License</span>
  <br />
  Test Wherever You Are
</h1>

          <p className={styles.subtitle}>Get easy access to prepare for your license.</p>

          <button className={styles.cta} onClick={handleGetStarted}>
            Get Started
          </button>
        </section>
      </div>
    </main>
  );
}
