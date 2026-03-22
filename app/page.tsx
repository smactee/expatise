// app/page.tsx

'use client';

import {useState, useRef} from 'react';
import styles from './page.module.css';
import Image from 'next/image';
import DragScrollRow from "../components/DragScrollRow";
import BottomNav from '../components/BottomNav'; 
import { useUserProfile } from '../components/UserProfile';
import { ROUTES } from '../lib/routes';
import FeatureCard from '../components/FeatureCard';
import BackButton from '@/components/BackButton';
import { useEntitlements } from '@/components/EntitlementsProvider.client';
import { useUsageCap } from '@/lib/freeAccess/useUsageCap';
import { useT } from '@/lib/i18n/useT';



const CURRENT_YEAR = new Date().getFullYear();

const DEFAULT_TEST_DATE = `${CURRENT_YEAR}-04-20`; // default 04/20 THIS year
const DEFAULT_TEST_TIME = "09:00"; // 9 AM in 24h format

function formatTimeLabel(time: string, labels: { am: string; pm: string }): string {
  if (!time) return "--:--";
  const [hStr, mStr] = time.split(":");
  const h = parseInt(hStr, 10);
  const ampm = h >= 12 ? labels.pm : labels.am;
  const displayH = h % 12 || 12; // 0/12 -> 12
  return `${displayH}:${mStr} ${ampm}`;
}

export default function Home() {
  const { t } = useT();
  const [testDate, setTestDate] = useState<string>(DEFAULT_TEST_DATE);
  const [testTime, setTestTime] = useState<string>(DEFAULT_TEST_TIME);
  const { isPremium, loading: entitlementsLoading } = useEntitlements();
  const { isOverCap } = useUsageCap();

// Modal state for "When's your test?" sheet
const [isTestModalOpen, setIsTestModalOpen] = useState(false);
const [pendingDate, setPendingDate] = useState<string | null>(null);
const [pendingTime, setPendingTime] = useState<string | null>(null);
// NEW: refs for hidden date/time inputs in the modal
  const modalDateInputRef = useRef<HTMLInputElement | null>(null);
  const modalTimeInputRef = useRef<HTMLInputElement | null>(null);

const displayTime = formatTimeLabel(testTime, {
  am: t('home.time.am'),
  pm: t('home.time.pm'),
});

// Pull user profile info
const { 
  name: userName, 
  avatarUrl: userAvatarSrc,
} = useUserProfile();
const avatarSrc = userAvatarSrc || '/images/profile/imageupload-icon.png';

  // ===== modal helpers =====
const openTestModal = () => {
  setPendingDate(testDate);
  setPendingTime(testTime);
  setIsTestModalOpen(true);
};

const closeTestModal = () => {
  setIsTestModalOpen(false);
  setPendingDate(null);
  setPendingTime(null);
};

const handleConfirmTestDay = () => {
  if (pendingDate) {
    setTestDate(pendingDate);
  }
  if (pendingTime) {
    setTestTime(pendingTime);
  }
  closeTestModal();
};

  // NEW: force open native date picker
  const openModalDatePicker = () => {
    const input = modalDateInputRef.current;
    if (!input) return;

    // Some browsers support .showPicker()
    // @ts-ignore
    if (input.showPicker) {
      // @ts-ignore
      input.showPicker();
    } else {
      input.click();
    }
  };

  // NEW: force open native time picker
  const openModalTimePicker = () => {
    const input = modalTimeInputRef.current;
    if (!input) return;

    // @ts-ignore
    if (input.showPicker) {
      // @ts-ignore
      input.showPicker();
    } else {
      input.click();
    }
  };

  // Calculate formatted date and days left countdown
  let formattedDate = "-";
  let daysLeft: number | null = null;
  if (testDate) {
    const test = new Date(testDate + "T00:00:00");
    const today = new Date();
    const startofToday = new Date (
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );

    const diffMs = test.getTime() - startofToday.getTime();
    const msPerDay = 1000 * 60 * 60 * 24;
    daysLeft = Math.max(0, Math.ceil(diffMs / msPerDay));

    const month = String(test.getMonth() + 1).padStart(2, "0");
    const day = String(test.getDate()).padStart(2, "0");
    formattedDate = `${month}/${day}`;
  }

    // values to show inside the modal boxes
 // Which date/time should the modal show?
// If the user has already picked something in the modal (pending*),
// use that; otherwise fall back to the saved values.
const modalSourceDate: string = pendingDate ?? testDate;
const modalSourceTime: string = pendingTime ?? testTime;

// Break date into pieces for the MM / DD / YYYY labels
const modalDate = new Date(modalSourceDate + 'T00:00:00');
const modalYear = modalDate.getFullYear();
const modalMonth = modalDate.getMonth() + 1;
const modalDay = modalDate.getDate();

// Pretty label for the time in the modal ("9:00 AM")
const modalTimeLabel = formatTimeLabel(modalSourceTime, {
  am: t('home.time.am'),
  pm: t('home.time.pm'),
});
const shouldTriggerPremiumModal = !entitlementsLoading && !isPremium && isOverCap;

const testModeCards = [
  {
    key: "real-test",
    href: "/test/real",
    ariaLabel: t('home.cards.testModes.real.ariaLabel'),
    bgSrc: "/images/home/cards/realtest-bg.png",
    bgAlt: t('home.cards.testModes.real.bgAlt'),
    iconSrc: "/images/home/icons/realtest-icon.png",
    iconAlt: t('home.cards.testModes.real.iconAlt'),
    topText: t('home.cards.testModes.real.topText'),
    title: t('home.cards.testModes.real.title'),
  },
  {
    key: "ten-percent-test",
    href: "/test/ten-percent",
    ariaLabel: t('home.cards.testModes.tenPercent.ariaLabel'),
    bgSrc: "/images/home/cards/quicktest-bg.png",
    bgAlt: t('home.cards.testModes.tenPercent.bgAlt'),
    iconSrc: "/images/home/icons/rapidfire-icon.png",
    iconAlt: t('home.cards.testModes.tenPercent.iconAlt'),
    topText: t('home.cards.testModes.tenPercent.topText'),
    title: t('home.cards.testModes.tenPercent.title'),
  },
  {
    key: "practice-test",
    href: "/test/practice",
    ariaLabel: t('home.cards.testModes.practice.ariaLabel'),
    bgSrc: "/images/home/cards/practice-bg.png",
    bgAlt: t('home.cards.testModes.practice.bgAlt'),
    iconSrc: "/images/home/icons/practice-icon.png",
    iconAlt: t('home.cards.testModes.practice.iconAlt'),
    topText: t('home.cards.testModes.practice.topText'),
    title: t('home.cards.testModes.practice.title'),
  },
  {
    key: "half-test",
    href: "/test/half",
    ariaLabel: t('home.cards.testModes.half.ariaLabel'),
    bgSrc: "/images/home/cards/quicktest-bg.png",
    bgAlt: t('home.cards.testModes.half.bgAlt'),
    iconSrc: "/images/home/icons/globalmistakes-icon.png",
    iconAlt: t('home.cards.testModes.half.iconAlt'),
    topText: t('home.cards.testModes.half.topText'),
    title: t('home.cards.testModes.half.title'),
  },
  {
    key: "rapid-fire-test",
    href: "/test/rapid",
    ariaLabel: t('home.cards.testModes.rapid.ariaLabel'),
    bgSrc: "/images/home/cards/rapidfire-bg.png",
    bgAlt: t('home.cards.testModes.rapid.bgAlt'),
    iconSrc: "/images/home/icons/rapidfire-icon.png",
    iconAlt: t('home.cards.testModes.rapid.iconAlt'),
    topText: t('home.cards.testModes.rapid.topText'),
    title: t('home.cards.testModes.rapid.title'),
  },
] as const;

const overallCards = [
  {
    key: "all-questions",
    href: ROUTES.allQuestions,
    ariaLabel: t('home.cards.overall.allQuestions.ariaLabel'),
    bgSrc: "/images/home/cards/allquestions-bg.png",
    bgAlt: t('home.cards.overall.allQuestions.bgAlt'),
    iconSrc: "/images/home/icons/allquestions-icon.png",
    iconAlt: t('home.cards.overall.allQuestions.iconAlt'),
    topText: t('home.cards.overall.allQuestions.topText'),
    title: t('home.cards.overall.allQuestions.title'),
  },
  {
    key: "global-mistakes",
    href: ROUTES.globalCommonMistakes,
    ariaLabel: t('home.cards.overall.globalMistakes.ariaLabel'),
    bgSrc: "/images/home/cards/globalmistakes-bg.png",
    bgAlt: t('home.cards.overall.globalMistakes.bgAlt'),
    iconSrc: "/images/home/icons/globalmistake-icon.png",
    iconAlt: t('home.cards.overall.globalMistakes.iconAlt'),
    topText: t('home.cards.overall.globalMistakes.topText'),
    title: t('home.cards.overall.globalMistakes.title'),
  },
] as const;

const myCards = [
  {
    key: "my-bookmarks",
    href: ROUTES.bookmarks,
    ariaLabel: t('home.cards.my.bookmarks.ariaLabel'),
    bgSrc: "/images/home/cards/bookmark-bg.png",
    bgAlt: t('home.cards.my.bookmarks.bgAlt'),
    iconSrc: "/images/home/icons/bookmarks-icon.png",
    iconAlt: t('home.cards.my.bookmarks.iconAlt'),
    topText: t('home.cards.my.bookmarks.topText'),
    title: t('home.cards.my.bookmarks.title'),
  },
  {
    key: "my-mistakes",
    href: ROUTES.mistakes,
    ariaLabel: t('home.cards.my.mistakes.ariaLabel'),
    bgSrc: "/images/home/cards/mymistakes-bg.png",
    bgAlt: t('home.cards.my.mistakes.bgAlt'),
    iconSrc: "/images/home/icons/mymistakes-icon.png",
    iconAlt: t('home.cards.my.mistakes.iconAlt'),
    topText: t('home.cards.my.mistakes.topText'),
    title: t('home.cards.my.mistakes.title'),
  },
] as const;

const homeCardHref = (href: string) =>
  shouldTriggerPremiumModal
    ? `${href}${href.includes('?') ? '&' : '?'}premiumModal=1`
    : href;


  return (
    <main className={styles.page}>
      <div className={styles.content}>
        {/* === Exam Registration Card === */}
        <section className={styles.examCard}>
          {/* Left side: text */}
          <div className={styles.examText}>
            <p className={styles.examLabel}>{t('home.examCard.label')}</p>
            <h1 className={styles.examTitle}>{t('home.examCard.title')}</h1>

            <button
  type="button"
  className={styles.myTestDayButton}
  onClick={openTestModal}
>
  {t('home.examCard.myTestDay')}
</button>



            {/* Date + time */}
<div
  className={styles.dateRow}
  onClick={openTestModal}
>
  <span className={styles.bigDate}>{formattedDate}</span>

  <div className={styles.timeBlock}>
    <span className={styles.timeText}>{displayTime}</span>
    <div className={styles.caption}>{t('home.examCard.testTime')}</div>
  </div>
</div>


            {/* Days left */}
            <div className={styles.daysLeftContainer}>
              <div className={styles.daysLeftNumber}>
                {daysLeft !== null ? daysLeft : "-"}
              </div>
              <div className={styles.caption}>{t('home.examCard.daysLeft')}</div>
            </div>
          </div>

          {/* Right side: blue car */}
          <div className={styles.carHero}>
            <Image
              src="/images/home/blue-car.png"
              alt={t('home.examCard.carAlt')}
              width={493}
              height={437}
              priority
              className={styles.carImage}
              draggable={false}
            />
          </div>
        </section>

{/* ===== Sections under the exam card ===== */}
<section className={styles.sections}>
{/* Test Mode */}
<div className={styles.sectionGroup}>
<h2 className={styles.sectionTitle}>{t('home.sections.testMode')}</h2>
            
{/* Real Test */}
<DragScrollRow className={styles.dragRow}>
 {testModeCards.map((card) => (
    <FeatureCard
      key={card.key}
      href={homeCardHref(card.href)}
      ariaLabel={card.ariaLabel}
      bgSrc={card.bgSrc}
      bgAlt={card.bgAlt}
      iconSrc={card.iconSrc}
      iconAlt={card.iconAlt}
      topText={card.topText}
      title={card.title}
    />
  ))}

{/* Practice */}
{/* Rapid Fire */}
            </DragScrollRow>
          </div>


{/* Overall */}
 <div className={styles.sectionGroup}>
<h2 className={styles.sectionTitle}>{t('home.sections.overall')}</h2>
<DragScrollRow className={styles.dragRow}>
{/* All Questions */}
{overallCards.map((card) => (
  <FeatureCard
    key={card.key}
    href={homeCardHref(card.href)}
    ariaLabel={card.ariaLabel}
    bgSrc={card.bgSrc}
    bgAlt={card.bgAlt}
    iconSrc={card.iconSrc}
    iconAlt={card.iconAlt}
    topText={card.topText}
    title={card.title}
  />
))}
{/* Global Common Mistakes */}
</DragScrollRow>
</div>


{/* My */}
          <div className={styles.sectionGroup}>
            <h2 className={styles.sectionTitle}>{t('home.sections.my')}</h2>
<DragScrollRow className={styles.dragRow}>
{/* Bookmark */}
{myCards.map((card) => (
    <FeatureCard
      key={card.key}
      href={homeCardHref(card.href)}
      ariaLabel={card.ariaLabel}
      bgSrc={card.bgSrc}
      bgAlt={card.bgAlt}
      iconSrc={card.iconSrc}
      iconAlt={card.iconAlt}
      topText={card.topText}
      title={card.title}
    />
  ))}
</DragScrollRow>
</div>
</section>


</div>

      {/* Test Day Modal */}
      {isTestModalOpen && (
        <div
          className={styles.testModalBackdrop}
          onClick={closeTestModal}
        >
          <div
            className={styles.testModalSheet}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with back */}
            <div className={styles.testModalHeader}>
  <BackButton variant="inline" onClick={closeTestModal} />
</div>


{/* Top greeting card */}
<div className={styles.testModalHeaderCard}>
  <div className={styles.testModalHeaderLeft}>
    <div className={styles.testModalGreetingRow}>
      <span className={styles.testModalGreetingText}>{t('home.modal.greeting')}</span>
      <span className={styles.testModalSunIcon}></span>
      <Image 
        src="/images/home/icons/sun.png"
        alt={t('home.modal.sunAlt')}
        width={16}
        height={16}
        className={styles.testModalSunImage}
      />
    </div>

    <div className={styles.testModalName}>
      {userName || t('home.modal.fallbackName')}
      </div>
    <div className={styles.testModalSubtext}>
      {t('home.modal.subtitle')}
    </div>
  </div>

  <div className={styles.testModalAvatarWrapper}>
    <Image
      src={avatarSrc}
      alt={t('home.modal.avatarAlt', { name: userName || t('home.modal.fallbackName') })}
      fill
      sizes="44px"
      className={styles.testModalAvatar}
    />
  </div>
</div>

            {/* Main card */}
            <div className={styles.testModalMainCard}>
              <h2 className={styles.testModalTitle}>
                {t('home.modal.titleBefore')} <span>{t('home.modal.titleHighlight')}</span>
              </h2>
              <p className={styles.testModalDescription}>
                {t('home.modal.description')}
              </p>

{/* MM / DD / YYYY row */}
<div className={styles.testModalDateRow}
  onClick={openModalDatePicker}>
  {/* Invisible native date input covering the whole row */}
  <input
    type="date"
    ref={modalDateInputRef}
    className={styles.testModalHiddenDateInput}
    value={modalSourceDate}
    onChange={(e) => setPendingDate(e.target.value)}
  />

  <div className={styles.testModalDateBox}>
    <span className={styles.testModalDateLabel}>{t('home.modal.monthLabel')}</span>
    <span className={styles.testModalDateValue}>{modalMonth}</span>
  </div>
  <div className={styles.testModalDateBox}>
    <span className={styles.testModalDateLabel}>{t('home.modal.dayLabel')}</span>
    <span className={styles.testModalDateValue}>{modalDay}</span>
  </div>
  <div className={styles.testModalDateBox}>
    <span className={styles.testModalDateLabel}>{t('home.modal.yearLabel')}</span>
    <span className={styles.testModalDateValue}>{modalYear}</span>
  </div>
</div>

{/* Time row */}
<div className={styles.testModalTimeRow}
  onClick={openModalTimePicker} 
  >
  {/* Invisible native time input covering the whole row */}
  <input
    ref={modalTimeInputRef}
    type="time"
    className={styles.testModalHiddenDateInput}
    value={modalSourceTime}
    onChange={(e) => setPendingTime(e.target.value)}
  />

  <div className={styles.testModalTimeBox}>
    <span className={styles.testModalDateLabel}>{t('home.modal.timeLabel')}</span>
    <span className={styles.testModalDateValue}>{modalTimeLabel}</span>
  </div>
</div>



              {/* Buttons */}
              <div className={styles.testModalButtons}>
                <button
                  type="button"
                  className={styles.testModalPrimaryButton}
                  onClick={handleConfirmTestDay}
                >
                  {t('home.modal.setDay')}
                </button>
                <button
                  type="button"
                  className={styles.testModalSecondaryButton}
                  onClick={closeTestModal}
                >
                  {t('shared.common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <BottomNav />
    </main>
  );
}
