'use client';

import {useState, useRef} from 'react';
import styles from './page.module.css';
import Image from 'next/image';
import DragScrollRow from "../components/DragScrollRow";
import BottomNav from '../components/BottomNav'; 




const DEFAULT_TEST_DATE = "2025-04-20"; // YYYY-MM-DD
function formatTimeLabel(time: string): string {
  if (!time) return "--:--";
  const [hStr, mStr] = time.split(":");
  const h = parseInt(hStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 || 12; // 0/12 -> 12
  return `${displayH}:${mStr} ${ampm}`;
}

const DEFAULT_TEST_TIME = "09:00"; // 9 AM in 24h format


export default function Home() {
  const [testDate, setTestDate] = useState<string>(DEFAULT_TEST_DATE);
  const [testTime, setTestTime] = useState<string>(DEFAULT_TEST_TIME);

// Modal state for "When's your test?" sheet
const [isTestModalOpen, setIsTestModalOpen] = useState(false);
const [pendingDate, setPendingDate] = useState<string | null>(null);
const modalDateInputRef = useRef<HTMLInputElement | null>(null);
const [pendingTime, setPendingTime] = useState<string | null>(null);
const modalTimeInputRef = useRef<HTMLInputElement | null>(null);

const displayTime = formatTimeLabel(testTime);

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


  const openModalDatePicker = () => {
    const input = modalDateInputRef.current;
    if (!input) return;
    // @ts-ignore
    if (input.showPicker) {
      // @ts-ignore
      input.showPicker();
    } else {
      input.click();
    }
  };

  const openModalTimePicker = () => {
  const input = modalTimeInputRef.current;
  if (!input) return;
  // Some browsers support showPicker()
  // @ts-ignore
  if (input.showPicker) {
    // @ts-ignore
    input.showPicker();
  } else {
    input.click();
  }
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
              <article className={styles.featureCard}>
                <Image
                  src="/images/home/cards/realtest-bg.png"
                  alt="Real Test Background"
                  fill
                  className={styles.cardBgImage}
                  draggable={false}
                />
                <div className={styles.cardTopRow}>
                <div className={styles.cardIcon}>
                  <Image
                    src="/images/home/icons/realtest-icon.png"
                    alt="Real Test Icon"
                    fill
                    draggable={false}
                  />
                </div>
                <p className={styles.cardTopText}>Practice under real exam conditions with a timer.</p>
                </div>
                <div className={styles.cardContent}>
                <p className={styles.cardTitle}>Real Test</p>
                </div>
              </article>

              {/* Practice */}
              <article className={styles.featureCard}>
                <Image
                  src="/images/home/cards/practice-bg.png"
                  alt="Practice Background"
                  fill
                  className={styles.cardBgImage}
                  draggable={false}
                />
                <div className={styles.cardTopRow}>
                <div className={styles.cardIcon}>
                <Image 
                  src="/images/home/icons/practice-icon.png"
                  alt="Practice Icon"
                  fill
                  draggable={false}
                />
                </div>
                <p className={styles.cardTopText}>Study at your own pace. No time limit!</p>
                </div>
                <div className={styles.cardContent}>
                <p className={styles.cardTitle}>Practice</p>
                </div>
              </article>

              {/* Rapid Fire */}
              <article className={styles.featureCard}>
                <Image
                  src="/images/home/cards/rapidfire-bg.png"
                  alt="Rapid Fire Background"
                  fill
                  className={styles.cardBgImage}
                  draggable={false}
                />
                <div className={styles.cardTopRow}>
                <div className={styles.cardIcon}>
                <Image 
                  src="/images/home/icons/rapidfire-icon.png"
                  alt="Rapid Fire Icon"
                  fill
                  draggable={false}
                />
                </div>
                <p className={styles.cardTopText}>Sharpen your reflexes and memory in bursts.</p>
                </div>
                <div className={styles.cardContent}>
                <p className={styles.cardTitle}>Rapid Fire</p>
                </div>
              </article>
            </DragScrollRow>
          </div>

          {/* Overall */}
          <div className={styles.sectionGroup}>
            <h2 className={styles.sectionTitle}>Overall</h2>
            <DragScrollRow className={styles.dragRow}>
              {/* All Questions */}
              <article className={styles.featureCard}>
                <Image
                  src="/images/home/cards/allquestions-bg.png"
                  alt="All Questions Background"
                  fill
                  className={styles.cardBgImage}
                  draggable={false}
                />
                <div className={styles.cardTopRow}>
                <div className={styles.cardIcon}>
                <Image 
                  src="/images/home/icons/allquestions-icon.png"
                  alt="All Questions Icon"
                  fill
                  draggable={false}
                />
                </div>
                <p className={styles.cardTopText}>Filter through the entire questions bank.</p>
                </div>
                <div className={styles.cardContent}>
                <p className={styles.cardTitle}>All Questions</p>
                </div>
              </article>
              

              {/* Global Common Mistakes */}
              <article className={styles.featureCard}>
                <Image
                  src="/images/home/cards/globalmistakes-bg.png"
                  alt="Global Common Mistakes Background"
                  fill
                  className={styles.cardBgImage}
                  draggable={false}
                />
                <div className={styles.cardTopRow}>
                <div className={styles.cardIcon}>
                <Image 
                  src="/images/home/icons/globalmistakes-icon.png"
                  alt="Global Common Mistakes Icon"
                  fill
                  draggable={false}
                />
                </div>
                <p className={styles.cardTopText}>See which questions others miss most.</p>
                </div>
                <div className={styles.cardContent}>
                <p className={styles.cardTitle}>Global Common Mistakes</p>
                </div>
              </article>
            </DragScrollRow>
          </div>
        

          {/* My */}
          <div className={styles.sectionGroup}>
            <h2 className={styles.sectionTitle}>My</h2>
            <DragScrollRow className={styles.dragRow}>
              {/* Bookmark */}
              <article className={styles.featureCard}>
                <Image
                  src="/images/home/cards/bookmark-bg.png"
                  alt="Bookmarks Background"
                  fill
                  className={styles.cardBgImage}
                  draggable={false}
                />
                <div className={styles.cardTopRow}>
                <div className={styles.cardIcon}>
                <Image 
                  src="/images/home/icons/bookmark-icon.png"
                  alt="Bookmark Icon"
                  fill
                  draggable={false}
                />
                </div>
                <p className={styles.cardTopText}>Save questions and build your own study list.</p>
                </div>
                <div className={styles.cardContent}>
                <p className={styles.cardTitle}>Bookmark</p>
                </div>
              </article>
              {/* My Mistakes */}
              <article className={styles.featureCard}>
                <Image
                  src="/images/home/cards/mymistakes-bg.png"
                  alt="My Mistakes Background"
                  fill
                  className={styles.cardBgImage}
                  draggable={false}
                />
                <div className={styles.cardTopRow}>
                <div className={styles.cardIcon}>
                <Image 
                  src="/images/home/icons/mymistakes-icon.png"
                  alt="My Mistakes Icon"
                  fill
                  draggable={false}
                />
                </div>
                <p className={styles.cardTopText}>Revisit questions you got wrong.</p>
                </div>
                <div className={styles.cardContent}>
                <p className={styles.cardTitle}>My Mistakes</p>
                </div>
              </article>
            </DragScrollRow>
          </div>
        </section>
                <BottomNav />
      </div>

      {/* Test Day Modal (fake page) */}
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

            {/* Main card */}
            <div className={styles.testModalMainCard}>
              <h2 className={styles.testModalTitle}>
                When&apos;s your <span>Test?</span>
              </h2>
              <p className={styles.testModalDescription}>
                Your test date will be beautifully updated on the home page
                hero banner, making it easy to see and remember.
              </p>

              {/* MM / DD / YYYY row (click triggers native picker) */}
              <div
                className={styles.testModalDateRow}
                onClick={openModalDatePicker}
              >
                <div className={styles.testModalDateBox}>
                  <span className={styles.testModalDateLabel}>MM</span>
                  <span className={styles.testModalDateValue}>
                    {modalMonth}
                  </span>
                </div>
                <div className={styles.testModalDateBox}>
                  <span className={styles.testModalDateLabel}>DD</span>
                  <span className={styles.testModalDateValue}>
                    {modalDay}
                  </span>
                </div>
                <div className={styles.testModalDateBox}>
                  <span className={styles.testModalDateLabel}>YYYY</span>
                  <span className={styles.testModalDateValue}>
                    {modalYear}
                  </span>
                </div>
              </div>

            {/* Time row */}
<div
  className={styles.testModalTimeRow}
  onClick={openModalTimePicker}
>
  <div className={styles.testModalTimeBox}>
    <span className={styles.testModalDateLabel}>Time</span>
    <span className={styles.testModalDateValue}>{modalTimeLabel}</span>
  </div>
</div>

{/* Hidden native time input */}
<input
  ref={modalTimeInputRef}
  type="time"
  className={styles.testModalHiddenDateInput}
  value={modalSourceTime}
  onChange={(e) => setPendingTime(e.target.value)}
/>


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

