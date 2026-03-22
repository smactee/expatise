//app/onboarding/page.tsx
'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import styles from './onboarding.module.css';
import { markOnboarded } from '@/lib/onboarding/markOnboarded.client';
import { useT } from '@/lib/i18n/useT';

export default function OnboardingPage() {
  const router = useRouter();
  const { t } = useT();

const handleGetStarted = () => {
  try {
    markOnboarded();
  } catch {
    // optional: show UI error, but usually you can ignore
  }
  router.replace("/login"); // don't show onboarding on back
};

  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <div className={styles.hero}>
          <Image
            src="/images/auth/onboarding-girl.png"
            alt={t('onboarding.heroAlt')}
            fill
            priority
            className={styles.heroImg}
          />
          <div className={styles.heroFade} />
        </div>

        <section className={styles.sheet}>
          <h1 className={styles.title}>
  {t('onboarding.title.before')}{' '}
  <span className={styles.highlight}>{t('onboarding.title.highlight')}</span>
  <br />
  {t('onboarding.title.after')}
</h1>

          <p className={styles.subtitle}>{t('onboarding.subtitle')}</p>

          <button className={styles.cta} onClick={handleGetStarted}>
            {t('onboarding.cta')}
          </button>
        </section>
      </div>
    </main>
  );
}
