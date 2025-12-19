'use client';

import React, { useRef, useState, useEffect, type ChangeEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './profile.module.css';
import BottomNav from '../../components/BottomNav';
import { useTheme } from '../../components/ThemeProvider';
import { useUserProfile } from '../../components/UserProfile';
import { UserProfileProvider } from '../../components/UserProfile';
import { useRouter } from 'next/navigation';
import { useAuthStatus } from '../../components/useAuthStatus';
import { isValidEmail } from '../../lib/auth';

export default function ProfilePage() {
  const { avatarUrl, setAvatarUrl, name, setName, email, setEmail, saveProfile, clearProfile } = useUserProfile(); // from context

  // ---- avatar upload state + handlers ----
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { theme, toggleTheme } = useTheme();

  const { authed, method, email: sessionEmail, provider, loading } = useAuthStatus();
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

const signInDisplay = (() => {
  // 1) guest
  if (!authed) {
    return { label: "Signed in as guest.", iconSrc: null as string | null };
  }

  // 2) email/password local account
  if (method === "email") {
    return { label: sessionEmail ?? "Email sign-in", iconSrc: null };
  }

  // 3) social providers
  if (provider === "google") {
    return { label: "Google sign-in", iconSrc: "/images/profile/google-icon.png" };
  }
  if (provider === "apple") {
    return { label: "Apple ID", iconSrc: "/images/profile/apple-icon.png" };
  }
  if (provider === "wechat") {
    return { label: "WeChat", iconSrc: "/images/profile/wechat-icon.png" };
  }

  // fallback (still show method, not email)
  return { label: "Social sign-in", iconSrc: null };
})();



function requireLogin(e?: React.SyntheticEvent) {
  if (authed) return true;
  e?.preventDefault();
  e?.stopPropagation();
  setShowGuestModal(true);   // ✅ this matches your modal renderer
  return false;
}

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

// ---- email state + handlers ----


// true when there's something in the field, no error, and it passes regex


const router = useRouter();
const [loggingOut, setLoggingOut] = useState(false);

const handleLogout = async () => {
  if (loggingOut) return;
  setLoggingOut(true);
  try {
    await fetch("/api/logout", { method: "POST", credentials: "include" });

    // Clear local profile store (dev-only)
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("expatise-user-profile");
    }

    // Reset the UI state
    setAvatarUrl(null);
    setName("@Expatise");
    setEmail("user@expatise.com");

    router.replace("/login");
  } finally {
    setLoggingOut(false);
  }
};

const handleSave = async (e: React.SyntheticEvent) => {
   if (!authed) {
    requireLogin(e);
    return;
  }
  setSaving(true);
  try {
    saveProfile();
    setSaveMsg("Saved!");
    setTimeout(() => setSaveMsg(null), 450);
  } finally {
    setSaving(false);
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
    <div 
    className={styles.avatarCircle} 
    onClick={(e) => {
    if (!requireLogin(e)) return;
    handleAvatarClick();
  }}>
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
  width={56}
  height={56}  
  className={styles.avatarPlaceholder}
/>
      )}
    </div>
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
    className={`${styles.usernameEditable} ${!authed ? styles.lockedClickable : ""}`}
    contentEditable={authed}
    suppressContentEditableWarning
    onMouseDown={(e) => { if (!authed) requireLogin(e); }}
    onFocus={(e) => {if (!authed) (e.currentTarget as HTMLElement).blur(); }}
    onInput={(e) => { if (!authed) return; handleNameInput(e); }}
    onBlur={(e) => { if (!authed) return; handleNameBlur(e); }}
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



<div
  className={`${styles.emailWrapper} ${!authed ? styles.lockedClickable : ""}`}
  role="button"
  tabIndex={0}
  onMouseDown={(e) => {
    if (!authed) requireLogin(e);
  }}
  onKeyDown={(e) => {
    if (!authed && (e.key === "Enter" || e.key === " ")) requireLogin(e as any);
  }}
>
  <div className={styles.emailInputRow}>
    {signInDisplay.iconSrc ? (
  <Image
    src={signInDisplay.iconSrc}
    alt=""
    width={18}
    height={18}
  />
) : null}

<span className={styles.emailDisplayText}>{signInDisplay.label}</span>

  </div>
</div>




  {/* Premium plan bar */}
<button
  type="button"
  className={styles.premiumCard}
  onClick={(e) => {
  if (!requireLogin(e)) return;
  }}
>
    <span className={styles.premiumIcon}>
      <Image 
        src="/images/profile/crown-icon.png"
        alt="Premium Icon"
        width={35}
        height={35}
      />
    </span>
    <span className={styles.premiumText}>Premium Plan</span>
</button>
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

{/* Save & Log out button */}
<div className={styles.actionRow}>
 <button
  className={styles.saveButton}
  onClick={handleSave}
>
  {saving ? "Saving..." : "Save"}
</button>


  {authed ? (
    <button
      className={styles.logoutButton}
      onClick={handleLogout}
      disabled={loggingOut}
    >
      {loggingOut ? "Logging Out..." : "Log Out"}
    </button>
  ) : (
    <Link className={styles.loginButton} href="/login?next=/profile">
      Log in
    </Link>
  )}
</div>

{saveMsg ? (
  <div className={styles.toastOverlay} aria-live="polite">
    <div className={styles.toastCard}>
      <Image
        src="/images/profile/greencheck-icon.png"
        alt="Checkmark Icon"
        width={16}
        height={16}
        className={styles.toastIcon}
        priority
      />
      <span className={styles.toastText}>{saveMsg}</span>
      </div>
  </div>
) : null}

{showGuestModal ? (
  <div className={styles.guestOverlay} onClick={() => setShowGuestModal(false)}>
    <div className={styles.guestModal} onClick={(e) => e.stopPropagation()}>
      <div className={styles.guestTitle}>Log in to save your changes.</div>
      <div className={styles.guestText}>
        Some features may be disabled. You can continue as a guest, but changes won’t be saved.
      </div>
      <div className={styles.guestButtons}>
        <Link className={styles.guestPrimary} href="/login?next=/profile">
          Log in
        </Link>
        <button
          className={styles.guestSecondary}
          onClick={() => setShowGuestModal(false)}
        >
          Continue as guest
        </button>
      </div>
    </div>
  </div>
) : null}

      </div>

      {/* Re-use the existing bottom navigation */}
      <BottomNav />
    </main>
  );
}

