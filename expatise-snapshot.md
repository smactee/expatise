### app/globals.css
```css
@import "tailwindcss";

/* Base variables (used by Tailwind, etc.) */
:root {
  --background: #ffffff;
  --foreground: #171717;
}

/* Hook Tailwind theme to our CSS vars */
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

/* Prefer dark if no explicit theme stored (only for the old bg/fg vars) */
@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;
    --foreground: #ededed;
  }
}

/* 🔥 Theme system for app styling */

/* Default = dark theme */
:root {
  color-scheme: dark;
  --bg-app: #050816;
  --bg-card: #111827;
  --bg-subtle: #0b1020;
  --text-main: #f9fafb;
  --text-muted: #9ca3af;
  --border-subtle: rgba(148, 163, 184, 0.35);
  --accent: #6366f1;
  --accent-soft: rgba(99, 102, 241, 0.18);
}

/* Light theme overrides (when ThemeProvider sets data-theme="light") */
:root[data-theme='light'] {
  color-scheme: light;
  --bg-app: #f3f4f6;
  --bg-card: #ffffff;
  --bg-subtle: #e5e7eb;
  --text-main: #111827;
  --text-muted: #6b7280;
  --border-subtle: rgba(209, 213, 219, 1);
  --accent: #6366f1;
  --accent-soft: rgba(79, 70, 229, 0.08);
}

/* Base page background + text color */
html,
body {
  margin: 0;
  padding: 0;
}

body {
  /* This is what will visually change when theme changes */
  background-color: var(--bg-app);
  color: var(--text-main);
  font-family: var(--font-sans), system-ui, -apple-system, BlinkMacSystemFont,
    'SF Pro Text', 'Segoe UI', sans-serif;
}

```

### app/layout.tsx
```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from '../components/ThemeProvider';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Expatise - Exam Preparation Made Easy",
  description: "Prepare for your Chinese driving exam with ease using Expatise. Practice, track your progress, and ace your test!",
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

```

### app/page.module.css
```css
/* app/page.module.css */

/* Overall page */
.page {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  background: linear-gradient(180deg, #e6f3ff, #f4f7ff);
  padding: 24px 16px 40px;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text",
    "Segoe UI", sans-serif;
}

.content {
  width: 100%;
  max-width: 560px;                /* roughly modern phone width */
  margin: 60px auto 40px;             /* center column on desktop */
  padding: 0 16px;            /* small side padding */
}


/* Exam card */
.examCard {
  width: 100%;
  aspect-ratio: 656 / 343;     /* match Figma card shape */
  display: flex;
  align-items: center;         /* text + car vertically centered */
  padding: 24px 24px 26px;     /* adjust spacing to taste */
  border-radius: 32px;         /* looks closer to your Figma rounding */
  /* Base color + Figma-style linear gradient overlay */
  background:
    linear-gradient(
      135deg,
      rgba(43, 124, 175, 0.2) 0%,   /* #2B7CAF @ 20% */
      rgba(255, 197, 66, 0.2) 100%  /* #FFC542 @ 20% */
    ),
    #eaf3ff;                         /* light base like your frame */
  
    box-shadow: 0 18px 40px rgba(15, 33, 70, 0.26);
  overflow: hidden;
}


/* Right side: blue car area */
.carHero {
  flex: 1;
  display: flex;
  justify-content: flex-end;
  align-items: flex-end;
  margin-left: 16px;
  /* no background here – card background shows through */
  background: transparent;
}

/* Car image */
.carImage {
  display: block;
  max-width: 400%;
  height: 400%;
  /* Optional: nudge it a bit like in Figma */
  transform: translateY(6px);
}


/* Left side text */
.examText {
  flex: 1.1;
  display: flex;
  flex-direction: column;
}

.examLabel {
  margin: 0;
  font-size: 34px;
  font-weight: 600;
  color: #222435;
}

.examTitle {
  margin: 0;
  font-size: 34px;
  font-weight: 700;
  color: #222435;
}

/* "My Test Day" link-style button */
.myTestDayButton {
  align-self: flex-start;
  padding: 0;
  margin: 0;
  border: none;
  background: none;
  font-size: 23px;
  font-weight: 600;
  color: #222435;
}

/* Date input */
.dateInput {
  position: absolute;
  opacity: 0;
  pointer-events: none;
  width: 0;
  height: 0;
  border: 0;
}


/* Date + days row */
.dateRow {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  position: relative; /* so the hidden input can sit here */
}


.timeBlock {
  display: flex;
  flex-direction: column;
}

.bigDate {
  font-size: 34px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #222435;
}

/* test time text */
.timeText {
  font-size: 16px;
  font-weight: 500;
  margin-top: 0.2rem;
  color: #555b70;

  /* make it look like plain text but clickable */
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
}

.timeInput {
  position: absolute;
  opacity: 0;
  pointer-events: none;
  width: 0;
  height: 0;
  border: 0;
}


/* days left text */
.caption {
  font-size: 9px; 
  color: #8a92aa;
}

.daysLeftContainer {
  margin-top: 10px;
}

.daysLeftNumber {
  font-size: 34px;
  font-weight: 700;
  margin-bottom: 0px;
  color: #222435;
}

.sections {
  margin-top: 32px;          /* space under Exam card */
  display: flex;
  flex-direction: column;
  row-gap: 32px;             /* gap between Test Mode / Overall / My */
  padding-bottom: 80px;      /* some breathing room at bottom */
}

/* Whole group: title + card row */
.sectionGroup {
  width: 100%;
}

/* "Test Mode", "Overall", "My" */
.sectionTitle {
  margin: 0 0 12px;
  font-size: 23px;
  font-weight: 700;
  color: #222435;
}

/* HORIZONTAL scroll row of cards */
.cardRow {
  display: flex;
  flex-wrap: nowrap;            /* stay on one line */
  gap: 16px;
  overflow-x: auto;             /* 🔹 horizontal scroll */
  padding: 4px 0 12px;
  margin: 0 -16px;              /* let cards touch screen edges a bit */
  padding-inline: 16px;         /* match page side padding */

  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch; /* smooth scroll on iOS */
}

/* hide scrollbar in WebKit (Chrome/Safari) – cosmetic only */
.cardRow::-webkit-scrollbar {
  display: none;
}

/* Individual card – same shape as Figma 211 x 260 */
.featureCard {
  position: relative;
  flex: 0 0 70%;               /* 0 0 70%takes ~70% of width on phone */
  max-width: 260px;
  min-width: 211px;
  flex-shrink: 0;
  aspect-ratio: 211 / 260;

  border-radius: 44px;
  overflow: hidden;

  display: flex;
  align-items: flex-end;       /* put text near the bottom */
  padding: 12px 10px;

  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  box-shadow: 0px 6px 8px 0px #848487;

  scroll-snap-align: start;    /* 🔹 snaps card nicely to left edge */
}

/* Card background image */
.cardBgImage {
  object-fit: cover;
  z-index: 0;
}

/* === TOP ROW (icon + small text) === */
.cardTopRow {
  position: absolute;
  top: 40px;        /* distance from top of card (match Figma) */
  left: 22px;       /* 22px from left, as measured in Figma */
  display: flex;
  align-items: center;
  gap: 8px;         /* space between icon and text */
  z-index: 1;
}

/* Icon box */
.cardIcon {
  position: relative;
  width: 54px;      /* your exported icon size */
  height: 54px;
  border-radius: 12px;
  overflow: hidden;
  pointer-events: none;  /* let drag-scroll work over icon */
}

.cardIcon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* Text next to the icon */
.cardTopText {
  margin: 0;
  font-size: 12px;      /* bump to 13–14 if you want */
  font-weight: 600;
  line-height: 1.3;
  color: #0f172a;
  max-width: 150px;
}

/* === BOTTOM TITLE === */
.cardContent {
  position: absolute;
  left: 22px;      /* same left padding as top row */
  top: 110px;    /* distance from bottom of card – tweak to match Figma */
  z-index: 1;
}


.cardTitle {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  color: #111827;
}





/* Mobile tweaks (small screens) */
@media (max-width: 400px) {
  .examCard {
    padding: 16px 14px 18px;
  }

  .examTitle {
    font-size: 1.6rem;
  }

  .bigDate {
    font-size: 1.7rem;
  }
}

.bigDateButton {
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  cursor: pointer;
}


.dragRow {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  padding: 8px 0 24px;
  scrollbar-width: none;          /* Firefox */
}

.dragRow::-webkit-scrollbar {
  display: none;                  /* Chrome / Safari */
}

/* Optional cursor styling */
.dragRow {
  cursor: grab;
}

.dragRow:active {
  cursor: grabbing;
}

/* === Bottom Nav Bar === */

.bottomNavWrapper {
  position: fixed;          /* float on top of content */
  left: 50%;
  bottom: 24px;             /* distance from bottom of screen */
  width: 100%;
  max-width: 560px;         /* same as .content max-width */
  display: flex;
  justify-content: center;
  pointer-events: none;     /* only nav itself should catch clicks */
  z-index: 50;
}


.bottomNav {
  width: 390px;             /* Figma: 352 x 66 */
  height: 66px;
  padding: 9px;             /* Figma padding */
  border-radius: 25px;      /* Figma corner radius */
  background: rgba(30, 30, 31, 0.85); /* #1E1E1F at 85% */
  border: 1px solid rgba(0, 0, 0, 0.9);
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.55);

  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;

  pointer-events: auto;     /* re-enable clicks here */
}

/* Each nav item (icon + optional text) */
.navItem {
  position: relative;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: row;
  gap: 28px;
  padding: 8px 14px;
  border-radius: 999px;
  border: none;
  background: transparent;
  color: #9ca3af;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

/* Active item gets the blue pill background */


/* Icon size (for now we use emoji; later swap for <Image>) */
.navIcon {
  font-size: 20px;
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* Label text */
.navLabel {
  white-space: nowrap;
  /* (optional) default color for inactive items */
  color: #9ca3af;
}

/* Make text & icon blue when active */
.navItemActive .navLabel {
  color: #37B2FF;
}

/* Active pill background behind Home icon + text */
.navPill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 28px;              /* 28px gap between icon and text */
  width: 130px;
  height: 48px;
  border-radius: 25px;    /* Figma corner radius */

  /* Figma: Linear 37B2FF → transparent */
  background: linear-gradient(
    90deg,
    #37B2FF 0%,
    rgba(55, 178, 255, 0) 100%
  );
}

/* ========================= */
/* DARK MODE OVERRIDES ONLY  */
/* ========================= */

:root[data-theme='dark'] .page {
  background:
    radial-gradient(circle at top, rgba(15, 23, 42, 0.7), transparent 55%),
    #050816;
  color: #f9fafb;
}

/* Exam card container */
:root[data-theme='dark'] .examCard {
  background:
    linear-gradient(
      135deg,
      rgba(43, 124, 175, 0.35) 0%,
      rgba(255, 197, 66, 0.35) 100%
    ),
    #111827;
  color: #f9fafb;
}

/* Main text elements */
:root[data-theme='dark'] .examLabel,
:root[data-theme='dark'] .examTitle,
:root[data-theme='dark'] .myTestDayButton,
:root[data-theme='dark'] .bigDate,
:root[data-theme='dark'] .daysLeftNumber,
:root[data-theme='dark'] .sectionTitle,
:root[data-theme='dark'] .cardTitle {
  color: #f9fafb;
}

/* Secondary/muted text */
:root[data-theme='dark'] .timeText,
:root[data-theme='dark'] .caption{
  color: #9ca3af;
}

:root[data-theme='dark'] .cardTopText {
  color: #222435;
}
/* Optional: make feature cards feel darker */
:root[data-theme='dark'] .featureCard {
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.75);
}

```

### app/page.tsx
```tsx
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
  const timeInputRef = useRef<HTMLInputElement | null>(null);

  const displayTime = formatTimeLabel(testTime);

const dateInputRef = useRef<HTMLInputElement | null>(null);

const openDatePicker = () => {
  const input = dateInputRef.current;
  if (!input) return;
  // @ts-ignore
  if (input.showPicker) {
    // @ts-ignore
    input.showPicker();
  } else {
    input.click();
  }
};


  const openTimePicker = () => {
    const input = timeInputRef.current;
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

            <p className={styles.myTestDayButton}>My Test Day:</p>


            {/* Date + time */}
             <div className={styles.dateRow}>
  {/* Clickable date label */}
  <button
    type="button"
    className={styles.bigDateButton}
    onClick={openDatePicker}
  >
    <span className={styles.bigDate}>{formattedDate}</span>
  </button>

  {/* Hidden native date input */}
  <input
    ref={dateInputRef}
    type="date"
    className={styles.dateInput}
    value={testDate}
    onChange={(e) => setTestDate(e.target.value)}
  />

  <div className={styles.timeBlock}>
    <button
      type="button"
      className={styles.timeText}
      onClick={openTimePicker}
    >
      {displayTime}
    </button>
    <input
      ref={timeInputRef}
      type="time"
      className={styles.timeInput}
      value={testTime}
      onChange={(e) => setTestTime(e.target.value)}
    />
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
    </main>
  );
}

```

### app/profile/page.tsx
```tsx
'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './profile.module.css';
import BottomNav from '../../components/BottomNav';
import { useTheme } from '../../components/ThemeProvider';

export default function ProfilePage() {
    // ---- avatar upload state + handlers ----
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { theme, toggleTheme } = useTheme();

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);

    setAvatarPreview((prev) => {
      // clean up previous blob url if there was one
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  };

  return (
    <main className={styles.page}>
      <div className={styles.content}>
        {/* Top "Back" row */}
        <header className={styles.headerRow}>
          <Link href="/" className={styles.backButton}>
            <span className={styles.backIcon}>‹</span>
            <span className={styles.backText}></span>
          </Link>
        </header>

        {/* Main profile card */}
       <section className={styles.profileCard}>
  <div className={styles.avatarBlock}>
    {/* Clickable avatar */}
    <div className={styles.avatarCircle} onClick={handleAvatarClick}>
      {avatarPreview ? (
        <img
          src={avatarPreview}
          alt="User avatar"
          className={styles.avatarImage}
        />
      ) : (
        <Image
          src="/images/profile/imageupload-icon.png"
          alt="image upload icon"
          fill
          className={styles.avatarPlaceholder}
          sizes="120px"
        />
      )}
    </div>

    {/* Hidden file input */}
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      className={styles.avatarInput}
      onChange={handleAvatarChange}
    />

    <div className={styles.nameRow}>
      <span className={styles.username}>@Expatise</span>
        <Image 
          src="/images/profile/yellowcrown-icon.png"
          alt="Crown Icon"
          width={23}
          height={23}
          className={styles.crownIcon}
        />
      
    </div>
    <p className={styles.email}>user@expatise.com</p>
  </div>

  {/* Premium plan bar */}
  <div className={styles.premiumCard}>
    <span className={styles.premiumIcon}>
      <Image 
        src="/images/profile/crown-icon.png"
        alt="Premium Icon"
        width={35}
        height={35}
      />
    </span>
    <span className={styles.premiumText}>Premium Plan</span>
  </div>
        {/* Settings list */}
      <div className={styles.settingsList}>
                    {/* Light / Dark Mode */}
            <button
              type="button"
              className={styles.settingsRow}
              onClick={toggleTheme}
            >
              <div className={styles.settingsLeft}>
                <span className={styles.settingsIcon}>
                  <Image
                    src="/images/profile/lightdarkmode-icon.png"
                    alt="Light / Dark Mode Icon"
                    width={24}
                    height={24}
                  />
                </span>
                <span className={styles.settingsLabel}>
                  Light / Dark Mode
                </span>
              </div>
              <div
                className={`${styles.toggle} ${
                  theme === 'dark' ? styles.toggleOn : ''
                }`}
              >
                <div
                  className={`${styles.toggleKnob} ${
                    theme === 'dark' ? styles.toggleKnobOn : ''
                  }`}
                />
              </div>
            </button>


        <button className={styles.settingsRow}>
          <div className={styles.settingsLeft}>
            <span className={styles.settingsIcon}>
              <Image 
                src="/images/profile/privacypolicy-icon.png"
                alt="Privacy Policy Icon"
                width={24}
                height={24}
              />
            </span>
            <span className={styles.settingsLabel}>Privacy Policy</span>
          </div>
          <span className={styles.chevron}>›</span>
        </button>

        <button className={styles.settingsRow}>
          <div className={styles.settingsLeft}>
            <span className={styles.settingsIcon}>
              <Image 
                src="/images/profile/aboutus-icon.png"
                alt="About Us Icon"
                width={24}
                height={24}
              />
            </span>
            <span className={styles.settingsLabel}>About us</span>
          </div>
          <span className={styles.chevron}>›</span>
        </button>

        <button className={styles.settingsRow}>
          <div className={styles.settingsLeft}>
            <span className={styles.settingsIcon}>
              <Image 
                src="/images/profile/bell-icon.png"
                alt="Exam Registration Icon"
                width={24}
                height={24}
              />
            </span>
            <span className={styles.settingsLabel}>Exam Registration</span>
          </div>
          <span className={styles.chevron}>›</span>
        </button>
      </div>

</section>

        {/* Log out button */}
        <div className={styles.logoutWrapper}>
          <button className={styles.logoutButton}>Log Out</button>
        </div>
      </div>

      {/* Re-use the existing bottom navigation */}
      <BottomNav />
    </main>
  );
}

```

### app/profile/profile.module.css
```css
.page {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  background: linear-gradient(180deg, #e6f3ff, #f4f7ff);
  padding: 24px 16px 40px;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text',
    'Segoe UI', sans-serif;
}

.content {
  width: 100%;
  max-width: 560px;
  margin: 24px auto 96px; /* extra bottom room for nav bar */
}

/* ===== Header ===== */

.headerRow {
  margin-bottom: 16px;
}

.backButton {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  text-decoration: none;
  color: #111827;
}

.backIcon {
  font-size: 24px;
  line-height: 1;
}

.backText {
  font-size: 20px;
  font-weight: 600;
}

/* ===== Profile card ===== */

.profileCard {
  background: linear-gradient(135deg, #f5fbff, #eef2ff);
  border-radius: 32px;
  padding: 24px 20px 28px;
  box-shadow: 0 20px 50px rgba(15, 33, 70, 0.16);
}

/* Avatar + name block */

.avatarBlock {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 16px;
}

.avatarCircle {
  position: relative;
  width: 112px;
  height: 112px;
  border-radius: 999px;
  overflow: hidden;
  margin-bottom: 12px;
  cursor: pointer;
}

.avatarInput {
  display: none;
}


.avatarImage {
  object-fit: cover;
}

.avatarPlaceholder {
  object-fit: contain;   /* show whole icon */
  transform: scale(0.3); /* 0.6 = 60% of the circle size; tweak as you like */
  background: transparent;
}


.nameRow {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.username {
  font-size: 20px;
  font-weight: 700;
  color: #2B7CAF;
}

.crown {
  font-size: 18px;
}

.crownIcon {
  display: inline-block;
}

.email {
  margin: 0;
  font-size: 14px;
  color: #6b7280;
}

/* Premium bar */

.premiumCard {
  margin-top: 16px;
  margin-bottom: 16px;
  border-radius: 24px;
  padding: 14px 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
    background: linear-gradient(
    90deg,
    rgba(43, 124, 175, 0.4) 0%,
    rgba(255, 197, 66, 0.4) 100%
  );

}

.premiumIcon {
  font-size: 20px;
}

.premiumText {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}

/* Settings list */

.settingsList {
  background: #F1F5F8;
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 16px 40px rgba(15, 33, 70, 0.12);
}

.settingsRow {
  width: 100%;
  padding: 14px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: transparent;
  border: none;
  outline: none;
  cursor: pointer;
}

.settingsRow + .settingsRow {
  border-top: 1px solid rgba(148, 163, 184, 0.25);
}

.settingsLeft {
  display: flex;
  align-items: center;
  gap: 12px;
}

.settingsIcon {
  font-size: 20px;
}

.settingsIcon img {
  width: 24px;
  height: 24px;
}

.settingsLabel {
  font-size: 16px;
  font-weight: 500;
  color: #41414D;
}

.chevron {
  font-size: 20px;
  color: #9ca3af;
}

/* Toggle (static ON state for now) */

/* Light / Dark toggle */

.toggle {
  width: 44px;
  height: 24px;
  border-radius: 999px;
  padding: 3px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  background: rgba(148, 163, 184, 0.4);
  transition: background 0.2s ease;
}

.toggleOn {
  background: var(--accent, #6366f1);
}

.toggleKnob {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: #ffffff;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.6);
  transform: translateX(0);
  transition: transform 0.2s ease;
}

.toggleKnobOn {
  transform: translateX(20px);
}

/* ===== Logout button ===== */

.logoutWrapper {
  margin-top: 32px;
  display: flex;
  justify-content: center;
}

.logoutButton {
  min-width: 220px;
  padding: 14px 24px;
  border-radius: 20px;
  border: 1px solid #d2c79a;
    background: linear-gradient(
    90deg,
    rgba(43, 124, 175, 0.4) 0%,
    rgba(255, 197, 66, 0.4) 100%
  );
  box-shadow: 0 18px 40px rgba(15, 33, 70, 0.26);
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  cursor: pointer;
}

/* ========================= */
/* DARK MODE OVERRIDES ONLY  */
/* ========================= */

:root[data-theme='dark'] .page {
  background:
    radial-gradient(circle at top, rgba(15, 23, 42, 0.7), transparent 55%),
    #050816;
  color: #f9fafb;
}

/* Main profile card */
:root[data-theme='dark'] .profileCard {
  background:
    linear-gradient(
      135deg,
      rgba(43, 124, 175, 0.35) 0%,
      rgba(255, 197, 66, 0.35) 100%
    ),
    #111827;
  color: #f9fafb;
}

/* Settings list background */
:root[data-theme='dark'] .settingsList {
  background: #020617;
}

/* Text colors */
:root[data-theme='dark'] .backButton,
:root[data-theme='dark'] .settingsLabel,
:root[data-theme='dark'] .logoutButton,
:root[data-theme='dark'] .premiumText,
:root[data-theme='dark'] .crown {
  color: #f9fafb;
}

:root[data-theme='dark'] .email {
  color: #9ca3af;
}

/* Crown/premium text can stay bright */
:root[data-theme='dark'] .username {
  color: #38bdf8; /* nice highlight in dark mode */
}

```

### app/stats/page.tsx
```tsx
'use client';

import BottomNav from '../../components/BottomNav';
import styles from '../page.module.css'; // re-use your existing layout styles
// import Image etc. if you need them

export default function StatsPage() {
  return (
    <main className={styles.page}>
      <div className={styles.content}>
        {/* Your stats content here */}
        <h1>Stats</h1>
        <p>Stats screen coming soon…</p>

        {/* Bottom navigation */}
        <BottomNav />
      </div>
    </main>
  );
}

```

### components/BottomNav.tsx
```tsx
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

```

### components/DragScrollRow.tsx
```tsx
// components/DragScrollRow.tsx
import React, { useRef } from 'react';

type DragScrollRowProps = {
  children: React.ReactNode;
  className?: string;
};

export default function DragScrollRow({
  children,
  className,
}: DragScrollRowProps) {
  const rowRef = useRef<HTMLDivElement | null>(null);

  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  // for momentum
  const lastXRef = useRef(0);
  const velocityRef = useRef(0);
  const frameIdRef = useRef<number | null>(null);

  const stopAnimation = () => {
    if (frameIdRef.current !== null) {
      cancelAnimationFrame(frameIdRef.current);
      frameIdRef.current = null;
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!rowRef.current) return;

    isDraggingRef.current = true;
    startXRef.current = e.pageX - rowRef.current.offsetLeft;
    scrollLeftRef.current = rowRef.current.scrollLeft;

    // reset momentum info
    lastXRef.current = e.pageX;
    velocityRef.current = 0;
    stopAnimation();
  };

  const startMomentum = () => {
  const el = rowRef.current;
  if (!el) return;

  const friction = 0.985;    // glides a bit longer
  const minVelocity = 0.05;  // when to stop throwing
  const overshoot = 160;     // ⬅ big overshoot distance in px

  const step = (time?: number) => {
    const node = rowRef.current;
    if (!node) return;

    // apply velocity (the usual momentum)
    node.scrollLeft -= velocityRef.current;

    const maxScroll = node.scrollWidth - node.clientWidth;

    // --- rubber-band damping when outside [0, maxScroll] ---
    if (node.scrollLeft < 0) {
      const past = -node.scrollLeft;                    // how far past left edge
      const ratio = Math.min(1, past / overshoot);      // 0 → 1
      const edgeFriction = 1 - 0.7 * ratio;             // 1 → 0.3
      velocityRef.current *= edgeFriction;              // slows more as you stretch
    } else if (node.scrollLeft > maxScroll) {
      const past = node.scrollLeft - maxScroll;         // how far past right edge
      const ratio = Math.min(1, past / overshoot);
      const edgeFriction = 1 - 0.7 * ratio;
      velocityRef.current *= edgeFriction;
    }

    // global friction
    velocityRef.current *= friction;

    if (Math.abs(velocityRef.current) > minVelocity) {
      frameIdRef.current = requestAnimationFrame(step);
    } else {
      // stop throwing and do a smooth snap-back if we're overshooting
      const outOfBounds =
        node.scrollLeft < 0 || node.scrollLeft > maxScroll;

      if (!outOfBounds) {
        velocityRef.current = 0;
        stopAnimation();
        return;
      }

      const start = node.scrollLeft;
      const end = Math.min(maxScroll, Math.max(0, start)); // clamp to [0, maxScroll]
      const duration = 400; // ms

      const startTime = performance.now();

      const animateBack = (t: number) => {
        const node2 = rowRef.current;
        if (!node2) return;

        const elapsed = t - startTime;
        const progress = Math.min(1, elapsed / duration);

        // easeOutCubic for smooth snap
        const eased = 1 - Math.pow(1 - progress, 3);

        node2.scrollLeft = start + (end - start) * eased;

        if (progress < 1) {
          frameIdRef.current = requestAnimationFrame(animateBack);
        } else {
          velocityRef.current = 0;
          stopAnimation();
        }
      };

      frameIdRef.current = requestAnimationFrame(animateBack);
    }
  };

  frameIdRef.current = requestAnimationFrame(step);
};


  const handleMouseUpOrLeave = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    // only start momentum if user actually flung the mouse
    if (Math.abs(velocityRef.current) > 0.5) {
      startMomentum();
    } else {
      velocityRef.current = 0;
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const node = rowRef.current;
    if (!isDraggingRef.current || !node) return;

    e.preventDefault();

    const x = e.pageX - node.offsetLeft;
    const walk = x - startXRef.current;

    node.scrollLeft = scrollLeftRef.current - walk;

    // measure velocity based on mouse movement
    const dx = e.pageX - lastXRef.current;
    lastXRef.current = e.pageX;

    // tweak factor: bigger = stronger throw
    velocityRef.current = dx * 0.9;
  };

  return (
    <div
      ref={rowRef}
      className={className}
      onMouseDown={handleMouseDown}
      onMouseLeave={handleMouseUpOrLeave}
      onMouseUp={handleMouseUpOrLeave}
      onMouseMove={handleMouseMove}
      style={{
        overflowX: 'auto',
        cursor: isDraggingRef.current ? 'grabbing' : 'grab',
      }}
    >
      {children}
    </div>
  );
}

```

### components/ThemeProvider.tsx
```tsx
'use client';

import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
}

interface ThemeProviderProps {
    children: ReactNode;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(
    undefined
);

const THEME_STORAGE_KEY = 'THEME_STORAGE_KEY';

export function ThemeProvider ({ children }: ThemeProviderProps) {
    const [theme, setThemeState] = useState<Theme>('dark');

    //Hydrate theme from localStorage / system preference
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const saved = window.localStorage.getItem('THEME_STORAGE_KEY') as Theme | null;
        const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;

        const initial: Theme = saved || (prefersDark ? 'dark' : 'light');
        
        setThemeState(initial);
        document.documentElement.dataset.theme = initial;
    }, []);

    const applyTheme = (next: Theme) => {
        setThemeState(next);
        if (typeof window !== 'undefined') {
            window.localStorage.setItem('THEME_STORAGE_KEY', next);
        }
        if (typeof document !== 'undefined') {
            document.documentElement.dataset.theme = next;
        }
    };

    const setTheme = (next: Theme) => {
        applyTheme(next);
    };

    const toggleTheme = () => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
    };

    const value: ThemeContextValue = {
        theme,
        toggleTheme,
        setTheme,
    };

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return ctx;
}

```

