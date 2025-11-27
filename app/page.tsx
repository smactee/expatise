'use client';

import {useState} from 'react';
import styles from './page.module.css';
import Image from 'next/image';
import DragScrollRow from "../components/DragScrollRow";



const DEFAULT_TEST_DATE = "2025-04-20"; // YYYY-MM-DD

export default function Home() {
  const [testDate, setTestDate] = useState<string>(DEFAULT_TEST_DATE);
  const [isEditingDate, setIsEditingDate] = useState(false);

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
              onClick={() => setIsEditingDate((prev) => !prev)}
            >
              My Test Day
            </button>

            {isEditingDate && (
              <input
                type="date"
                className={styles.dateInput}
                value={testDate}
                onChange={(e) => setTestDate(e.target.value)}
              />
            )}

            {/* Date + time */}
            <div className={styles.dateRow}>
              <div className={styles.bigDate}>{formattedDate}</div>
              <div className={styles.timeBlock}>
                <div className={styles.timeText}>9:00 AM</div>
                <div className={styles.caption}>Test Date</div>
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
            />
          </div>
        </section>

        {/* ===== Sections under the exam card ===== */}
        <section className={styles.sections}>
          {/* Test Mode */}
          <div className={styles.sectionGroup}>
            <h2 className={styles.sectionTitle}>Test Mode</h2>
            <DragScrollRow className={styles.dragRow}>
              <article className={styles.featureCard}>
                <p className={styles.cardTitle}>Real Test</p>
              </article>
              <article className={styles.featureCard}>
                <p className={styles.cardTitle}>Practice</p>
              </article>
              <article className={styles.featureCard}>
                <p className={styles.cardTitle}>Rapid Fire</p>
              </article>
            </DragScrollRow>
          </div>

          {/* Overall */}
          <div className={styles.sectionGroup}>
            <h2 className={styles.sectionTitle}>Overall</h2>
            <DragScrollRow className={styles.dragRow}>
              <article className={styles.featureCard}>
                <p className={styles.cardTitle}>All Questions</p>
              </article>
              <article className={styles.featureCard}>
                <p className={styles.cardTitle}>Global Common Mistakes</p>
              </article>
            </DragScrollRow>
          </div>
        

          {/* My */}
          <div className={styles.sectionGroup}>
            <h2 className={styles.sectionTitle}>My</h2>
            <DragScrollRow className={styles.dragRow}>
              <article className={styles.featureCard}>
                <p className={styles.cardTitle}>Bookmarks</p>
              </article>
              <article className={styles.featureCard}>
                <p className={styles.cardTitle}>My Mistakes</p>
              </article>
            </DragScrollRow>
          </div>
        </section>
      </div>
    </main>
  );
}
