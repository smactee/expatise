'use client';

import React, { useRef, useState, useEffect, type ChangeEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './profile.module.css';
import BottomNav from '../../components/BottomNav';
import { useTheme } from '../../components/ThemeProvider';
import { useUserProfile } from '../../components/UserProfile';
import { UserProfileProvider } from '../../components/UserProfile';

export default function ProfilePage() {
  const { avatarUrl, setAvatarUrl, name, setName, email, setEmail } = useUserProfile(); // from context

  // ---- avatar upload state + handlers ----
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { theme, toggleTheme } = useTheme();

  // when the context avatar changes (e.g. after reload), update preview
  useEffect(() => {
    setAvatarPreview(avatarUrl || null);
  }, [avatarUrl]);

  const nameSpanRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
  if (!nameSpanRef.current) return;

  // Only update DOM text if it doesn't already match state
  if (nameSpanRef.current.innerText !== name) {
    nameSpanRef.current.innerText = name;
  }
}, [name]);


  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onloadend = () => {
      const base64 = reader.result as string; // "data:image/jpeg;base64,..."

      // 1) update local preview for this page
      setAvatarPreview(base64);

      // 2) update global profile (context + localStorage)
      setAvatarUrl(base64);
    };

    reader.readAsDataURL(file);
  };

  // add these handlers just under your avatar handlers:
const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  setName(e.target.value);
};

const handleNameInput = (e: React.FormEvent<HTMLSpanElement>) => {
  const text = (e.currentTarget as HTMLSpanElement).innerText;
  setName(text);
};

const handleNameBlur = (e: React.FocusEvent<HTMLSpanElement>) => {
  const trimmed = e.currentTarget.innerText.trim();
  if (!trimmed) {
    setName('@Expatise');
    e.currentTarget.innerText = '@Expatise';
  } else {
    setName(trimmed);
  }
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
        <Image
          src={avatarPreview}
          alt="User avatar"
          width={120}
          height={120}
          className={styles.avatarImage}
        />
      ) : (
   // default before user uploads anything
        <Image
  src="/images/profile/imageupload-icon.png"
  alt="image upload icon"
  fill
  className={styles.avatarPlaceholder}
  onClick={handleAvatarClick}
/>
      )}
    </div>

    {/* Hidden file input */}
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      style={{ display: 'none' }}
      onChange={handleAvatarChange}
    />

<div className={styles.nameRow}>
  <span
    ref={nameSpanRef }
    className={styles.usernameEditable}
    contentEditable
    suppressContentEditableWarning
    onInput={handleNameInput}
    onBlur={handleNameBlur}
  >
  </span>

  <Image
    src="/images/profile/yellowcrown-icon.png"
    alt="Crown Icon"
    width={23}
    height={23}
    className={styles.crownIcon}
  />
</div>


   <input
  type="email"
  className={styles.email}
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  onBlur={(e) => {
    const trimmed = e.target.value.trim();
    // fallback to default if empty
    setEmail(trimmed || 'user@expatise.com');
  }}
  placeholder="user@expatise.com"
/>
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
