//  app/profile/page.tsx

'use client';

import React, { useId, useRef, useState, useEffect, type ChangeEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './profile.module.css';
import BottomNav from '@/components/BottomNav';
import { useTheme } from '@/components/ThemeProvider';
import { useUserProfile } from '@/components/UserProfile';
import { useRouter, usePathname, useSearchParams  } from 'next/navigation';
import { useAuthStatus } from '@/components/useAuthStatus';
import BackButton from '@/components/BackButton';
import CSRBoundary from '@/components/CSRBoundary';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGoogle, faApple, faWeixin} from '@fortawesome/free-brands-svg-icons';
import { faEnvelope } from '@fortawesome/free-solid-svg-icons';
import LogoutButton from '@/components/LogoutButton.client';
import PremiumFeatureModal from '@/components/PremiumFeatureModal';
import { Capacitor } from "@capacitor/core";
import { Purchases } from "@revenuecat/purchases-capacitor";
import { ensureRevenueCat } from "@/lib/billing/revenuecat";
import { useEntitlements } from "@/components/EntitlementsProvider.client";
import type { EntitlementSource } from "@/lib/entitlements/types";
import type { Locale } from '@/messages';
import { useT } from '@/lib/i18n/useT';
import { LANGUAGE_OPTIONS, getCurrentLanguageOption, isEnabledLanguageOption } from '@/lib/i18n/languageOptions';
import { getTranslatedOnlyLocaleNotice, loadProductionTranslationCounts } from '@/lib/qbank/localeSupport';



function Inner() {
  const { avatarUrl, setAvatarUrl, name, setName, email, setEmail, saveProfile, clearProfile } = useUserProfile(); // from context
  const { locale, setLocale, t } = useT();

  // ---- avatar upload state + handlers ----
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { theme, toggleTheme } = useTheme();

  const { authed, method, loading: authLoading, refresh, email: sessionEmail, provider } = useAuthStatus();
  const authEmail = sessionEmail ?? email ?? null;
  const showProviderEmail = authed && method !== "email" && !!authEmail; 
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [translationCounts, setTranslationCounts] = useState<Record<string, number>>({});
  const languageMenuRef = useRef<HTMLDivElement | null>(null);
  const languageMenuId = useId();

  const canManageCredentials = authed && (method === "email");
  const RC_ENTITLEMENT_ID = process.env.NEXT_PUBLIC_REVENUECAT_ENTITLEMENT_ID ?? "Premium";
  const currentLanguage = getCurrentLanguageOption(locale);

  useEffect(() => {
    let alive = true;

    loadProductionTranslationCounts().then((counts) => {
      if (alive) setTranslationCounts(counts);
    });

    return () => {
      alive = false;
    };
  }, []);


const signInDisplay = (() => {
  // 1) guest
  if (!authed) {
    return { label: t('profile.signIn.guest'), icon: null as any };
  }

  // 2) email/password local account
  if (method === "email") {
    return { label: sessionEmail ?? t('profile.signIn.email'), icon: faEnvelope };
  }

  // 3) social providers
  if (provider === "google") {
    return { label: t('profile.signIn.google'), icon: faGoogle };
  }
  if (provider === "apple") {
    return { label: t('profile.signIn.apple'), icon: faApple };
  }
  if (provider === "wechat") {
    return { label: t('profile.signIn.wechat'), icon: faWeixin };
  }

  return { label: t('profile.signIn.social'), icon: null as any };
})();




function requireLogin(e?: React.SyntheticEvent) {
  if (authed) return true;
  e?.preventDefault();
  e?.stopPropagation();
  setShowPremiumModal(true);
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
const pathname = usePathname();
const sp = useSearchParams();


const handleSave = async (e: React.SyntheticEvent) => {
   if (!authed) {
    requireLogin(e);
    return;
  }
  setSaving(true);
  try {
    saveProfile();
    setSaveMsg(t('profile.messages.saved'));
    setTimeout(() => setSaveMsg(null), 450);
  } finally {
    setSaving(false);
  }
};



const goComingSoon = (feature: string) => {
  const qs = sp.toString();
  const returnTo = `${pathname}${qs ? `?${qs}` : ''}`;

  router.push(
    `/coming-soon?feature=${encodeURIComponent(feature)}&returnTo=${encodeURIComponent(returnTo)}`
  );
};

const { userKey: entUserKey, refresh: refreshEnt, grantPremium, isPremium } = useEntitlements();
const [restoring, setRestoring] = useState(false);
const [restoreMsg, setRestoreMsg] = useState<string | null>(null);
const restoreBusyRef = useRef(false);
const restoreMsgTimerRef = useRef<number | null>(null);

const showRestoreMsg = (msg: string, durationMs = 1200) => {
  setRestoreMsg(msg);

  if (restoreMsgTimerRef.current) {
    window.clearTimeout(restoreMsgTimerRef.current);
  }

  restoreMsgTimerRef.current = window.setTimeout(() => {
    setRestoreMsg(null);
    restoreMsgTimerRef.current = null;
  }, durationMs);
};

useEffect(() => {
  return () => {
    if (restoreMsgTimerRef.current) {
      window.clearTimeout(restoreMsgTimerRef.current);
    }
  };
}, []);

useEffect(() => {
  if (!languageMenuOpen) return;

  const handlePointerDown = (event: MouseEvent | TouchEvent) => {
    const target = event.target;
    if (!languageMenuRef.current || !(target instanceof Node)) return;
    if (languageMenuRef.current.contains(target)) return;
    setLanguageMenuOpen(false);
  };

  const handleEscape = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    setLanguageMenuOpen(false);
  };

  document.addEventListener('mousedown', handlePointerDown);
  document.addEventListener('touchstart', handlePointerDown);
  document.addEventListener('keydown', handleEscape);

  return () => {
    document.removeEventListener('mousedown', handlePointerDown);
    document.removeEventListener('touchstart', handlePointerDown);
    document.removeEventListener('keydown', handleEscape);
  };
}, [languageMenuOpen]);

const handleRestorePurchases = async (e: React.SyntheticEvent) => {
  if (authLoading || restoreBusyRef.current || restoring) return;

  // Restore requires a real signed-in account, not the generic premium modal flow.
  if (!authed) {
    e.preventDefault();
    e.stopPropagation();
    showRestoreMsg(t('profile.messages.restoreLoginRequired'));
    return;
  }

  // Restore only makes sense in native store builds
  if (!Capacitor.isNativePlatform()) {
    showRestoreMsg(t('profile.messages.restoreMobileOnly'));
    return;
  }

  restoreBusyRef.current = true;
  setRestoring(true);
  setRestoreMsg(null);

  try {
    // Ensure RC is configured + tied to the logged-in user
    const ready = await ensureRevenueCat(entUserKey);
    if (!ready) {
      showRestoreMsg(t('profile.messages.restoreUnavailable'));
      return;
    }

    const { customerInfo } = await Purchases.restorePurchases();
    const active = customerInfo?.entitlements?.active?.[RC_ENTITLEMENT_ID];

    if (!active) {
      showRestoreMsg(t('profile.messages.restoreNone'));
      return;
    }

    // Pick a reasonable local source for instant UI
    const expMs =
      typeof active.expirationDateMillis === "number"
        ? active.expirationDateMillis
        : undefined;

    const periodType = String(active.periodType ?? "").toUpperCase();
    const source: EntitlementSource =
      expMs == null ? "lifetime" : periodType === "TRIAL" ? "trial" : "subscription";

    grantPremium(source, expMs);
    refreshEnt();

    showRestoreMsg(t('profile.messages.restoreSuccess'));
  } catch (err: any) {
    showRestoreMsg(err?.message ?? t('profile.messages.restoreFailed'));
  } finally {
    setRestoring(false);
    restoreBusyRef.current = false;
  }
};

  return (
    <main className={styles.page}>
      <div className={styles.content}>
        {/* Top "Back" row */}
        <header className={styles.headerRow}>

        </header>

        {/* Main profile card */}
       <section className={styles.profileCard}>
         <div className={styles.cardBackButton}>
    <BackButton variant="inline" />
  </div>
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
          alt={t('profile.avatarAlt')}
          width={120}
          height={120}
          className={styles.avatarImage}
        />
      ) : (
   // default before user uploads anything
        <Image
  src="/images/profile/imageupload-icon.png"
  alt={t('profile.avatarPlaceholderAlt')}
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

  <span
  aria-hidden="true"
  className={`${styles.crownIcon} ${
    isPremium ? styles.crownPremium : styles.crownFree
  }`}
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
    {signInDisplay.icon ? (
  <FontAwesomeIcon
    icon={signInDisplay.icon}
    className={styles.providerIcon}
    aria-hidden="true"
  />
) : null}


<span className={styles.emailDisplayText}>
  {showProviderEmail ? (
    <>
      {signInDisplay.label} @
      <br />
      <span className={styles.emailSubText}>{authEmail}</span>
    </>
  ) : (
    signInDisplay.label
  )}
</span>

  </div>
</div>




  {/* Premium plan bar */}
<button
  type="button"
  className={styles.premiumCard}
  onClick={() => router.push("/premium")}
>
    <span className={styles.premiumIcon}>
      <Image 
        src="/images/profile/crown-icon.png"
        alt={t('profile.premiumIconAlt')}
        width={35}
        height={35}
      />
    </span>
    <span className={styles.premiumText}>{t('profile.premiumPlan')}</span>
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
                    alt={t('profile.lightDarkModeIconAlt')}
                    width={24}
                    height={24}
                  />
                </span>
                <span className={styles.settingsLabel}>
                  {t('profile.lightDarkMode')}
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

{canManageCredentials && (
  <button
    type="button"
    className={styles.settingsRow}
    onClick={() => router.push("/account-security")}
  >
    <div className={styles.settingsLeft}>
      <span className={styles.settingsIcon}>
        <Image
          src="/images/profile/lock-icon.png"
          alt={t('profile.accountSecurityIconAlt')}
          width={24}
          height={24}
        />
      </span>

      <span className={styles.settingsLabel}>{t('profile.changeCredentials')}</span>
    </div>

    <span className={styles.chevron}>›</span>
  </button>
)}

<button
  type="button"
  className={styles.settingsRow}
  onClick={(e) => handleRestorePurchases(e)}
  disabled={restoring || authLoading}
>
  <div className={styles.settingsLeft}>
   <span
  className={`${styles.settingsIcon} ${styles.restoreIcon}`}
  aria-hidden="true"
/>
    <span className={styles.settingsLabel}>
      {restoring ? t('profile.restoring') : t('profile.restorePurchases')}
    </span>
  </div>
  <span className={styles.chevron}>›</span>
</button>

<button
  type="button"
  className={styles.settingsRow}
  onClick={() => router.push("/privacy")}
>
  <div className={styles.settingsLeft}>
    <span className={styles.settingsIcon}>
      <Image
        src="/images/profile/privacypolicy-icon.png"
        alt={t('profile.privacyPolicyIconAlt')}
        width={24}
        height={24}
      />
    </span>
    <span className={styles.settingsLabel}>{t('profile.privacyPolicy')}</span>
  </div>
  <span className={styles.chevron}>›</span>
</button>

<button
  type="button"
  className={styles.settingsRow}
  onClick={() => router.push("/terms")}
>
  <div className={styles.settingsLeft}>
    <span className={styles.settingsIcon}>
      <Image
        src="/images/profile/privacypolicy-icon.png"
        alt={t('profile.termsIconAlt')}
        width={24}
        height={24}
      />
    </span>
    <span className={styles.settingsLabel}>{t('profile.terms')}</span>
  </div>
  <span className={styles.chevron}>›</span>
</button>

<button
  type="button"
  className={styles.settingsRow}
  onClick={(e) => {
    if (!requireLogin(e)) return;
    router.push("/account/delete-account");
  }}
>
  <div className={styles.settingsLeft}>
    <span className={styles.settingsIcon}>
      <Image
        src="/images/profile/privacypolicy-icon.png"
        alt={t('profile.deleteAccountIconAlt')}
        width={24}
        height={24}
      />
    </span>
    <span className={styles.settingsLabel}>{t('profile.deleteAccount')}</span>
  </div>
  <span className={styles.chevron}>›</span>
</button>
        <div
          className={`${styles.settingsMenuBlock} ${languageMenuOpen ? styles.settingsMenuBlockOpen : ''}`}
          ref={languageMenuRef}
        >
          <button
            type="button"
            className={styles.settingsRow}
            onClick={() => setLanguageMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={languageMenuOpen}
            aria-controls={languageMenuId}
            aria-label={t('profile.language.switchAria', { language: currentLanguage.label })}
          >
            <div className={styles.settingsLeft}>
              <span className={styles.settingsIcon}>
                <Image 
                  src="/images/profile/aboutus-icon.png"
                  alt={t('profile.languageIconAlt')}
                  width={24}
                  height={24}
                />
              </span>
              <span className={styles.settingsLabel}>{t('profile.language.label')}</span>
            </div>

            <span className={styles.languageValue}>
              <span className={styles.languageCurrent}>{currentLanguage.label}</span>
              <span
                className={`${styles.chevron} ${languageMenuOpen ? styles.chevronOpen : ''}`}
                aria-hidden="true"
              >
                ›
              </span>
            </span>
          </button>

          {languageMenuOpen ? (
            <div
              id={languageMenuId}
              className={styles.languageDropdown}
              role="menu"
              aria-label={t('profile.language.label')}
            >
              {LANGUAGE_OPTIONS.map((option) => {
                const isSelected = option.code === locale;
                const enabled = isEnabledLanguageOption(option);
                const translatedQuestionNotice = getTranslatedOnlyLocaleNotice(
                  option.code,
                  translationCounts[option.code] ?? 0,
                );

                return (
                  <button
                    key={option.code}
                    type="button"
                    className={`${styles.languageOption} ${
                      isSelected ? styles.languageOptionSelected : ''
                    } ${!enabled ? styles.languageOptionDisabled : ''}`}
                    role={enabled ? 'menuitemradio' : 'menuitem'}
                    aria-checked={enabled ? isSelected : undefined}
                    aria-disabled={!enabled}
                    disabled={!enabled}
                    onClick={() => {
                      if (!enabled) return;
                      setLocale(option.code as Locale);
                      setLanguageMenuOpen(false);
                    }}
                  >
                    <span className={styles.languageOptionLabel}>{option.label}</span>
                    {translatedQuestionNotice ? (
                      <span className={styles.languageOptionMeta}>
                        {translatedQuestionNotice}
                      </span>
                    ) : !enabled ? (
                      <span className={`${styles.languageOptionMeta} ${styles.languageOptionStatus}`}>
                        {t('profile.language.notReady')}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>



        <button
  type="button"
  className={styles.settingsRow}
  onClick={() => goComingSoon(t('comingSoon.notificationsKey'))}
>
          <div className={styles.settingsLeft}>
            <span className={styles.settingsIcon}>
              <Image 
                src="/images/profile/bell-icon.png"
                alt={t('profile.notificationsIconAlt')}
                width={24}
                height={24}
              />
            </span>
            <span className={styles.settingsLabel}>{t('profile.notifications')}</span>
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
  {saving ? t('shared.common.saving') : t('shared.common.save')}
</button>


  {authed ? (
  <LogoutButton className={styles.logoutButton} />
) : (
  <Link className={styles.loginButton} href="/login?next=/profile">
    {t('shared.premiumFeatureModal.login')}
  </Link>
)}
</div>

{saveMsg ? (
  <div className={styles.toastOverlay} aria-live="polite">
    <div className={styles.toastCard}>
      <Image
        src="/images/profile/greencheck-icon.png"
        alt={t('profile.toastCheckAlt')}
        width={16}
        height={16}
        className={styles.toastIcon}
        priority
      />
      <span className={styles.toastText}>{saveMsg}</span>
      </div>
  </div>
) : null}

{restoreMsg ? (
  <div className={styles.toastOverlay} aria-live="polite">
    <div className={styles.toastCard}>
      <Image
        src="/images/profile/greencheck-icon.png"
        alt={t('profile.toastInfoAlt')}
        width={16}
        height={16}
        className={styles.toastIcon}
        priority
      />
      <span className={styles.toastText}>{restoreMsg}</span>
    </div>
  </div>
) : null}

<PremiumFeatureModal
  open={showPremiumModal}
  onClose={() => setShowPremiumModal(false)}
  nextPath="/profile"
  isAuthed={authed}
  premiumPath="/premium?next=%2Fprofile"
/>
      </div>

      {/* Re-use the existing bottom navigation */}
      <BottomNav />
    </main>
  );
}

export default function ProfilePage() {
  return (
    <CSRBoundary>
      <Inner />
    </CSRBoundary>
  );
}
