'use client';

import Image from 'next/image';
import Link from 'next/link';
import styles from './profile.module.css';
import BottomNav from '../../components/BottomNav';

export default function ProfilePage() {
  return (
    <main className={styles.page}>
      <div className={styles.content}>
        {/* Top "Back" row */}
        <header className={styles.headerRow}>
          <Link href="/" className={styles.backButton}>
            <span className={styles.backIcon}>‹</span>
            <span className={styles.backText}>Back</span>
          </Link>
        </header>

        {/* Main profile card */}
        <section className={styles.profileCard}>
          <div className={styles.avatarBlock}>
            <div className={styles.avatarCircle}>
              <Image
                src="/images/profile/avatar.png" // <- change path to your image
                alt="User avatar"
                fill
                className={styles.avatarImage}
                sizes="120px"
              />
            </div>
            <div className={styles.nameRow}>
              <span className={styles.username}>@Kang</span>
              <span className={styles.crown}>👑</span>
            </div>
            <p className={styles.email}>user@email.com</p>
          </div>

          {/* Premium plan bar */}
          <div className={styles.premiumCard}>
            <span className={styles.premiumIcon}>👑</span>
            <span className={styles.premiumText}>Premium Plan</span>
          </div>

          {/* Settings list */}
          <div className={styles.settingsList}>
            <button className={styles.settingsRow}>
              <div className={styles.settingsLeft}>
                <span className={styles.settingsIcon}>🌞</span>
                <span className={styles.settingsLabel}>Light / Dark Mode</span>
              </div>
              <div className={styles.toggle}>
                <div className={styles.toggleKnob} />
              </div>
            </button>

            <button className={styles.settingsRow}>
              <div className={styles.settingsLeft}>
                <span className={styles.settingsIcon}>🛡️</span>
                <span className={styles.settingsLabel}>Privacy Policy</span>
              </div>
              <span className={styles.chevron}>›</span>
            </button>

            <button className={styles.settingsRow}>
              <div className={styles.settingsLeft}>
                <span className={styles.settingsIcon}>❓</span>
                <span className={styles.settingsLabel}>About us</span>
              </div>
              <span className={styles.chevron}>›</span>
            </button>

            <button className={styles.settingsRow}>
              <div className={styles.settingsLeft}>
                <span className={styles.settingsIcon}>🔔</span>
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
