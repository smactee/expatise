'use client';

import {useState, useRef} from 'react';
import styles from './page.module.css';
import Image from 'next/image';
import DragScrollRow from "../components/DragScrollRow";
import BottomNav from '../components/BottomNav'; 
import { useUserProfile } from '../components/UserProfile';
import { ROUTES } from '../lib/routes';
import FeatureCard from '../components/FeatureCard';


const CURRENT_YEAR = new Date().getFullYear();

const DEFAULT_TEST_DATE = `${CURRENT_YEAR}-04-20`; // default 04/20 THIS year
const DEFAULT_TEST_TIME = "09:00"; // 9 AM in 24h format

function formatTimeLabel(time: string): string {
  if (!time) return "--:--";
  const [hStr, mStr] = time.split(":");
  const h = parseInt(hStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 || 12; // 0/12 -> 12
  return `${displayH}:${mStr} ${ampm}`;
}

const TEST_MODE_CARDS = [
    {
    key: "real-test",
    href: ROUTES.realTest,
    ariaLabel: "Open Real Test",
    bgSrc: "/images/home/cards/realtest-bg.png",
    bgAlt: "Real Test Background",
    iconSrc: "/images/home/icons/realtest-icon.png",
    iconAlt: "Real Test Icon",
    topText: "Practice under real exam conditions with a timer.",
    title:  "Real Test",
   },
   
    {
    key: "practice-test",
    href: `${ROUTES.comingSoon}?feature=practice-test`,
    ariaLabel: "Open Practice Test",
    bgSrc: "/images/home/cards/practice-bg.png",
    bgAlt: "Practice Background",
    iconSrc: "/images/home/icons/practice-icon.png",
    iconAlt: "Practice Icon",
    topText: "Study at your own pace. No time limit!",
    title:  "Practice Test",
   },
     {
    key: "quick-test",
    href: `${ROUTES.comingSoon}?feature=quick-test`,
    ariaLabel: "Open Quick Test",
    bgSrc: "/images/home/cards/quicktest-bg.png",
    bgAlt: "Quick Test Background",
    iconSrc: "/images/home/icons/globalmistakes-icon.png",
    iconAlt: "Quick Test Icon",
    topText: "Half the questions. Half the time.",
    title: "Quick Test",
  },

    {
    key: "rapid-fire-test",
    href: `${ROUTES.comingSoon}?feature=rapid-fire-test`,
    ariaLabel: "Open Rapid Fire Test",
    bgSrc: "/images/home/cards/rapidfire-bg.png",
    bgAlt: "Rapid Fire Background",
    iconSrc: "/images/home/icons/rapidfire-icon.png",
    iconAlt: "Rapid Fire Icon",
    topText: "Sharpen your reflexes and memory in bursts.",
    title:  "Rapid Fire Test",
    },
    

] as const;

const OVERALL_CARDS = [
  {
    key: "all-questions",
    href: ROUTES.allQuestions,
    ariaLabel: "Open All Questions",
    bgSrc: "/images/home/cards/allquestions-bg.png",
    bgAlt: "All Questions Background",
    iconSrc: "/images/home/icons/allquestions-icon.png",
    iconAlt: "All Questions Icon",
    topText: "Filter through the entire questions bank.",
    title: "All Questions",
  },
  {
  key: "global-common-mistakes",
  href: `${ROUTES.comingSoon}?feature=global-common-mistakes`,
  ariaLabel: "Open Global Common Mistakes",
  bgSrc: "/images/home/cards/globalmistakes-bg.png",
  bgAlt: "Global Common Mistakes Background",
  iconSrc: "/images/home/icons/globalmistake-icon.png",
  iconAlt: "Global Common Mistakes Icon",
  topText: "See which questions others miss most.",
  title: "Global Common Mistakes",
},

] as const;

const MY_CARDS = [
  {
  key: "my-bookmarks",
  href: ROUTES.bookmarks,
  ariaLabel: "Open My Bookmarks",
  bgSrc: "/images/home/cards/bookmark-bg.png",
  bgAlt: "My Bookmarks Background",
  iconSrc: "/images/home/icons/bookmarks-icon.png",
  iconAlt: "Bookmark Icon",
  topText: "Save questions and build your own study list.",
  title: "My Bookmarks",
  },
  {
  key: "my-mistakes",
  href: ROUTES.mistakes,
  ariaLabel: "Open My Mistakes",
  bgSrc: "/images/home/cards/mymistakes-bg.png",
  bgAlt: "My Mistakes Background",
  iconSrc: "/images/home/icons/mymistakes-icon.png",
  iconAlt: "My Mistakes Icon",
  topText: "Revisit questions you got wrong.",
  title: "My Mistakes",
  },

] as const



export default function Home() {
  const [testDate, setTestDate] = useState<string>(DEFAULT_TEST_DATE);
  const [testTime, setTestTime] = useState<string>(DEFAULT_TEST_TIME);

// Modal state for "When's your test?" sheet
const [isTestModalOpen, setIsTestModalOpen] = useState(false);
const [pendingDate, setPendingDate] = useState<string | null>(null);
const [pendingTime, setPendingTime] = useState<string | null>(null);
// NEW: refs for hidden date/time inputs in the modal
  const modalDateInputRef = useRef<HTMLInputElement | null>(null);
  const modalTimeInputRef = useRef<HTMLInputElement | null>(null);

const displayTime = formatTimeLabel(testTime);

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
const modalTimeLabel = formatTimeLabel(modalSourceTime);


  return (
    <main className={styles.page}>
      <div className={styles.content}>
        {/* === Exam Registration Card === */}
        <section className={styles.examCard}>
          {/* Left side: text */}
          <div className={styles.examText}>
            <p className={styles.examLabel}>Exam</p>
            <h1 className={styles.examTitle}>Registration</h1>

            <button
  type="button"
  className={styles.myTestDayButton}
  onClick={openTestModal}
>
  My Test Day:
</button>



            {/* Date + time */}
<div
  className={styles.dateRow}
  onClick={openTestModal}
>
  <span className={styles.bigDate}>{formattedDate}</span>

  <div className={styles.timeBlock}>
    <span className={styles.timeText}>{displayTime}</span>
    <div className={styles.caption}>Test Time</div>
  </div>
</div>


            {/* Days left */}
            <div className={styles.daysLeftContainer}>
              <div className={styles.daysLeftNumber}>
                {daysLeft !== null ? daysLeft : "-"}
              </div>
              <div className={styles.caption}>Days Left</div>
            </div>
          </div>

          {/* Right side: blue car */}
          <div className={styles.carHero}>
            <Image
              src="/images/home/blue-car.png"
              alt="Blue car"
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
<h2 className={styles.sectionTitle}>Test Mode</h2>
            
{/* Real Test */}
<DragScrollRow className={styles.dragRow}>
{TEST_MODE_CARDS.map((card) => (
    <FeatureCard
      key={card.key}
      href={card.href}
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
<h2 className={styles.sectionTitle}>Overall</h2>
<DragScrollRow className={styles.dragRow}>
{/* All Questions */}
{OVERALL_CARDS.map((card) => (
  <FeatureCard
    key={card.key}
    href={card.href}
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
            <h2 className={styles.sectionTitle}>My</h2>
<DragScrollRow className={styles.dragRow}>
{/* Bookmark */}
{MY_CARDS.map((card) => (
    <FeatureCard
      key={card.key}
      href={card.href}
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

<BottomNav />
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
              <button
                type="button"
                className={styles.testModalBackButton}
                onClick={closeTestModal}
              >
                <span className={styles.testModalBackIcon}>‹</span>
                <span className={styles.testModalBackText}>Back</span>
              </button>
            </div>

{/* Top greeting card */}
<div className={styles.testModalHeaderCard}>
  <div className={styles.testModalHeaderLeft}>
    <div className={styles.testModalGreetingRow}>
      <span className={styles.testModalGreetingText}>Have a great day!</span>
      <span className={styles.testModalSunIcon}></span>
      <Image 
        src="/images/home/icons/sun.png"
        alt="Sun icon"
        width={16}
        height={16}
        className={styles.testModalSunImage}
      />
    </div>

    <div className={styles.testModalName}>
      {userName || 'Expat Expertise'}
      </div>
    <div className={styles.testModalSubtext}>
      Don&apos;t miss your exam date!
    </div>
  </div>

  <div className={styles.testModalAvatarWrapper}>
    <Image
      src={avatarSrc}
      alt={`${userName} avatar`}
      fill
      sizes="44px"
      className={styles.testModalAvatar}
    />
  </div>
</div>

            {/* Main card */}
            <div className={styles.testModalMainCard}>
              <h2 className={styles.testModalTitle}>
                When&apos;s your <span>Test?</span>
              </h2>
              <p className={styles.testModalDescription}>
                Your test date will be updated on the home page,
                making it easy for you to see and remember.
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
    <span className={styles.testModalDateLabel}>MM</span>
    <span className={styles.testModalDateValue}>{modalMonth}</span>
  </div>
  <div className={styles.testModalDateBox}>
    <span className={styles.testModalDateLabel}>DD</span>
    <span className={styles.testModalDateValue}>{modalDay}</span>
  </div>
  <div className={styles.testModalDateBox}>
    <span className={styles.testModalDateLabel}>YYYY</span>
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
    <span className={styles.testModalDateLabel}>TIME</span>
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
                  Set The Day
                </button>
                <button
                  type="button"
                  className={styles.testModalSecondaryButton}
                  onClick={closeTestModal}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}