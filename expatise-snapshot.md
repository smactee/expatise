### README.md
```md
# Expatise

**Expatise (Expat + Expertise)** – is a progressive web app built with Next.js that helps expats in China prepare for the local driver’s license exam through clear, localized practice tests and a mobile-first user experience.

The long-term vision is to expand Expatise into a broader “toolbox for expat life” in China — and eventually other countries.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
  - [Planned Exam Features](#planned-exam-features)
  - [Future Vision](#future-vision)
- [Tech Stack](#tech-stack)
- [Roadmap](#roadmap)

---

## Overview

Expatise is designed for **non-Chinese speakers living in China** who need a simple, understandable way to prepare for the Chinese driver’s license exam.

The goal is to:

- Make the exam **less intimidating** by providing clean modern UI, clear wording, and study modes tailored for expats.
- Offer a **PWA** experience that feels like a native app: installable, offline-friendly, and fast.
- Eventually grow into a broader **“toolbox” for expat life in China** and, long term, other countries.

---

## Features

### Planned Exam Features

> These are **planned** features for the first public version of Expatise.

- **Practice Tests**
  - Full-length mock exams modeled after the official Chinese driver’s license test.
  - Timed mode to simulate real exam pressure.

- **Question Bank Explorer**
  - Browse questions by category (traffic signs, laws, scenarios, penalties, etc.).
  - Filter by difficulty or topic.

- **Review & Analytics**
  - See wrong answers and explanations.
  - Track progress over time: weak topics, accuracy, and streaks.

- **Language & Localization**
  - Designed primarily for **expats** (clear English, minimal jargon).
  - Room to add additional languages later (e.g., Korean, Chinese, others).

- **Offline-friendly Study**
  - Core UI and previously loaded questions accessible while offline.
  - Ideal for studying on the subway / in low-signal environments.

### Future Vision

If usage and adoption grows, Expatise may expand into:

- **Expat Toolbox for China**
  - Other license test preps.
  - Used-goods marketplace.
  - Service listings
  - Community resources
  - Shared services and recommendations between expats.
- **Multi-country support**
  - Adapting the model for other countries’ driving exams and expat tools.

---

## Tech Stack

- **Next.js (App Router)** -core framework
- **React + TypeScript** -component logic + type safety
- **Tailwind CSS** styling
- **Node.js**-runtime environment
- **PWA support**-manifest + service worker

---

## Roadmap

1. **MVP (v0.1)**
   - Replace starter PWA content with Expatise branding and basic layout.
   - Implement a minimal practice test using a small, static question set.
   - Ensure a mobile-first, responsive layout that works well on phones.

2. **Question Bank & Study Modes (v0.2–v0.3)**
   - Integrate a larger question bank (subject to licensing and data source).
   - Add categories (signs, rules, penalties, scenarios, etc.).
   - Provide both timed exam mode and untimed practice mode.

3. **Progress & Analytics (v0.4)**
   - Track user performance (accuracy, weak topics, recent attempts).
   - Show a simple progress summary/dashboard.
   - Allow users to revisit previously wrong questions.

4. **Offline & UX Improvements (v0.5)**
   - Improve offline caching strategy for questions and key assets.
   - Polish UI states: loading, errors, empty states, and micro-interactions.
   - Add basic accessibility checks (contrast, keyboard navigation, ARIA where needed).

5. **Expat Toolbox (China) (v0.6+)**
   - Add experimental utilities for expats in China (checklists, quick-reference guides, etc.).
   - Explore early concepts for a used-goods marketplace or other community features.
   - Gather feedback to shape which tools are most valuable.

6. **Multi-country Expansion (Future)**
   - Generalize the data model to support other countries’ exams.
   - Add localization for multiple languages and regions.
   - Explore separate “country profiles” that customize content and flows.

---


```

### app/api/auth/[...nextauth]/route.ts
```tsx
import { handlers } from "../../../auth";

export const { GET, POST } = handlers;

```

### app/api/local-login/route.ts
```tsx
import { NextResponse } from "next/server";
import { checkUserPassword } from "../../../lib/user-store"; // if you don't use @, switch to relative
import { AUTH_COOKIE, normalizeEmail } from "../../../lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");

  // Always keep response generic (no account enumeration)
  if (!email || !password) {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const ok = checkUserPassword(email, password);
  const res = NextResponse.json({ ok }, { status: 200 });
  if (ok) {
    // DEV session cookie (replace with real session management later)
    res.cookies.set(AUTH_COOKIE, email, {
      name: AUTH_COOKIE,
      value: email,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 300, // 300 days
    });
  }


  return res;
}

```

### app/api/logout/route.ts
```tsx
import { NextResponse } from "next/server";
import { AUTH_COOKIE } from "../../../lib/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });

  res.cookies.set({
    name: AUTH_COOKIE,
    value: "",
    path: "/",
    maxAge: 0,
  });

  return res;
}

```

### app/api/onboarding/route.ts
```tsx
import { NextResponse } from 'next/server';
import { ONBOARDING_COOKIE } from '@/lib/middleware/paths';

export async function POST() {
  const res = NextResponse.json({ ok: true });

  res.cookies.set({
    name: ONBOARDING_COOKIE,
    value: '1',
    path: '/',
    maxAge: 60 * 60 * 24 * 1000, // 1 year
  });

  return res;
}

```

### app/api/password-reset/confirm/route.ts
```tsx
import { NextResponse } from "next/server";
import { verifyOtp, consumeOtp } from "@/lib/password-reset-store"; // adjust if no @
import { setUserPassword } from "@/lib/user-store";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const email = String(body?.email || "").trim().toLowerCase();
  const code = String(body?.code || "").trim();
  const newPassword = String(body?.newPassword || "");

  if (!email || !code || newPassword.length < 8) {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }

  const v = verifyOtp(email, code);
  if (!v.ok) {
    return NextResponse.json({ ok: false, message: "Code is invalid or expired." }, { status: 400 });
  }

  const updated = setUserPassword(email, newPassword);
  consumeOtp(email);

  if (!updated) {
    // still generic — but realistically this means user doesn’t exist in our DEV store
    return NextResponse.json({ ok: false, message: "Code is invalid or expired." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

```

### app/api/password-reset/start/route.ts
```tsx
import { NextResponse } from "next/server";
import { createOtp } from "@/lib/password-reset-store"; // if you don’t use @, change to relative import
import { userExists } from "@/lib/user-store";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body?.email || "").trim().toLowerCase();

  // Always respond the same to avoid account enumeration. :contentReference[oaicite:3]{index=3}
  if (!email) return NextResponse.json({ ok: true });

  // Only generate OTP if user exists (but don’t reveal that to the client)
  if (userExists(email)) {
    const { code, expiresAt } = createOtp(email);

    // DEV ONLY: log OTP to your terminal (later replace with email provider)
    console.log(`[password-reset] OTP for ${email}: ${code} (expires ${new Date(expiresAt).toLocaleString()})`);
  }

  return NextResponse.json({ ok: true });
}

```

### app/api/register/route.ts
```tsx
import { NextResponse } from "next/server";
import { createUser } from "../../../lib/user-store";
import { isValidEmail, normalizeEmail } from "../../../lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const email = normalizeEmail(body?.email);
  const password = String(body?.password || "");
  const confirmPassword = String(body?.confirmPassword || "");

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ ok: false, message: "Please enter a valid email address." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ ok: false, message: "Password must be at least 8 characters." }, { status: 400 });
  }
  if (password !== confirmPassword) {
    return NextResponse.json({ ok: false, message: "Passwords do not match." }, { status: 400 });
  }

  const result = createUser(email, password);
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

```

### app/api/session/route.ts
```tsx
// app/api/session/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE } from "../../../lib/auth";

export async function GET() {
    const cookieStore = await cookies();
    const authed = Boolean(cookieStore.get(AUTH_COOKIE)?.value);
    return NextResponse.json({ authed });
}

```

### app/auth.ts
```tsx
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";
import WeChat from "next-auth/providers/wechat";

const providers = [] as any[];

// ✅ add providers only if env vars exist (prevents dev crashes)
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    })
  );
}

if (process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET) {
  providers.push(
    Apple({
      clientId: process.env.AUTH_APPLE_ID,
      clientSecret: process.env.AUTH_APPLE_SECRET,
    })
  );
}

if (
  process.env.NODE_ENV === "production" &&
  process.env.AUTH_WECHAT_APP_ID &&
  process.env.AUTH_WECHAT_APP_SECRET
) {
  providers.push(
    WeChat({
      clientId: process.env.AUTH_WECHAT_APP_ID,
      clientSecret: process.env.AUTH_WECHAT_APP_SECRET,
      platformType: "WebsiteApp",
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  providers,
  trustHost: true,
  session: {
    strategy: "jwt",
    // “indefinite” isn’t literal, but you can set a long maxAge
    maxAge: 60 * 60 * 24 * 365, // 1 year (change to longer if you want)
  },
});

```

### app/forgot-password/forgot-password.module.css
```css
.page {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  padding: 18px 14px;
  background: #1f1f1f;
}

.frame {
  min-height: 100svh;
  width: 100%;
  max-width: 420px;
  border-radius: 18px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
  position: relative;
}

.sheet {
  padding: 22px 22px 30px;
}

.backBtn {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  color: rgba(107, 114, 128, 1);
  margin-bottom: 10px;
}

.title {
  margin: 0;
  font-size: 28px;
  font-weight: 800;
  color: #000;
}

.subtitle {
  margin: 6px 0 18px;
  font-size: 16px;
  color: #6b7280;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.label {
  font-size: 14px;
  color: #111827;
  font-weight: 600;
}

.input {
  width: 100%;
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.16);
  padding: 14px 14px;
  font-size: 16px;
  outline: none;
}

.input::placeholder {
   color: rgba(107, 114, 128, 0.8);
}

.input:focus {
  border-color: rgba(43, 124, 175, 0.55);
  box-shadow: 0 0 0 4px rgba(43, 124, 175, 0.14);
}

.cta {
  margin-top: 6px;
  width: 100%;
  padding: 14px 18px;
  border-radius: 18px;
  border: 1px solid var(--color-logout-border, #d2c79a);
  background: var(--color-premium-gradient, linear-gradient(90deg, rgba(43, 124, 175, 0.4), rgba(255, 197, 66, 0.4)));
  box-shadow: 0 18px 40px rgba(15, 33, 70, 0.18);
  font-size: 16px;
  font-weight: 700;
  color: #111827;
  cursor: pointer;
}

.cta:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.linkBtn {
  border: none;
  background: transparent;
  color: #6b7280;
  font-size: 14px;
  cursor: pointer;
  text-decoration: underline;
  margin-top: 4px;
}

.errorBox {
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.28);
  color: #b91c1c;
  font-size: 13px;
  line-height: 1.4;
}

.successBox {
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(34, 197, 94, 0.12);
  border: 1px solid rgba(34, 197, 94, 0.28);
  color: #166534;
  font-size: 13px;
  line-height: 1.4;
}

.errorText {
  margin-top: 8px;
  font-size: 13px;
  color: #b91c1c;
  text-align: left;
}

.hint {
  margin-top: 10px;
  font-size: 13px;
  color: #6b7280;
  line-height: 1.4;
}

.warn {
  margin-top: 8px;
  font-size: 13px;
  color: #b45309;
}

```

### app/forgot-password/page.tsx
```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./forgot-password.module.css";
import { isValidEmail, normalizeEmail } from "../../lib/auth";

type Step = "email" | "verify" | "done";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

const [emailError, setEmailError] = useState<string | null>(null);

const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  
  // Pre-login: force light mode
  useEffect(() => {
    document.documentElement.dataset.theme = "light";
  }, []);

const canSend = useMemo(() => {
  const trimmed = email.trim();
  return trimmed.length > 0 && isValidEmail(trimmed) && !loading;
}, [email, loading]);

  const canReset = useMemo(() => {
    if (loading) return false;
    if (code.trim().length < 4) return false;
    if (newPw.length < 8) return false;
    if (newPw !== confirmPw) return false;
    return true;
  }, [code, newPw, confirmPw, loading]);

  const sendCode = async () => {
    if (!canSend) return;
    setError(null);
    setLoading(true);
    try {
      await fetch("/api/password-reset/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setStep("verify");
    } catch {
      setError("Couldn’t start password reset. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!canReset) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, newPassword: newPw }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data?.message || "Code is invalid or expired.");
        return;
      }

      setStep("done");
    } catch {
      setError("Reset failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <section className={styles.sheet}>
          <button type="button" className={styles.backBtn} onClick={() => router.back()}>
            ← Back
          </button>

          <h1 className={styles.title}>Reset password</h1>

          {step === "email" && (
            <>
              <p className={styles.subtitle}>Enter your email to get a one-time code.</p>

              <label className={styles.label}>Email</label>
              <input
  className={styles.input}
  value={email}
  onChange={(e) => {
    setEmail(e.target.value);
    if (emailError) setEmailError(null);
  }}
  onBlur={() => {
    const trimmed = email.trim();
    if (!trimmed) return setEmailError("Email is required.");
    if (!isValidEmail(trimmed)) return setEmailError("Please enter a valid email address.");
    setEmail(trimmed);
    setEmailError(null);
  }}
  type="email"
  autoComplete="email"
  onFocus={() => {
    setError(null);
    if (emailError) setEmailError(null);
  }}
  placeholder="user@expatise.com"
/>
              {emailError && <div className={styles.errorBox}>{emailError}</div>}

              {error && <div className={styles.errorBox}>{error}</div>}

              <button className={styles.cta} disabled={!canSend} onClick={sendCode}>
                {loading ? "Sending..." : "Send code"}
              </button>

              <p className={styles.hint}>
                Dev mode: the code is printed in your terminal (later we’ll email it).
              </p>
            </>
          )}

          {step === "verify" && (
            <>
              <p className={styles.subtitle}>Enter the code and set a new password.</p>

              <label className={styles.label}>One-time code</label>
              <input
                className={styles.input}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                placeholder="6-digit code"
                onFocus={() => setError(null)}
              />

              <label className={styles.label}>New password</label>
              <input
                className={styles.input}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                type="password"
                placeholder="At least 8 characters"
                onFocus={() => setError(null)}
              />

              <label className={styles.label}>Confirm password</label>
              <input
                className={styles.input}
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                type="password"
                onFocus={() => setError(null)}
              />

              {newPw && confirmPw && newPw !== confirmPw && (
                <div className={styles.warn}>Passwords don’t match.</div>
              )}

              {error && <div className={styles.errorBox}>{error}</div>}

              <button className={styles.cta} disabled={!canReset} onClick={resetPassword}>
                {loading ? "Resetting..." : "Reset password"}
              </button>

              <button type="button" className={styles.linkBtn} onClick={sendCode} disabled={!canSend}>
                Resend code
              </button>
            </>
          )}

          {step === "done" && (
            <>
              <div className={styles.successBox}>Password updated. You can sign in now.</div>
              <button className={styles.cta} onClick={() => router.push("/login")}>
                Back to sign in
              </button>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

```

### app/globals.css
```css
@import "tailwindcss";

/* Base variables (used by Tailwind, etc.) */
:root {
  --background: #ffffff;
  --foreground: #171717;
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

  /* ==== Expatise UI design tokens (light palette values) ==== */

  /* Page & card backgrounds */
  --color-page-bg: linear-gradient(180deg, #e6f3ff, #f4f7ff);
  --color-profile-card-bg: linear-gradient(135deg, #f5fbff, #eef2ff);

  /* Common text colors */
  --color-heading-strong: #222435;   /* big headings, main labels */
  --color-heading-card: #111827;     /* card titles, important labels */
  --color-text-main-muted: #555b70;  /* secondary body text */
  --color-text-caption: #8a92aa;     /* tiny captions (e.g. Days Left) */
  --color-text-card-muted: #0f172a;  /* small text inside cards */

  /* Profile / settings text */
  --color-username: #2b7caf;
  --color-email-muted: #6b7280;
  --color-settings-label: #41414d;

  /* Bottom nav + accents */
  --color-nav-bg: rgba(30, 30, 31, 0.85);
  --color-nav-border: rgba(0, 0, 0, 0.9);
  --color-nav-muted: #9ca3af;

  /* Shared gradients */
  --color-premium-gradient: linear-gradient(
    90deg,
    rgba(43, 124, 175, 0.4) 0%,
    rgba(255, 197, 66, 0.4) 100%
  );
  --color-settings-bg: #f1f5f8;
  --color-logout-border: #d2c79a;

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
import { UserProfileProvider } from "@/components/UserProfile";
import "@fortawesome/fontawesome-svg-core/styles.css";
import { config } from "@fortawesome/fontawesome-svg-core";
config.autoAddCss = false; // Prevent fontawesome from adding its CSS since we did it manually above  

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
        <ThemeProvider>
          <UserProfileProvider>
          {children}
          </UserProfileProvider>
          </ThemeProvider>
      </body>
    </html>
  );
}

```

### app/login/CreateAccountModal.tsx
```tsx
'use client';

import { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGoogle, faApple, faWeixin } from '@fortawesome/free-brands-svg-icons';
import { faChevronLeft, faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import styles from './create-account-modal.module.css';
import { isValidEmail, normalizeEmail } from '../../lib/auth';

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: (email: string) => void;
};

export default function CreateAccountModal({ open, onClose, onCreated }: Props) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);


  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = useMemo(() => {
    if (isSubmitting) return false;
    if (!isValidEmail(email)) return false;
    if (pw.trim().length < 8) return false; // keep simple for now
    if (pw !== pw2) return false;
    return true;
  }, [email, pw, pw2, isSubmitting]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = normalizeEmail(email);

    if (!isValidEmail(trimmedEmail)) return setError('Please enter a valid email.');
    if (pw.trim().length < 8) return setError('Password must be at least 8 characters.');
    if (pw !== pw2) return setError('Passwords do not match.');

    setIsSubmitting(true);
    try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: trimmedEmail,
        password: pw,
        confirmPassword: pw2,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.ok) {
      setError(data?.message || 'Could not create account.');
      return;
    }

    onCreated?.(trimmedEmail);
    onClose();
  } catch {
    setError('Network error. Please try again.');
  } finally {
    setIsSubmitting(false);
  }
};

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <button type="button" className={styles.backBtn} onClick={onClose} aria-label="Back">
          <FontAwesomeIcon icon={faChevronLeft} />
        </button>

        <h2 className={styles.title}>Create Account</h2>
        <p className={styles.subtitle}>Sign up to get started</p>

        <form onSubmit={submit} className={styles.form}>
          <label className={styles.row}>
            <span className={styles.label}>Email</span>
            <input
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@expatise.com"
              type="email"
              autoComplete="email"
              onFocus={() => setError(null)}
            />
          </label>

          <label className={styles.row}>
            <span className={styles.label}>Password</span>
            <div className={styles.pwWrap}>
              <input
                className={styles.input}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="Password"
                type={showPw ? 'text' : 'password'}
                autoComplete="new-password"
                onFocus={() => setError(null)}
              />
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                <FontAwesomeIcon icon={showPw ? faEyeSlash : faEye} />
              </button>
            </div>
          </label>

          <label className={styles.row}>
            <span className={styles.label}>Confirm</span>
            <div className={styles.pwWrap}>
              <input
                className={styles.input}
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                placeholder="Confirm password"
                type={showPw2 ? 'text' : 'password'}
                autoComplete="new-password"
                onFocus={() => setError(null)}
              />
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => setShowPw2((v) => !v)}
                aria-label={showPw2 ? 'Hide password' : 'Show password'}
              >
                <FontAwesomeIcon icon={showPw2 ? faEyeSlash : faEye} />
              </button>
            </div>
          </label>

          {error && <div className={styles.errorBox}>{error}</div>}

          <button type="submit" className={styles.cta} disabled={!canSubmit}>
            {isSubmitting ? 'Creating...' : 'Create new account'}
          </button>
        </form>

        <div className={styles.dividerRow}>
          <span className={styles.dividerLine} />
          <span className={styles.dividerText}>or continue with</span>
          <span className={styles.dividerLine} />
        </div>

        <div className={styles.snsRow}>
          <button type="button" className={styles.snsBtn} aria-label="Sign up with Google">
            <FontAwesomeIcon icon={faGoogle} />
          </button>
          <button type="button" className={styles.snsBtn} aria-label="Sign up with Apple">
            <FontAwesomeIcon icon={faApple} />
          </button>
          <button type="button" className={styles.snsBtn} aria-label="Sign up with WeChat">
            <FontAwesomeIcon icon={faWeixin} />
          </button>
        </div>
      </div>

      {/* click outside to close */}
      <button type="button" className={styles.backdropClose} onClick={onClose} aria-label="Close" />
    </div>
  );
}

```

### app/login/create-account-modal.module.css
```css
.overlay {
  position: absolute;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 20px;
}

.backdropClose {
  position: absolute;
  inset: 0;
  background: rgba(17, 24, 39, 0.28);
  backdrop-filter: blur(6px);
  border: none;
}

.modal {
  position: relative;
  z-index: 60;
  width: 100%;
  max-width: 380px;
   overflow: auto;                /* scroll inside if needed */
  -webkit-overflow-scrolling: touch;
  border-radius: 26px;
  background: #ffffff;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.28);
  padding: 20px 18px 18px;
}

.backBtn {
  position: absolute;
  top: 14px;
  left: 14px;
  border: none;
  background: transparent;
  font-size: 18px;
  cursor: pointer;
  opacity: 0.75;
}

.title {
  margin: 6px 0 0;
  font-size: 26px;
  font-weight: 800;
  color: #111827;
  text-align: center;
}

.subtitle {
  margin: 6px 0 14px;
  text-align: center;
  color: #6b7280;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.label {
  font-size: 14px;
  color: #374151;
  padding-left: 6px;
}

.pwWrap {
  position: relative;
  display: flex;
  align-items: center;
}

.input {
  width: 100%;
  border: 1px solid rgba(0, 0, 0, 0.14);
  outline: none;
  border-radius: 999px;
  padding: 14px 44px 14px 16px;
  font-size: 16px;
  background: #fff;
}

.eyeBtn {
  position: absolute;
  right: 14px;
  border: none;
  background: transparent;
  cursor: pointer;
  opacity: 0.6;
}

.errorBox {
  margin-top: 2px;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.22);
  color: #b91c1c;
  font-size: 13px;
}

.cta {
  margin-top: 6px;
  width: 100%;
  padding: 14px 18px;
  border-radius: 18px;
  border: 1px solid var(--color-logout-border);
  background: var(--color-premium-gradient);
  box-shadow: 0 18px 40px rgba(15, 33, 70, 0.18);
  font-size: 16px;
  font-weight: 700;
  color: #111827;
  cursor: pointer;
}

.cta:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dividerRow {
  margin: 14px 0 10px;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 10px;
}

.dividerLine {
  height: 1px;
  background: rgba(0, 0, 0, 0.12);
}

.dividerText {
  font-size: 12px;
  color: #6b7280;
}

.snsRow {
  display: flex;
  justify-content: center;
  gap: 16px;
  padding-bottom: 20px;
}

.snsBtn {
  width: 46px;
  height: 46px;
  border-radius: 999px;
  border: 1px solid rgba(0, 0, 0, 0.14);
  background: #ffffff;
  box-shadow: 0 12px 30px rgba(15, 33, 70, 0.12);
  cursor: pointer;
  font-size: 18px;
}

```

### app/login/login.module.css
```css
.page {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  padding: 18px 14px;
  background: #1f1f1f;
}

.frame {
  min-height: 100svh;
  width: 100%;
  max-width: 420px;
  border-radius: 18px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
  position: relative;
}

.hero {
  position: relative;
  width: 100%;
  height: clamp(420px, 80svh, 560px);
  background: #111;
}

.heroImg {
  object-fit: cover;
  object-position: center;
}

.heroOverlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.35) 70%, #ffffff 99%);
}

.sheet {
  padding: 22px 22px 30px;
  margin-top: -100px;
  position: relative;
}

.title {
  margin: 0;
  font-size: 34px;
  font-weight: 800;
  color: #000;
}

.subtitle {
  margin: 6px 0 18px;
  font-size: 18px;
  color: #6b7280;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.18);
}

.icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px; /* keeps alignment consistent with password row */
  height: 34px;
}

.iconImg {
  width: 22px;
  height: 22px;
  object-fit: contain;
  opacity: 0.9; /* optional */
}


.input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 16px;
  background: transparent;
}

.eye {
  opacity: 0.6;
}

.cta {
  margin-top: 6px;
  width: 100%;
  padding: 14px 18px;
  border-radius: 18px;
  border: 1px solid var(--color-logout-border);
  background: var(--color-premium-gradient);
  box-shadow: 0 18px 40px rgba(15, 33, 70, 0.18);
  font-size: 18px;
  font-weight: 700;
  color: #111827;
  cursor: pointer;

  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.arrow {
  font-size: 22px;
}

.links {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
}

.linkBtn {
  border: none;
  background: transparent;
  color: #6b7280;
  font-size: 14px;
  cursor: pointer;
  text-decoration: underline;
}

.eyeBtn {
  background: transparent;
  border: 0;
  padding: 0;
  margin-left: 10px;
  cursor: pointer;
  color: rgba(17, 24, 39, 0.55);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
}

.eyeBtn:active {
  transform: translateY(1px);
}

.capsWarning {
  margin: 10px 0 0;
  font-size: 13px;
  color: #8b5cf6;
  text-align: left;
}

.errorBox {
  margin: 10px 0 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.28);
  color: #b91c1c;
  font-size: 13px;
  line-height: 1.4;
  text-align: left;
}

.forgotRow {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}

.linkInline {
  background: transparent;
  border: 0;
  padding: 0;
  cursor: pointer;
  text-decoration: underline;
  font-size: 14px;
  color: rgba(107, 114, 128, 1);
}

.cta:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
}

.snsBlock { margin-top: 14px; }

.snsDivider{
  display:flex; align-items:center; gap:12px;
  color: rgba(107,114,128,1);
  font-size: 13px;
}
.snsDivider::before,
.snsDivider::after{
  content:"";
  flex:1;
  height:1px;
  background: rgba(0,0,0,0.12);
}

.snsRowSmall{
  margin-top: 12px;
  display:flex;
  justify-content:center;
  gap: 14px;
}

.snsBtnSmall{
  width: 34px;
  height: 34px;
  border-radius: 999px;
  border: 1px solid rgba(0,0,0,0.14);
  background: #fff;
  display:flex;
  align-items:center;
  justify-content:center;
  cursor: pointer;
}
.snsBtnSmall svg{
  width: 14px;   /* <- this makes it “half-ish” */
  height: 14px;
  opacity: 0.95;
}

.dividerRow {
  margin: 14px 0 10px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.dividerLine {
  flex: 1;
  height: 1px;
  background: rgba(17, 24, 39, 0.12);
}

.dividerText {
  font-size: 12px;
  color: rgba(107, 114, 128, 1);
  white-space: nowrap;
}

.snsRowSmall {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 10px;
}

.snsBtnSmall {
  width: 42px;
  height: 42px;
  border-radius: 999px;
  border: 1px solid rgba(17, 24, 39, 0.12);
  background: rgba(255, 255, 255, 0.7);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  /* ✅ “half-ish” size vs modal feel */
  font-size: 14px;
}

.snsBtnSmall:active {
  transform: translateY(1px);
}

/* No Dark mode*/

```

### app/login/page.tsx
```tsx
'use client';

import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useMemo, useEffect } from 'react';
import styles from './login.module.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import CreateAccountModal from './CreateAccountModal';
import { faGoogle, faApple, faWeixin } from '@fortawesome/free-brands-svg-icons';
import {signIn, getProviders} from "next-auth/react";
import { isValidEmail, normalizeEmail, safeNextPath } from '../../lib/auth';



export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = safeNextPath(searchParams.get("next"), "/");


  const [email, setEmail] = useState('user@expatise.com');
  const [password, setPassword] = useState('');

  const [isCreateOpen, setIsCreateOpen] = useState(false);   // modal open/close state
  const [showPassword, setShowPassword] = useState(false);   //  Eye toggle
  const [capsLockOn, setCapsLockOn] = useState(false);      // Caps Lock warning
  const [error, setError] = useState<string | null>(null); // Friendly error state
  const [isSubmitting, setIsSubmitting] = useState(false);// Loading state
  const [emailTouched, setEmailTouched] = useState(false);


  const [providers, setProviders] = useState<Record<string, any> | null>(null);

  const emailNorm = normalizeEmail(email);
  const emailOK = isValidEmail(emailNorm);

  const canSubmit = useMemo(() => {
  return emailOK && password.trim().length > 0 && !isSubmitting;
}, [emailOK, password, isSubmitting]);



useEffect(() => {
  getProviders().then(setProviders);
}, []);

  useEffect (() => {
  document.documentElement.dataset.theme = 'light';
}, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailTouched(true);
    setError(null);

    if (!emailOK) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {   // call server to check password against the same store reset uses
      const res = await fetch("/api/local-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: emailNorm, password }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      await new Promise((r) => setTimeout(r, 300)); // simulate network delay (optional)
  
      if (!data.ok) {
    setError("Email or password doesn’t match. Try again or reset your password.");
    return;
  }

  router.replace(nextParam);
} catch {
  setError("Network error. Please try again.");
}
  finally {
  setIsSubmitting(false);
}
  };

  const handleCaps = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Works in modern browsers
    const caps = e.getModifierState?.("CapsLock") ?? false;
    setCapsLockOn(caps);
  };


  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <div className={styles.hero}>
          <Image
            src="/images/auth/login-screen.png"
            alt="Welcome background"
            fill
            priority
            className={styles.heroImg}
          />
          <div className={styles.heroOverlay} />
        </div>

        <section className={styles.sheet}>
          <h1 className={styles.title}>Welcome!</h1>
          <p className={styles.subtitle}>Sign in to continue.</p>

          <form onSubmit={onSubmit} className={styles.form}>
            <label className={styles.row}>
              <span className={styles.icon}>
                <Image 
                src="/images/auth/username-icon.png"
                alt="Username"
                width={22}
                height={22}
                />
              </span>
              <input
                className={styles.input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                autoComplete="email"
                type="email"
              />
            </label>

            <label className={styles.row}>
              <span className={styles.icon}>
                <Image 
                src="/images/auth/password-icon.png"
                alt="Password"
                width={22}
                height={22}
                />
              </span>
              <input
                className={styles.input}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                onKeyUp={handleCaps}
                onKeyDown={handleCaps}
                onFocus={() => setError(null)}
              />
{/* ✅ (1) Eye toggle using Font Awesome */}
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
              </button>
            </label>

            {/* ✅ (2) Caps Lock warning */}
            {capsLockOn && (
              <div className={styles.capsWarning}>Caps Lock is on</div>
            )}

            {/* ✅ (4) Friendly error state */}
            {error && <div className={styles.errorBox}>{error}</div>}

            {/* ✅ (3) Forgot password link */}
            <div className={styles.forgotRow}>
              <button
                type="button"
                className={styles.linkInline}
                onClick={() => router.push("/forgot-password")}
              >
                Forgot password?
              </button>
            </div>

            <button type="submit" className={styles.cta} disabled={!canSubmit}>
              {/* ✅ (6) Loading state */}
              <span>{isSubmitting ? "Signing in..." : "Sign In"}</span>
              <span className={styles.arrow}>→</span>
            </button>
          </form>


          <div className={styles.links}>
            <button 
            type="button" 
            className={styles.linkBtn}
            onClick={() => setIsCreateOpen(true)}
            >
              Create a new account
              </button>

            <button type="button" className={styles.linkBtn} onClick={() => router.push('/')}>
              Continue as guest
            </button>
          </div>
          <CreateAccountModal
            open={isCreateOpen}
            onClose={() => setIsCreateOpen(false)}
            onCreated={(newEmail) => {
              setEmail(newEmail);
            }}
            />  
            <div className={styles.snsBlock}>
  <div className={styles.snsDivider}>
    <span>or continue with</span>
  </div>

  <div className={styles.snsRowSmall}>
    {providers?.google && (
    <button type="button" 
    className={styles.snsBtnSmall} 
    aria-label="Continue with Google"
    onClick={() => signIn("google", { callbackUrl: nextParam })}>
    <FontAwesomeIcon icon={faGoogle} />
    </button>
    )}

    {providers?.apple && (
    <button 
    type="button" 
    className={styles.snsBtnSmall} 
    aria-label="Continue with Apple"
    onClick={() => signIn("apple", { callbackUrl: "/" })}>
    <FontAwesomeIcon icon={faApple} />
    </button>
    )}

    {providers?.wechat && (
    <button 
    type="button" 
    className={styles.snsBtnSmall} 
    aria-label="Continue with WeChat"
    onClick={() => signIn("wechat", { callbackUrl: "/" })}>
    <FontAwesomeIcon icon={faWeixin} />
    </button>
    )}
  </div>
</div>

        </section>
      </div>
    </main>
  );
}

```

### app/onboarding/onboarding.module.css
```css
.page {
  min-height: 100svh;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 18px 14px;
  background: #1f1f1f;
  flex-direction: column;
}

.header {
  padding-top: calc(16px + env(safe-area-inset-top, 0px));
  padding-left: 16px;
  padding-right: 16px;
  padding-bottom: 10px;
  background: #ffffff;
  flex: 0 0 auto;
}

.main {
  flex: 1 1 auto;
  display: grid;
  grid-template-rows: 1fr auto;
  flex-direction: column;
  min-height: 0;
}

.frame {
  height: 100svh;
  width: 100%;
  max-width: 420px;
  border-radius: 18px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
}

.hero {
  position: relative;
  width: 100%;
  height: 420px;
  background: #111;
  overflow: hidden;
  flex: 1 1 auto;
}

.heroImg {
  object-fit: cover;
  object-position: center;
}

.heroFade {
  pointer-events: none;
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0) 55%, rgba(255, 255, 255, 1) 96%);
}

.content {
  flex: 0 0 auto;
  padding: 18px 20px min(60px, calc(24px + env(safe-area-inset-bottom, 0px)));
  text-align: center;
}

.sheet {
  padding: 26px 22px 30px;
  text-align: center;
}

.title {
  margin: 0;
  font-size: 28px;
  line-height: 1.15;
  font-weight: 800;
  color: #111827;
}

.highlight {
  background: var(--onboarding-highlight, #b9dcff); /* default light blue fallback */
  padding: 0 4px;
  border-radius: 2px;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
  white-space: nowrap; /* keeps Driver's License together */
}

.subtitle {
  margin: 14px 0 22px;
  font-size: 16px;
  color: #6b7280;
}

.cta {
  width: 100%;
  max-width: 320px;
  padding: 14px 18px;
  border-radius: 18px;
  border: 1px solid var(--color-logout-border);
  background: var(--color-premium-gradient);
  box-shadow: 0 18px 40px rgba(15, 33, 70, 0.18);
  font-size: 20px;
  font-weight: 700;
  color: #111827;
  cursor: pointer;
}


```

### app/onboarding/page.tsx
```tsx
'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import styles from './onboarding.module.css';

export default function OnboardingPage() {
  const router = useRouter();

  const handleGetStarted = async () => {
    const res = await fetch('/api/onboarding', { method: 'POST' });
    if (!res.ok) return;
    router.replace('/login'); // replace = “don’t show onboarding on back”
  };

  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <div className={styles.hero}>
          <Image
            src="/images/auth/onboarding-girl.png"
            alt="Onboarding hero"
            fill
            priority
            className={styles.heroImg}
          />
          <div className={styles.heroFade} />
        </div>

        <section className={styles.sheet}>
          <h1 className={styles.title}>
  Study For The <span className={styles.highlight}>Driver&apos;s&nbsp;License</span>
  <br />
  Test Wherever You Are
</h1>

          <p className={styles.subtitle}>Get easy access to prepare for your license.</p>

          <button className={styles.cta} onClick={handleGetStarted}>
            Get Started
          </button>
        </section>
      </div>
    </main>
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
  background: var(--color-page-bg);
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
  color: var(--color-heading-strong);
}

.examTitle {
  margin: 0;
  font-size: 34px;
  font-weight: 700;
  color: var(--color-heading-strong);
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
  color: var(--color-heading-strong);
  cursor: pointer;
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
  cursor: pointer;
}


.timeBlock {
  display: flex;
  flex-direction: column;
}

.bigDate {
  font-size: 34px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--color-heading-strong);
}

/* test time text */
.timeText {
  font-size: 16px;
  font-weight: 500;
  margin-top: 0.2rem;
  color: var(--color-text-main-muted);

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
  color: var(--color-text-caption);
}

.daysLeftContainer {
  margin-top: 10px;
}

.daysLeftNumber {
  font-size: 34px;
  font-weight: 700;
  margin-bottom: 0px;
  color: var(--color-heading-strong);
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
  color: var(--color-heading-strong);
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
  color: var(--color-text-card-muted);
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
  color: var(--color-heading-card);
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
  background: var(--color-nav-bg);
  border: 1px solid var(--color-nav-border);
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
  color: var(--color-nav-muted);
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
  color: var(--color-nav-muted);
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
  gap: 8px;              /* 28px gap between icon and text */
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
/* Test Day Modal (fake page)*/
/* ========================= */

.testModalBackdrop {
  position: fixed;
  inset: 0;
  z-index: 70; /* above bottom nav */
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  justify-content: center;
  align-items: center;
}

.testModalSheet {
  width: 100%;
  max-width: 420px;
  max-height: calc(100vh - 40px);
  border-radius: 36px;
  padding: 20px 20px 28px;
  background: linear-gradient(180deg, #e6f3ff 0%, #f4f0dc 100%);
  box-shadow: 0 24px 60px rgba(15, 33, 70, 0.35);
  overflow-y: auto;
}

/* === "Have a good day" header card inside modal === */

.testModalHeaderCard {
  width: 100%;
  max-width: 375px;          /* matches Figma width */
  height: 110px;             /* matches Figma height */
  margin: 0 auto 24px;       /* center horizontally, space below */

  padding: 16px 18px;
  border-radius: 25px;

  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.2) 0%,
    rgba(43, 124, 175, 0.2) 100%
  );

  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.18); /* approximate Figma drop shadow */
}

/* Left side (texts) */
.testModalHeaderLeft {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* "Have a good day" + sun */
.testModalGreetingRow {
  display: flex;
  align-items: center;
  gap: 6px;
}

.testModalGreetingText {
  font-size: 14px;
  font-weight: 500;
  color: #4b5563; /* softer grey, adjust from Figma */
}

.testModalSunIcon {
  font-size: 18px;
}

/* Name ("Kang") */
.testModalName {
  font-size: 22px;
  font-weight: 700;
  color: #111827;
}

/* Subtitle */
.testModalSubtext {
  font-size: 13px;
  font-weight: 400;
  color: #6b7280;
}

/* Avatar on the right */
.testModalAvatarWrapper {
  flex-shrink: 0;
}

.testModalAvatar {
  width: 66px;
  height: 66px;
  border-radius: 20px; /* or 50% if the Figma avatar is fully round */
  object-fit: cover;
}


.testModalHeader {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.testModalBackButton {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
}

.testModalBackIcon {
  font-size: 22px;
}

.testModalBackText {
  font-size: 18px;
  font-weight: 600;
}

.testModalMainCard {
  margin-top: 8px;
  border-radius: 28px;
  padding: 36px 22px 28px;
  background: linear-gradient(180deg, #f5fbff 0%, #f4f0dc 100%);
  box-shadow: 0 18px 40px rgba(15, 33, 70, 0.18);
  text-align: center;
}

.testModalTitle {
  margin: 0 0 10px;
  font-size: 30px;
  font-weight: 700;
  line-height: 1.15;
  color: var(--color-heading-strong);
}

.testModalTitle span {
  color: #2b7caf;
  display: block;
}

.testModalDescription {
  margin: 0 0 26px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-text-main-muted);
}

.testModalDateRow {
  display: flex;
  justify-content: center;
  gap: 14px;
  margin-bottom: 28px;
  cursor: pointer;
}

.testModalDateBox {
  width: 96px;
  padding: 10px 8px;
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.7);
  background: #f9fbff;
  box-shadow: 0 8px 16px rgba(15, 23, 42, 0.08);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.testModalDateLabel {
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #9ca3af;
}

.testModalDateValue {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

/* The "real" date/time inputs that sit on top of the pretty boxes */
.testModalHiddenDateInput {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  z-index: 5;
}


/* Make the rows a positioning context */
.testModalDateRow,
.testModalTimeRow {
  position: relative;
  display: flex;
  gap:12px;
}


.testModalButtons {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 8px;
}

.testModalPrimaryButton {
  padding: 12px 18px;
  border-radius: 20px;
  border: 1px solid #d2c79a;
  background: linear-gradient(
    90deg,
    rgba(43, 124, 175, 0.4) 0%,
    rgba(255, 197, 66, 0.4) 100%
  );
  box-shadow: 0 18px 40px rgba(15, 33, 70, 0.26);
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  cursor: pointer;
}

.testModalSecondaryButton {
  padding: 10px 18px;
  border-radius: 20px;
  border: none;
  background: transparent;
  font-size: 16px;
  font-weight: 500;
  color: #6b7280;
  cursor: pointer;
}

@media (max-width: 430px) {
  .testModalSheet {
    border-radius: 0;
    max-width: 100%;
    max-height: 100vh;
  }
}

.testModalTimeRow {
  display: flex;
  justify-content: center;
  margin-top: -6px;    /* tweak spacing as you like */
  margin-bottom: 24px;
  cursor: pointer;
}

.testModalTimeBox {
  width: 100%;
  max-width: 260px;
  padding: 10px 12px;
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.7);
  background: #f9fbff;
  box-shadow: 0 8px 16px rgba(15, 23, 42, 0.08);
  display: flex;
  flex-direction: column;
  align-items: center;
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
import { useUserProfile } from '../components/UserProfile';



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
const avatarSrc = userAvatarSrc || '/images/profile/profile-placeholder.png';

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
      width={66}
      height={66}
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
```

### app/profile/page.tsx
```tsx
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

  const { authed, loading: authLoading, refresh } = useAuthStatus();
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

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
const [emailError, setEmailError] = useState<string | null>(null);


// true when there's something in the field, no error, and it passes regex
const isEmailValid =
  !!email.trim() && !emailError && isValidEmail(email.trim());

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
  if (!requireLogin(e)) return;

  setSaveMsg(null);

  if (!isValidEmail(email)) {
    setEmailError("Please enter a valid email address.");
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

<div className={styles.emailWrapper}>
  <div className={styles.emailInputRow}>
  <input
    type="email"
    className={`${styles.email} ${emailError ? styles.emailInvalid : ""} ${!authed ? styles.lockedClickable : ""}`}    value={email}
    size={Math.max(email.length, 20)}   // 👈 keeps width in sync with text
    readOnly={!authed}
    onMouseDown={(e) => { if (!authed) requireLogin(e); }}
    onFocus={(e) => {if (!authed) e.currentTarget.blur(); }}
    onChange={(e) => {
      if (!authed)  return;
      const value = e.target.value;
      setEmail(value);
      // clear error while they are typing
      if (emailError) setEmailError(null);
    }}
    onBlur={(e) => {
      if (!authed) return;
      const trimmed = e.target.value.trim();

      if (!trimmed) {
        // empty → fallback to default & clear error
        setEmail('user@expatise.com');
        setEmailError(null);
        return;
      }

      if (!isValidEmail(trimmed)) {
        setEmailError('Please enter a valid email address.');
        // keep what they typed
        setEmail(trimmed);
        return;
      }

      // valid email → save it
      setEmail(trimmed);
      setEmailError(null);
    }}
    placeholder="user@expatise.com"
  />

    {isEmailValid && (
      <span className={styles.emailValidIcon}>
      <Image src="/images/profile/checkmark-icon.png" 
      alt="Valid Email Icon" 
      width={20} 
      height={20} 
      />
      </span>
    )} 
    
  </div>

  {emailError && (
    <div className={styles.emailErrorText}>{emailError}</div>
  )}
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
        You can continue as a guest, but changes won’t be saved. Log in to keep your data.
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


```

### app/profile/profile.module.css
```css
.page {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  background: var(--color-page-bg);
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
  color: var(--color-heading-strong);
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
  background: var(--color-profile-card-bg);
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
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(243, 244, 246, 1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.avatarInput {
  display: none;
}


.avatarImage {
  object-fit: cover;
}

.avatarPlaceholder {
  object-fit: contain;   /* show whole icon */
  transform: scale(0.6); /* 0.6 = 60% of the circle size; tweak as you like */
  background: transparent;
}


.nameRow {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
  width: fit-content;
  margin-left: auto;
  margin-right: auto;
}

.usernameEditable {
  display: inline-block;    /* width = text width */
  font-size: 22px;
  font-weight: 700;
  color: #1D72D8;
  cursor: text;
  white-space: nowrap;      /* keep username on one line */
}

.usernameEditable:focus {
  outline: none;
  border-bottom: 2px solid rgba(29, 114, 216, 0.3);
}

.nameRowInner {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.username {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-username);
}

.usernameInput {
  border: none;
  background: transparent;
  text-align: center;
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--color-username);
  outline: none;
  padding: 0;
  max-width: 180px; /* tweak so it doesn't jump around */
  min-width: 80px;
}

.usernameInput:focus {
  outline: none;
  border-bottom: 2px solid rgba(29, 114, 216, 0.4);
}

.crown {
  font-size: 18px;
}

.crownIcon {
  display: inline-block;
  flex-shrink: 0;
}

.emailWrapper {
  margin-top: 6px;
  display: flex;
  flex-direction: column;   /* stack input + error vertically */
  align-items: center;      /* center under avatar */
}

.emailInputRow {
  display: inline-flex;
  justify-content: center;
}

.email {
  margin: 0;
  font-size: 14px;
  line-height: 1.4;
  text-align: center;
  color: #7b8ba1;
  border: none;
  background: transparent;
  outline: none;
  border-bottom: 2px solid transparent; /* only visible on focus/error */
  padding: 0 0 2px;
}

/* underline when editing (optional, can be your blue instead) */
.email:focus {
  border-bottom-color: rgba(29, 114, 216, 0.4);
}

/* red underline / text color when invalid */
.emailInvalid {
  border-bottom-color: rgba(239, 68, 68, 0.9);
  color: #ef4444;
}

/* error message under the input */
.emailErrorText {
  margin-top: 4px;
  font-size: 12px;
  color: #ef4444;
}

.emailValidIcon {
  font-size: 14px;
  color: #3b82f6;
  margin-right: 5px;
}


/* Premium bar */

.premiumCard {
  width: 100%;
  box-sizing: border-box;
  margin-top: 16px;
  margin-bottom: 16px;
  border-radius: 24px;
  padding: 14px 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: var(--color-premium-gradient);
  border: none;
  cursor: pointer;
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
  background: var(--color-settings-bg);
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
  border: 1px solid var(--color-logout-border);
  background: var(--color-premium-gradient);
  box-shadow: 0 18px 40px rgba(15, 33, 70, 0.26);
  font-size: 18px;
  font-weight: 600;
  color: var(--color-heading-card);
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

/* Keep the same logout gradient in dark mode */
:root[data-theme='dark'] .logoutButton {
  background: linear-gradient(
    90deg,
    rgba(43, 124, 175, 0.4) 0%,
    rgba(255, 197, 66, 0.4) 100%
  );
  border-color: #d2c79a; /* optional, but makes sure border doesn’t change */
}

/* Keep the same logout gradient in dark mode */
:root[data-theme='dark'] .premiumCard {
  background: linear-gradient(
    90deg,
    rgba(43, 124, 175, 0.4) 0%,
    rgba(255, 197, 66, 0.4) 100%
  );
  border-color: #d2c79a; /* optional, but makes sure border doesn’t change */
}

.actionRow {
  display: flex;
  gap: 12px;
  margin-top: 18px;
}

.saveButton {
  flex: 1;
  height: 52px;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: var(--color-premium-gradient);
  color: var(--color-heading-strong);
  font-weight: 700;
  cursor: pointer;
}

.loginButton {
  flex: 1;
  height: 52px;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  color: var(--color-heading-strong);
  background: var(--color-premium-gradient);
  font-weight: 700;
}

.toastOverlay {
  position: fixed;
  inset: 0;
  z-index: 9999;

  display: grid;
  place-items: center;


}

.toastCard {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;

  font: inherit;              /* ✅ uses same font as app */
  font-size: 14px;
  font-weight: 700;

  padding: 10px 14px;
  border-radius: 14px;

  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.35);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);

  color: inherit;
}

.toastIcon {
  display: block;
}

.toastText {
  font: inherit;
}

/* Modal overlay */
.guestOverlay {
  position: fixed;
  inset: 0;
  backdrop-filter: blur(8px);
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 9999;
}

.guestModal {
  width: 100%;
  max-width: 420px;
  border-radius: 18px;
  padding: 18px 16px;
  background: var(--color-profile-card-bg);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
}

.guestTitle {
  font-size: 18px;
  font-weight: 800;
  margin-bottom: 8px;
}

.guestText {
  font-size: 14px;
  opacity: 0.9;
  line-height: 1.4;
}

.guestButtons {
  display: flex;
  gap: 10px;
  margin-top: 14px;
}

.guestPrimary {
  flex: 1;
  height: 44px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  background: rgba(59, 130, 246, 0.18);
  border: 1px solid rgba(59, 130, 246, 0.35);
  background: var(--color-premium-gradient);
  font-weight: 700;
}

.guestSecondary {
  flex: 1;
  height: 44px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: transparent;
  color: var(--color-heading-strong);
  font-weight: 700;
}

.lockedClickable {
  cursor: pointer !important;
}

```

### app/stats/page.tsx
```tsx
// app/stats/page.tsx
'use client';

import BottomNav from '../../components/BottomNav';
import styles from './stats.module.css'; // reuse shared layout + new stats classes

export default function StatsPage() {
  return (
    <main className={styles.page}>
      <div className={styles.content}>
        {/* ==== Top Accuracy / Gauge Card ==== */}
        <section className={styles.statsSummaryCard}>
          <div className={styles.statsSummaryInner}>
            <div className={styles.statsGaugeWrapper}>
              <div className={styles.statsGaugeCircleOuter}>
                <div className={styles.statsGaugeCircleInner}>
                  <div className={styles.statsGaugeNumber}>70</div>
                  <div className={styles.statsGaugeLabel}>
                    Accuracy
                    <br />
                    Rate
                  </div>
                </div>
              </div>
            </div>

            <button className={styles.statsTestButton}>Test ▸</button>
          </div>
        </section>

        {/* ==== Stack of statistic cards ==== */}
       {/* ==== Big panel + stack of statistic cards ==== */}
<section className={styles.statsLongPanel}>
  <div className={styles.statsBlocks}>
    {/* Screen Time */}
    <article className={styles.statsCard}>
      <header className={styles.statsCardHeader}>
        <h2 className={styles.statsCardTitle}>Screen Time</h2>
        <div className={styles.statsLegend}>
          <span
            className={`${styles.statsLegendDot} ${styles.statsLegendDotBlue}`}
          />
          <span className={styles.statsLegendLabel}>Global</span>
          <span
            className={`${styles.statsLegendDot} ${styles.statsLegendDotYellow}`}
          />
          <span className={styles.statsLegendLabel}>You</span>
        </div>
      </header>

      <div className={styles.statsGraphArea}>
        <div className={styles.statsGraphPlaceholder}>
          Screen time chart coming soon
        </div>
      </div>
    </article>

    {/* Score */}
    <article className={styles.statsCard}>
      <header className={styles.statsCardHeader}>
        <h2 className={styles.statsCardTitle}>Score</h2>
      </header>

      <div className={styles.statsGraphArea}>
        <div className={styles.statsGraphPlaceholder}>
          Score chart coming soon
        </div>
      </div>
    </article>

    {/* Weekly Progress */}
    <article className={styles.statsCard}>
      <header className={styles.statsCardHeader}>
        <h2 className={styles.statsCardTitle}>Weekly Progress</h2>
        <div className={styles.statsLegend}>
          <span
            className={`${styles.statsLegendDot} ${styles.statsLegendDotBlue}`}
          />
          <span className={styles.statsLegendLabel}>Global</span>
          <span
            className={`${styles.statsLegendDot} ${styles.statsLegendDotYellow}`}
          />
          <span className={styles.statsLegendLabel}>You</span>
        </div>
      </header>

      <div className={styles.statsGraphArea}>
        <div className={styles.statsGraphPlaceholder}>
          Weekly progress chart coming soon
        </div>
      </div>
    </article>

    {/* Best Time */}
    <article className={styles.statsCard}>
      <header className={styles.statsCardHeader}>
        <h2 className={styles.statsCardTitle}>Best Time</h2>
        <div className={styles.statsLegend}>
          <span
            className={`${styles.statsLegendDot} ${styles.statsLegendDotBlue}`}
          />
          <span className={styles.statsLegendLabel}>Global</span>
          <span
            className={`${styles.statsLegendDot} ${styles.statsLegendDotYellow}`}
          />
          <span className={styles.statsLegendLabel}>You</span>
        </div>
      </header>

      <div className={styles.statsGraphArea}>
        <div className={styles.statsGraphPlaceholder}>
          Best time chart coming soon
        </div>
      </div>
    </article>
  </div>
</section>


        {/* Review button at the bottom */}
        <div className={styles.statsReviewWrapper}>
          <button className={styles.statsReviewButton}>
            Review Your Mistakes
          </button>
        </div>

        <BottomNav />
      </div>
    </main>
  );
}

```

### app/stats/stats.module.css
```css
/* app/stats/stats.module.css */

/* Same outer layout as Home page */
.page {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  background: var(--color-page-bg);
}

.content {
  width: 100%;
  max-width: 480px;
  padding: 16px 16px 96px; /* extra bottom space for bottom nav */
  box-sizing: border-box;
  margin: 0 auto;
}

/* Big gradient panel behind Screen Time / Score / Weekly / Best Time */
.statsLongPanel {
  width: 100%;
  max-width: 480px;              /* Figma width */
  margin: 24px auto 0;           /* space under the gauge */
  border-radius: 40px;           /* nice big corners */
  padding: 24px 18px 32px;       /* space for the inner cards */

  /* Figma: Linear, 0% #2B7CAF → 100% #FFC542, 20% opacity */
  background: linear-gradient(
    90deg,
    rgba(43, 124, 175, 0.2) 0%,
    rgba(255, 197, 66, 0.2) 100%
  );

  box-shadow: 0 20px 40px rgba(15, 33, 70, 0.16); /* optional but very Figma */
}

/* Column of cards inside that panel */
.statsLongPanelInner {
  display: flex;
  flex-direction: column;
  gap: 16px;                     /* space between the four cards */
}


/* ================================= */
/* STATS PAGE                        */
/* ================================= */

/* Top accuracy / gauge card */
.statsSummaryCard {
  margin-top: 16px;
  width: 100%;
  border-radius: 32px;
  padding: 24px 24px 28px;
  background:
    radial-gradient(circle at top, rgba(255, 255, 255, 0.9), transparent 60%),
    linear-gradient(180deg, #eaf3ff, #f4f7ff);
  box-shadow: 0 18px 40px rgba(15, 33, 70, 0.16);
}

.statsSummaryInner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}

.statsGaugeWrapper {
  width: 100%;
  display: flex;
  justify-content: center;
}

/* Outer ring (gradient arc) */
.statsGaugeCircleOuter {
  width: 220px;
  height: 220px;
  border-radius: 999px;
  background: conic-gradient(
    from 220deg,
    #70c1ff 0deg,
    #70c1ff 220deg,
    #f7d36b 320deg,
    #e4e4e4 360deg
  );
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Inner circle */
.statsGaugeCircleInner {
  width: 160px;
  height: 160px;
  border-radius: 999px;
  background: #f8fbff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.statsGaugeNumber {
  font-size: 54px;
  font-weight: 700;
  color: #111827;
  line-height: 1;
}

.statsGaugeLabel {
  margin-top: 6px;
  font-size: 16px;
  font-weight: 600;
  color: #4b5563;
  text-align: center;
}

/* “Test” pill button */
.statsTestButton {
  margin-top: 8px;
  width: 122px;              /* Figma width */
  height: 29px;              /* Figma height */

  display: inline-flex;
  align-items: center;
  justify-content: center;

  border-radius: 999px;      /* full pill */
  border: 1px solid var(--color-logout-border);
  /* Same gradient as Premium / Logout */
  background: var(--color-premium-gradient);

  font-size: 14px;
  font-weight: 600;
  color: #000000;            /* matches Figma “Selection color: 000000” */
  cursor: pointer;

  box-shadow: 0 8px 18px rgba(15, 33, 70, 0.2);
}


/* Stack of cards underneath */
.statsBlocks {
  margin-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Generic stats card container */
.statsCard {
  border-radius: 28px;
  padding: 18px 18px 20px;
  background: #f5fbff;
  box-shadow: 0 14px 30px rgba(15, 33, 70, 0.14);
}

.statsCardHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.statsCardTitle {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #222435;
}

/* Legend “Global / You” */
.statsLegend {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #6b7280;
}

.statsLegendDot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
}

.statsLegendDotBlue {
  background: #2b7caf;
}

.statsLegendDotYellow {
  background: #ffc542;
}

.statsLegendLabel {
  white-space: nowrap;
}

/* Graph area placeholder */
.statsGraphArea {
  border-radius: 22px;
  padding: 12px;
  background: linear-gradient(
    180deg,
    rgba(37, 99, 235, 0.05),
    rgba(255, 255, 255, 0.9)
  );
  min-height: 120px;
}

.statsGraphPlaceholder {
  width: 100%;
  height: 100%;
  border-radius: 16px;
  border: 1px dashed rgba(148, 163, 184, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #9ca3af;
}

/* “Review Your Mistakes” button at bottom */
.statsReviewWrapper {
  margin: 24px 0 96px; /* extra bottom room for nav bar */
  display: flex;
  justify-content: center;
}

.statsReviewButton {
  width: 100%;
  max-width: 360px;
  padding: 14px 20px;
  border-radius: 22px;
  border: 1px solid var(--color-logout-border);
  background: var(--color-premium-gradient);
  box-shadow: 0 18px 40px rgba(15, 33, 70, 0.22);
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  cursor: pointer;
}

@media (min-width: 768px) {
  .statsSummaryCard {
    margin-top: 24px;
  }
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

/* Top summary / gauge card */
:root[data-theme='dark'] .statsSummaryCard {
  background:
    linear-gradient(
      135deg,
      rgba(43, 124, 175, 0.35) 0%,
      rgba(255, 197, 66, 0.35) 100%
    ),
    #111827;
  color: #f9fafb;
}

/* Gauge inner + text */
:root[data-theme='dark'] .statsGaugeCircleInner {
  background: #0b1020;
}

:root[data-theme='dark'] .statsGaugeNumber {
  color: #f9fafb;
}

:root[data-theme='dark'] .statsGaugeLabel {
  color: #9ca3af;
}

/* Big panel behind the stack of cards */
:root[data-theme='dark'] .statsLongPanel {
  background:
    linear-gradient(
      90deg,
      rgba(43, 124, 175, 0.35) 0%,
      rgba(255, 197, 66, 0.25) 100%
    ),
    #0b1020;
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.55);
}

/* Individual stat cards */
:root[data-theme='dark'] .statsCard {
  background: #111827;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.55);
  color: #f9fafb;
}

:root[data-theme='dark'] .statsCardTitle {
  color: #f9fafb;
}

:root[data-theme='dark'] .statsLegend {
  color: #9ca3af;
}

/* Graph area placeholder */
:root[data-theme='dark'] .statsGraphArea {
  background: linear-gradient(
    180deg,
    rgba(43, 124, 175, 0.18),
    rgba(2, 6, 23, 0.92)
  );
}

:root[data-theme='dark'] .statsGraphPlaceholder {
  border: 1px dashed rgba(148, 163, 184, 0.35);
  color: #9ca3af;
}

/* Buttons (avoid relying on light-theme-only CSS vars) */
:root[data-theme='dark'] .statsTestButton,
:root[data-theme='dark'] .statsReviewButton {
  background: linear-gradient(
    90deg,
    rgba(43, 124, 175, 0.4) 0%,
    rgba(255, 197, 66, 0.4) 100%
  );
  border-color: #d2c79a;
  color: #f9fafb;
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

### components/UserProfile.tsx
```tsx
'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

type UserProfileContextValue = {
  name: string;
  email: string;
  avatarUrl: string | null;
  setName: (name: string) => void;
  setEmail: (email: string) => void;
  setAvatarUrl: (url: string | null) => void;
  saveProfile: () => void;
  clearProfile: () => void;
};

const UserProfileContext = createContext<UserProfileContextValue | undefined>(
  undefined
);

const STORAGE_KEY = 'expatise-user-profile';

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const [name, setName] = useState('@Expatise');
  const [email, setEmail] = useState('user@expatise.com');
  const [avatarUrl, setAvatarUrlState] = useState<string | null>(null);

  // load from localStorage on first client render
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as {
        name?: string;
        email?: string;
        avatarUrl?: string | null;
      };

      if (parsed.name) setName(parsed.name);
      if (parsed.email) setEmail(parsed.email);
      if ('avatarUrl' in parsed) setAvatarUrlState(parsed.avatarUrl ?? null);
    } catch {
      // ignore bad JSON
    }
  }, []);



  const setAvatarUrl = (url: string | null) => {
    setAvatarUrlState(url);
  };

  const saveProfile = () => {
    if (typeof window === 'undefined') return;
    const payload = JSON.stringify({ name, email, avatarUrl });
    window.localStorage.setItem(STORAGE_KEY, payload);
  };

  const clearProfile = () => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(STORAGE_KEY);
    setName('@Expatise');
    setEmail('user@expatise.com');
    setAvatarUrlState(null);
  };


  const value: UserProfileContextValue = {
    name,
    email,
    avatarUrl,
    setName,
    setEmail,
    setAvatarUrl,
    saveProfile,
    clearProfile
  };

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  const ctx = useContext(UserProfileContext);
  if (!ctx) {
    throw new Error('useUserProfile must be used inside <UserProfileProvider>');
  }
  return ctx;
}

```

### components/useAuthStatus.ts
```tsx
// components/useAuthStatus.ts
"use client";

import { useCallback, useEffect, useState } from "react";

export function useAuthStatus() {
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/session", { cache: "no-store" });
      const data = await res.json().catch(() => ({ authed: false }));
      setAuthed(Boolean(data.authed));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { authed, loading, refresh };
}

```

### lib/auth.ts
```tsx
// lib/auth.ts
export const AUTH_COOKIE = "expatise_auth";

// One regex everywhere (client + server)
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(input: string) {
  return String(input || "").trim().toLowerCase();
}

export function isValidEmail(input: string) {
  return EMAIL_REGEX.test(String(input || "").trim());
}

// Prevent open-redirects
export function safeNextPath(next: string | null, fallback = "/") {
  if (!next) return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//")) return fallback;
  return next;
}

```

### lib/middleware/auth.ts
```tsx
// lib/middleware/auth.ts
import type { NextRequest } from "next/server";

// No hard redirects. Guest UX is handled in the UI (modal/blur overlays).
export function authMiddleware(_req: NextRequest) {
  return null;
}

export function applyAuthGate(req: NextRequest) {
  return authMiddleware(req);
}

```

### lib/middleware/onboarding.ts
```tsx
// lib/middleware/onboarding.ts
import { NextResponse, type NextRequest } from 'next/server';
import { PATHS, ONBOARDING_COOKIE } from './paths';

export function onboardingMiddleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow onboarding page itself
  if (pathname.startsWith(PATHS.ONBOARDING)) return null;

  // If cookie exists, user already completed onboarding
  const onboarded = req.cookies.get(ONBOARDING_COOKIE)?.value === '1';
  if (onboarded) return null;

  // Otherwise redirect all normal pages to onboarding
  const url = req.nextUrl.clone();
  url.pathname = PATHS.ONBOARDING;
  return NextResponse.redirect(url);
}
export function applyOnboardingGate(req: NextRequest) {
  return onboardingMiddleware(req);
}
```

### lib/middleware/paths.ts
```tsx
// lib/middleware/paths.ts
export const PATHS = {
  ONBOARDING: '/onboarding',
  LOGIN: '/login',
  HOME: '/',
} as const;

export const ONBOARDING_COOKIE = 'expatise_onboarded';
export function isBypassPath(pathname: string) {
  // Bypass static files, images, api routes, and favicon
  if (
    pathname.startsWith('/_next/static') ||
    pathname.startsWith('/_next/image') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/images')
  ) {
    return true;
  }
  return false;
}
```

### lib/password-reset-store.ts
```tsx
import crypto from "crypto";

type ResetRecord = {
  email: string;
  codeHash: string;
  expiresAt: number;
  attemptsLeft: number;
};

const resets = new Map<string, ResetRecord>();

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

function secret() {
  // use your existing AUTH_SECRET if set; in production you should set it
  return process.env.AUTH_SECRET || "dev-reset-secret";
}

function hashCode(email: string, code: string) {
  return crypto
    .createHash("sha256")
    .update(`${email.toLowerCase()}:${code}:${secret()}`)
    .digest("hex");
}

export function createOtp(email: string) {
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  const rec: ResetRecord = {
    email: email.toLowerCase(),
    codeHash: hashCode(email, code),
    expiresAt: Date.now() + OTP_TTL_MS,
    attemptsLeft: MAX_ATTEMPTS,
  };
  resets.set(email.toLowerCase(), rec);
  return { code, expiresAt: rec.expiresAt };
}

export function verifyOtp(email: string, code: string) {
  const key = email.toLowerCase();
  const rec = resets.get(key);
  if (!rec) return { ok: false as const, reason: "missing" as const };
  if (Date.now() > rec.expiresAt) {
    resets.delete(key);
    return { ok: false as const, reason: "expired" as const };
  }

  if (rec.attemptsLeft <= 0) {
    resets.delete(key);
    return { ok: false as const, reason: "locked" as const };
  }

  const incoming = hashCode(email, code);
  if (incoming !== rec.codeHash) {
    rec.attemptsLeft -= 1;
    resets.set(key, rec);
    return { ok: false as const, reason: "invalid" as const, attemptsLeft: rec.attemptsLeft };
  }

  return { ok: true as const };
}

export function consumeOtp(email: string) {
  resets.delete(email.toLowerCase());
}

```

### lib/user-store.ts
```tsx
import crypto from "crypto";

/**
 * DEV ONLY:
 * - This is an in-memory store (resets when server restarts)
 * - Replace with a real DB later (Postgres/Prisma/etc.)
 */

type UserRecord = {
  email: string;
  passwordHash: string; // "salt:hash"
};

const users = new Map<string, UserRecord>();

function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function userExists(email: string) {
  return users.has(email.toLowerCase());
}

export function setUserPassword(email: string, newPassword: string) {
  const key = email.toLowerCase();
  const u = users.get(key);
  if (!u) return false;
  users.set(key, { ...u, passwordHash: hashPassword(newPassword) });
  return true;
}

export function createUser(email: string, password: string) {
  const key = email.trim().toLowerCase();
  if (!key) return { ok: false, message: "Email is required." };
  if (users.has(key)) return { ok: false, message: "This email is already registered." };

  users.set(key, { email: key, passwordHash: hashPassword(password) });
  return { ok: true };
}


export function checkUserPassword(email: string, password: string) {
  const key = email.trim().toLowerCase();
  const u = users.get(key);
  if (!u) return false;

  const [salt, storedHash] = u.passwordHash.split(":");
  if (!salt || !storedHash) return false;

  const incomingHash = crypto.scryptSync(password, salt, 64).toString("hex");

  // constant-time compare
  const a = Buffer.from(storedHash, "hex");
  const b = Buffer.from(incomingHash, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Seed a demo user so you can test reset immediately
(function seed() {
  const email = "user@expatise.com";
  if (!users.has(email)) {
    users.set(email, { email, passwordHash: hashPassword("password123") });
  }
})();

```

### next.config.ts
```tsx
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;

```

### package-lock.json
```json
{
  "name": "expatise",
  "version": "0.1.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "expatise",
      "version": "0.1.0",
      "dependencies": {
        "@fortawesome/fontawesome-svg-core": "^7.1.0",
        "@fortawesome/free-brands-svg-icons": "^7.1.0",
        "@fortawesome/free-solid-svg-icons": "^7.1.0",
        "@fortawesome/react-fontawesome": "^3.1.1",
        "next": "^16.0.8",
        "next-auth": "^5.0.0-beta.30",
        "react": "19.2.0",
        "react-dom": "19.2.0"
      },
      "devDependencies": {
        "@tailwindcss/postcss": "^4",
        "@types/node": "^20",
        "@types/react": "^19",
        "@types/react-dom": "^19",
        "baseline-browser-mapping": "^2.9.5",
        "eslint": "^9",
        "eslint-config-next": "16.0.3",
        "tailwindcss": "^4",
        "typescript": "^5"
      }
    },
    "node_modules/@alloc/quick-lru": {
      "version": "5.2.0",
      "resolved": "https://registry.npmjs.org/@alloc/quick-lru/-/quick-lru-5.2.0.tgz",
      "integrity": "sha512-UrcABB+4bUrFABwbluTIBErXwvbsU/V7TZWfmbgJfbkwiBuziS9gxdODUyuiecfdGQ85jglMW6juS3+z5TsKLw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/@auth/core": {
      "version": "0.41.0",
      "resolved": "https://registry.npmjs.org/@auth/core/-/core-0.41.0.tgz",
      "integrity": "sha512-Wd7mHPQ/8zy6Qj7f4T46vg3aoor8fskJm6g2Zyj064oQ3+p0xNZXAV60ww0hY+MbTesfu29kK14Zk5d5JTazXQ==",
      "license": "ISC",
      "dependencies": {
        "@panva/hkdf": "^1.2.1",
        "jose": "^6.0.6",
        "oauth4webapi": "^3.3.0",
        "preact": "10.24.3",
        "preact-render-to-string": "6.5.11"
      },
      "peerDependencies": {
        "@simplewebauthn/browser": "^9.0.1",
        "@simplewebauthn/server": "^9.0.2",
        "nodemailer": "^6.8.0"
      },
      "peerDependenciesMeta": {
        "@simplewebauthn/browser": {
          "optional": true
        },
        "@simplewebauthn/server": {
          "optional": true
        },
        "nodemailer": {
          "optional": true
        }
      }
    },
    "node_modules/@babel/code-frame": {
      "version": "7.27.1",
      "resolved": "https://registry.npmjs.org/@babel/code-frame/-/code-frame-7.27.1.tgz",
      "integrity": "sha512-cjQ7ZlQ0Mv3b47hABuTevyTuYN4i+loJKGeV9flcCgIK37cCXRh+L1bd3iBHlynerhQ7BhCkn2BPbQUL+rGqFg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-validator-identifier": "^7.27.1",
        "js-tokens": "^4.0.0",
        "picocolors": "^1.1.1"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/compat-data": {
      "version": "7.28.5",
      "resolved": "https://registry.npmjs.org/@babel/compat-data/-/compat-data-7.28.5.tgz",
      "integrity": "sha512-6uFXyCayocRbqhZOB+6XcuZbkMNimwfVGFji8CTZnCzOHVGvDqzvitu1re2AU5LROliz7eQPhB8CpAMvnx9EjA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/core": {
      "version": "7.28.5",
      "resolved": "https://registry.npmjs.org/@babel/core/-/core-7.28.5.tgz",
      "integrity": "sha512-e7jT4DxYvIDLk1ZHmU/m/mB19rex9sv0c2ftBtjSBv+kVM/902eh0fINUzD7UwLLNR+jU585GxUJ8/EBfAM5fw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/code-frame": "^7.27.1",
        "@babel/generator": "^7.28.5",
        "@babel/helper-compilation-targets": "^7.27.2",
        "@babel/helper-module-transforms": "^7.28.3",
        "@babel/helpers": "^7.28.4",
        "@babel/parser": "^7.28.5",
        "@babel/template": "^7.27.2",
        "@babel/traverse": "^7.28.5",
        "@babel/types": "^7.28.5",
        "@jridgewell/remapping": "^2.3.5",
        "convert-source-map": "^2.0.0",
        "debug": "^4.1.0",
        "gensync": "^1.0.0-beta.2",
        "json5": "^2.2.3",
        "semver": "^6.3.1"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/babel"
      }
    },
    "node_modules/@babel/generator": {
      "version": "7.28.5",
      "resolved": "https://registry.npmjs.org/@babel/generator/-/generator-7.28.5.tgz",
      "integrity": "sha512-3EwLFhZ38J4VyIP6WNtt2kUdW9dokXA9Cr4IVIFHuCpZ3H8/YFOl5JjZHisrn1fATPBmKKqXzDFvh9fUwHz6CQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/parser": "^7.28.5",
        "@babel/types": "^7.28.5",
        "@jridgewell/gen-mapping": "^0.3.12",
        "@jridgewell/trace-mapping": "^0.3.28",
        "jsesc": "^3.0.2"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helper-compilation-targets": {
      "version": "7.27.2",
      "resolved": "https://registry.npmjs.org/@babel/helper-compilation-targets/-/helper-compilation-targets-7.27.2.tgz",
      "integrity": "sha512-2+1thGUUWWjLTYTHZWK1n8Yga0ijBz1XAhUXcKy81rd5g6yh7hGqMp45v7cadSbEHc9G3OTv45SyneRN3ps4DQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/compat-data": "^7.27.2",
        "@babel/helper-validator-option": "^7.27.1",
        "browserslist": "^4.24.0",
        "lru-cache": "^5.1.1",
        "semver": "^6.3.1"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helper-globals": {
      "version": "7.28.0",
      "resolved": "https://registry.npmjs.org/@babel/helper-globals/-/helper-globals-7.28.0.tgz",
      "integrity": "sha512-+W6cISkXFa1jXsDEdYA8HeevQT/FULhxzR99pxphltZcVaugps53THCeiWA8SguxxpSp3gKPiuYfSWopkLQ4hw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helper-module-imports": {
      "version": "7.27.1",
      "resolved": "https://registry.npmjs.org/@babel/helper-module-imports/-/helper-module-imports-7.27.1.tgz",
      "integrity": "sha512-0gSFWUPNXNopqtIPQvlD5WgXYI5GY2kP2cCvoT8kczjbfcfuIljTbcWrulD1CIPIX2gt1wghbDy08yE1p+/r3w==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/traverse": "^7.27.1",
        "@babel/types": "^7.27.1"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helper-module-transforms": {
      "version": "7.28.3",
      "resolved": "https://registry.npmjs.org/@babel/helper-module-transforms/-/helper-module-transforms-7.28.3.tgz",
      "integrity": "sha512-gytXUbs8k2sXS9PnQptz5o0QnpLL51SwASIORY6XaBKF88nsOT0Zw9szLqlSGQDP/4TljBAD5y98p2U1fqkdsw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-module-imports": "^7.27.1",
        "@babel/helper-validator-identifier": "^7.27.1",
        "@babel/traverse": "^7.28.3"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0"
      }
    },
    "node_modules/@babel/helper-string-parser": {
      "version": "7.27.1",
      "resolved": "https://registry.npmjs.org/@babel/helper-string-parser/-/helper-string-parser-7.27.1.tgz",
      "integrity": "sha512-qMlSxKbpRlAridDExk92nSobyDdpPijUq2DW6oDnUqd0iOGxmQjyqhMIihI9+zv4LPyZdRje2cavWPbCbWm3eA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helper-validator-identifier": {
      "version": "7.28.5",
      "resolved": "https://registry.npmjs.org/@babel/helper-validator-identifier/-/helper-validator-identifier-7.28.5.tgz",
      "integrity": "sha512-qSs4ifwzKJSV39ucNjsvc6WVHs6b7S03sOh2OcHF9UHfVPqWWALUsNUVzhSBiItjRZoLHx7nIarVjqKVusUZ1Q==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helper-validator-option": {
      "version": "7.27.1",
      "resolved": "https://registry.npmjs.org/@babel/helper-validator-option/-/helper-validator-option-7.27.1.tgz",
      "integrity": "sha512-YvjJow9FxbhFFKDSuFnVCe2WxXk1zWc22fFePVNEaWJEu8IrZVlda6N0uHwzZrUM1il7NC9Mlp4MaJYbYd9JSg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helpers": {
      "version": "7.28.4",
      "resolved": "https://registry.npmjs.org/@babel/helpers/-/helpers-7.28.4.tgz",
      "integrity": "sha512-HFN59MmQXGHVyYadKLVumYsA9dBFun/ldYxipEjzA4196jpLZd8UjEEBLkbEkvfYreDqJhZxYAWFPtrfhNpj4w==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/template": "^7.27.2",
        "@babel/types": "^7.28.4"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/parser": {
      "version": "7.28.5",
      "resolved": "https://registry.npmjs.org/@babel/parser/-/parser-7.28.5.tgz",
      "integrity": "sha512-KKBU1VGYR7ORr3At5HAtUQ+TV3SzRCXmA/8OdDZiLDBIZxVyzXuztPjfLd3BV1PRAQGCMWWSHYhL0F8d5uHBDQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/types": "^7.28.5"
      },
      "bin": {
        "parser": "bin/babel-parser.js"
      },
      "engines": {
        "node": ">=6.0.0"
      }
    },
    "node_modules/@babel/template": {
      "version": "7.27.2",
      "resolved": "https://registry.npmjs.org/@babel/template/-/template-7.27.2.tgz",
      "integrity": "sha512-LPDZ85aEJyYSd18/DkjNh4/y1ntkE5KwUHWTiqgRxruuZL2F1yuHligVHLvcHY2vMHXttKFpJn6LwfI7cw7ODw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/code-frame": "^7.27.1",
        "@babel/parser": "^7.27.2",
        "@babel/types": "^7.27.1"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/traverse": {
      "version": "7.28.5",
      "resolved": "https://registry.npmjs.org/@babel/traverse/-/traverse-7.28.5.tgz",
      "integrity": "sha512-TCCj4t55U90khlYkVV/0TfkJkAkUg3jZFA3Neb7unZT8CPok7iiRfaX0F+WnqWqt7OxhOn0uBKXCw4lbL8W0aQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/code-frame": "^7.27.1",
        "@babel/generator": "^7.28.5",
        "@babel/helper-globals": "^7.28.0",
        "@babel/parser": "^7.28.5",
        "@babel/template": "^7.27.2",
        "@babel/types": "^7.28.5",
        "debug": "^4.3.1"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/types": {
      "version": "7.28.5",
      "resolved": "https://registry.npmjs.org/@babel/types/-/types-7.28.5.tgz",
      "integrity": "sha512-qQ5m48eI/MFLQ5PxQj4PFaprjyCTLI37ElWMmNs0K8Lk3dVeOdNpB3ks8jc7yM5CDmVC73eMVk/trk3fgmrUpA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-string-parser": "^7.27.1",
        "@babel/helper-validator-identifier": "^7.28.5"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@emnapi/core": {
      "version": "1.7.1",
      "resolved": "https://registry.npmjs.org/@emnapi/core/-/core-1.7.1.tgz",
      "integrity": "sha512-o1uhUASyo921r2XtHYOHy7gdkGLge8ghBEQHMWmyJFoXlpU58kIrhhN3w26lpQb6dspetweapMn2CSNwQ8I4wg==",
      "dev": true,
      "license": "MIT",
      "optional": true,
      "dependencies": {
        "@emnapi/wasi-threads": "1.1.0",
        "tslib": "^2.4.0"
      }
    },
    "node_modules/@emnapi/runtime": {
      "version": "1.7.1",
      "resolved": "https://registry.npmjs.org/@emnapi/runtime/-/runtime-1.7.1.tgz",
      "integrity": "sha512-PVtJr5CmLwYAU9PZDMITZoR5iAOShYREoR45EyyLrbntV50mdePTgUn4AmOw90Ifcj+x2kRjdzr1HP3RrNiHGA==",
      "license": "MIT",
      "optional": true,
      "dependencies": {
        "tslib": "^2.4.0"
      }
    },
    "node_modules/@emnapi/wasi-threads": {
      "version": "1.1.0",
      "resolved": "https://registry.npmjs.org/@emnapi/wasi-threads/-/wasi-threads-1.1.0.tgz",
      "integrity": "sha512-WI0DdZ8xFSbgMjR1sFsKABJ/C5OnRrjT06JXbZKexJGrDuPTzZdDYfFlsgcCXCyf+suG5QU2e/y1Wo2V/OapLQ==",
      "dev": true,
      "license": "MIT",
      "optional": true,
      "dependencies": {
        "tslib": "^2.4.0"
      }
    },
    "node_modules/@eslint-community/eslint-utils": {
      "version": "4.9.0",
      "resolved": "https://registry.npmjs.org/@eslint-community/eslint-utils/-/eslint-utils-4.9.0.tgz",
      "integrity": "sha512-ayVFHdtZ+hsq1t2Dy24wCmGXGe4q9Gu3smhLYALJrr473ZH27MsnSL+LKUlimp4BWJqMDMLmPpx/Q9R3OAlL4g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "eslint-visitor-keys": "^3.4.3"
      },
      "engines": {
        "node": "^12.22.0 || ^14.17.0 || >=16.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/eslint"
      },
      "peerDependencies": {
        "eslint": "^6.0.0 || ^7.0.0 || >=8.0.0"
      }
    },
    "node_modules/@eslint-community/eslint-utils/node_modules/eslint-visitor-keys": {
      "version": "3.4.3",
      "resolved": "https://registry.npmjs.org/eslint-visitor-keys/-/eslint-visitor-keys-3.4.3.tgz",
      "integrity": "sha512-wpc+LXeiyiisxPlEkUzU6svyS1frIO3Mgxj1fdy7Pm8Ygzguax2N3Fa/D/ag1WqbOprdI+uY6wMUl8/a2G+iag==",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": "^12.22.0 || ^14.17.0 || >=16.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/eslint"
      }
    },
    "node_modules/@eslint-community/regexpp": {
      "version": "4.12.2",
      "resolved": "https://registry.npmjs.org/@eslint-community/regexpp/-/regexpp-4.12.2.tgz",
      "integrity": "sha512-EriSTlt5OC9/7SXkRSCAhfSxxoSUgBm33OH+IkwbdpgoqsSsUg7y3uh+IICI/Qg4BBWr3U2i39RpmycbxMq4ew==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": "^12.0.0 || ^14.0.0 || >=16.0.0"
      }
    },
    "node_modules/@eslint/config-array": {
      "version": "0.21.1",
      "resolved": "https://registry.npmjs.org/@eslint/config-array/-/config-array-0.21.1.tgz",
      "integrity": "sha512-aw1gNayWpdI/jSYVgzN5pL0cfzU02GT3NBpeT/DXbx1/1x7ZKxFPd9bwrzygx/qiwIQiJ1sw/zD8qY/kRvlGHA==",
      "dev": true,
      "license": "Apache-2.0",
      "dependencies": {
        "@eslint/object-schema": "^2.1.7",
        "debug": "^4.3.1",
        "minimatch": "^3.1.2"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      }
    },
    "node_modules/@eslint/config-helpers": {
      "version": "0.4.2",
      "resolved": "https://registry.npmjs.org/@eslint/config-helpers/-/config-helpers-0.4.2.tgz",
      "integrity": "sha512-gBrxN88gOIf3R7ja5K9slwNayVcZgK6SOUORm2uBzTeIEfeVaIhOpCtTox3P6R7o2jLFwLFTLnC7kU/RGcYEgw==",
      "dev": true,
      "license": "Apache-2.0",
      "dependencies": {
        "@eslint/core": "^0.17.0"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      }
    },
    "node_modules/@eslint/core": {
      "version": "0.17.0",
      "resolved": "https://registry.npmjs.org/@eslint/core/-/core-0.17.0.tgz",
      "integrity": "sha512-yL/sLrpmtDaFEiUj1osRP4TI2MDz1AddJL+jZ7KSqvBuliN4xqYY54IfdN8qD8Toa6g1iloph1fxQNkjOxrrpQ==",
      "dev": true,
      "license": "Apache-2.0",
      "dependencies": {
        "@types/json-schema": "^7.0.15"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      }
    },
    "node_modules/@eslint/eslintrc": {
      "version": "3.3.1",
      "resolved": "https://registry.npmjs.org/@eslint/eslintrc/-/eslintrc-3.3.1.tgz",
      "integrity": "sha512-gtF186CXhIl1p4pJNGZw8Yc6RlshoePRvE0X91oPGb3vZ8pM3qOS9W9NGPat9LziaBV7XrJWGylNQXkGcnM3IQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "ajv": "^6.12.4",
        "debug": "^4.3.2",
        "espree": "^10.0.1",
        "globals": "^14.0.0",
        "ignore": "^5.2.0",
        "import-fresh": "^3.2.1",
        "js-yaml": "^4.1.0",
        "minimatch": "^3.1.2",
        "strip-json-comments": "^3.1.1"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "url": "https://opencollective.com/eslint"
      }
    },
    "node_modules/@eslint/js": {
      "version": "9.39.1",
      "resolved": "https://registry.npmjs.org/@eslint/js/-/js-9.39.1.tgz",
      "integrity": "sha512-S26Stp4zCy88tH94QbBv3XCuzRQiZ9yXofEILmglYTh/Ug/a9/umqvgFtYBAo3Lp0nsI/5/qH1CCrbdK3AP1Tw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "url": "https://eslint.org/donate"
      }
    },
    "node_modules/@eslint/object-schema": {
      "version": "2.1.7",
      "resolved": "https://registry.npmjs.org/@eslint/object-schema/-/object-schema-2.1.7.tgz",
      "integrity": "sha512-VtAOaymWVfZcmZbp6E2mympDIHvyjXs/12LqWYjVw6qjrfF+VK+fyG33kChz3nnK+SU5/NeHOqrTEHS8sXO3OA==",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      }
    },
    "node_modules/@eslint/plugin-kit": {
      "version": "0.4.1",
      "resolved": "https://registry.npmjs.org/@eslint/plugin-kit/-/plugin-kit-0.4.1.tgz",
      "integrity": "sha512-43/qtrDUokr7LJqoF2c3+RInu/t4zfrpYdoSDfYyhg52rwLV6TnOvdG4fXm7IkSB3wErkcmJS9iEhjVtOSEjjA==",
      "dev": true,
      "license": "Apache-2.0",
      "dependencies": {
        "@eslint/core": "^0.17.0",
        "levn": "^0.4.1"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      }
    },
    "node_modules/@fortawesome/fontawesome-common-types": {
      "version": "7.1.0",
      "resolved": "https://registry.npmjs.org/@fortawesome/fontawesome-common-types/-/fontawesome-common-types-7.1.0.tgz",
      "integrity": "sha512-l/BQM7fYntsCI//du+6sEnHOP6a74UixFyOYUyz2DLMXKx+6DEhfR3F2NYGE45XH1JJuIamacb4IZs9S0ZOWLA==",
      "license": "MIT",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/@fortawesome/fontawesome-svg-core": {
      "version": "7.1.0",
      "resolved": "https://registry.npmjs.org/@fortawesome/fontawesome-svg-core/-/fontawesome-svg-core-7.1.0.tgz",
      "integrity": "sha512-fNxRUk1KhjSbnbuBxlWSnBLKLBNun52ZBTcs22H/xEEzM6Ap81ZFTQ4bZBxVQGQgVY0xugKGoRcCbaKjLQ3XZA==",
      "license": "MIT",
      "dependencies": {
        "@fortawesome/fontawesome-common-types": "7.1.0"
      },
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/@fortawesome/free-brands-svg-icons": {
      "version": "7.1.0",
      "resolved": "https://registry.npmjs.org/@fortawesome/free-brands-svg-icons/-/free-brands-svg-icons-7.1.0.tgz",
      "integrity": "sha512-9byUd9bgNfthsZAjBl6GxOu1VPHgBuRUP9juI7ZoM98h8xNPTCTagfwUFyYscdZq4Hr7gD1azMfM9s5tIWKZZA==",
      "license": "(CC-BY-4.0 AND MIT)",
      "dependencies": {
        "@fortawesome/fontawesome-common-types": "7.1.0"
      },
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/@fortawesome/free-solid-svg-icons": {
      "version": "7.1.0",
      "resolved": "https://registry.npmjs.org/@fortawesome/free-solid-svg-icons/-/free-solid-svg-icons-7.1.0.tgz",
      "integrity": "sha512-Udu3K7SzAo9N013qt7qmm22/wo2hADdheXtBfxFTecp+ogsc0caQNRKEb7pkvvagUGOpG9wJC1ViH6WXs8oXIA==",
      "license": "(CC-BY-4.0 AND MIT)",
      "dependencies": {
        "@fortawesome/fontawesome-common-types": "7.1.0"
      },
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/@fortawesome/react-fontawesome": {
      "version": "3.1.1",
      "resolved": "https://registry.npmjs.org/@fortawesome/react-fontawesome/-/react-fontawesome-3.1.1.tgz",
      "integrity": "sha512-EDllr9hpodc21odmUywHS1alXNiCd4E8sp5GJ5s7wYINz8vSmMiNWpALTiuYODb865YyQ/NlyiN4mbXp7HCNqg==",
      "license": "MIT",
      "engines": {
        "node": ">=20"
      },
      "peerDependencies": {
        "@fortawesome/fontawesome-svg-core": "~6 || ~7",
        "react": "^18.0.0 || ^19.0.0"
      }
    },
    "node_modules/@humanfs/core": {
      "version": "0.19.1",
      "resolved": "https://registry.npmjs.org/@humanfs/core/-/core-0.19.1.tgz",
      "integrity": "sha512-5DyQ4+1JEUzejeK1JGICcideyfUbGixgS9jNgex5nqkW+cY7WZhxBigmieN5Qnw9ZosSNVC9KQKyb+GUaGyKUA==",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": ">=18.18.0"
      }
    },
    "node_modules/@humanfs/node": {
      "version": "0.16.7",
      "resolved": "https://registry.npmjs.org/@humanfs/node/-/node-0.16.7.tgz",
      "integrity": "sha512-/zUx+yOsIrG4Y43Eh2peDeKCxlRt/gET6aHfaKpuq267qXdYDFViVHfMaLyygZOnl0kGWxFIgsBy8QFuTLUXEQ==",
      "dev": true,
      "license": "Apache-2.0",
      "dependencies": {
        "@humanfs/core": "^0.19.1",
        "@humanwhocodes/retry": "^0.4.0"
      },
      "engines": {
        "node": ">=18.18.0"
      }
    },
    "node_modules/@humanwhocodes/module-importer": {
      "version": "1.0.1",
      "resolved": "https://registry.npmjs.org/@humanwhocodes/module-importer/-/module-importer-1.0.1.tgz",
      "integrity": "sha512-bxveV4V8v5Yb4ncFTT3rPSgZBOpCkjfK0y4oVVVJwIuDVBRMDXrPyXRL988i5ap9m9bnyEEjWfm5WkBmtffLfA==",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": ">=12.22"
      },
      "funding": {
        "type": "github",
        "url": "https://github.com/sponsors/nzakas"
      }
    },
    "node_modules/@humanwhocodes/retry": {
      "version": "0.4.3",
      "resolved": "https://registry.npmjs.org/@humanwhocodes/retry/-/retry-0.4.3.tgz",
      "integrity": "sha512-bV0Tgo9K4hfPCek+aMAn81RppFKv2ySDQeMoSZuvTASywNTnVJCArCZE2FWqpvIatKu7VMRLWlR1EazvVhDyhQ==",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": ">=18.18"
      },
      "funding": {
        "type": "github",
        "url": "https://github.com/sponsors/nzakas"
      }
    },
    "node_modules/@img/colour": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/@img/colour/-/colour-1.0.0.tgz",
      "integrity": "sha512-A5P/LfWGFSl6nsckYtjw9da+19jB8hkJ6ACTGcDfEJ0aE+l2n2El7dsVM7UVHZQ9s2lmYMWlrS21YLy2IR1LUw==",
      "license": "MIT",
      "optional": true,
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@img/sharp-darwin-arm64": {
      "version": "0.34.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-darwin-arm64/-/sharp-darwin-arm64-0.34.5.tgz",
      "integrity": "sha512-imtQ3WMJXbMY4fxb/Ndp6HBTNVtWCUI0WdobyheGf5+ad6xX8VIDO8u2xE4qc/fr08CKG/7dDseFtn6M6g/r3w==",
      "cpu": [
        "arm64"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": "^18.17.0 || ^20.3.0 || >=21.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-darwin-arm64": "1.2.4"
      }
    },
    "node_modules/@img/sharp-darwin-x64": {
      "version": "0.34.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-darwin-x64/-/sharp-darwin-x64-0.34.5.tgz",
      "integrity": "sha512-YNEFAF/4KQ/PeW0N+r+aVVsoIY0/qxxikF2SWdp+NRkmMB7y9LBZAVqQ4yhGCm/H3H270OSykqmQMKLBhBJDEw==",
      "cpu": [
        "x64"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": "^18.17.0 || ^20.3.0 || >=21.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-darwin-x64": "1.2.4"
      }
    },
    "node_modules/@img/sharp-libvips-darwin-arm64": {
      "version": "1.2.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-darwin-arm64/-/sharp-libvips-darwin-arm64-1.2.4.tgz",
      "integrity": "sha512-zqjjo7RatFfFoP0MkQ51jfuFZBnVE2pRiaydKJ1G/rHZvnsrHAOcQALIi9sA5co5xenQdTugCvtb1cuf78Vf4g==",
      "cpu": [
        "arm64"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "darwin"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-darwin-x64": {
      "version": "1.2.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-darwin-x64/-/sharp-libvips-darwin-x64-1.2.4.tgz",
      "integrity": "sha512-1IOd5xfVhlGwX+zXv2N93k0yMONvUlANylbJw1eTah8K/Jtpi15KC+WSiaX/nBmbm2HxRM1gZ0nSdjSsrZbGKg==",
      "cpu": [
        "x64"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "darwin"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-linux-arm": {
      "version": "1.2.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linux-arm/-/sharp-libvips-linux-arm-1.2.4.tgz",
      "integrity": "sha512-bFI7xcKFELdiNCVov8e44Ia4u2byA+l3XtsAj+Q8tfCwO6BQ8iDojYdvoPMqsKDkuoOo+X6HZA0s0q11ANMQ8A==",
      "cpu": [
        "arm"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "linux"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-linux-arm64": {
      "version": "1.2.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linux-arm64/-/sharp-libvips-linux-arm64-1.2.4.tgz",
      "integrity": "sha512-excjX8DfsIcJ10x1Kzr4RcWe1edC9PquDRRPx3YVCvQv+U5p7Yin2s32ftzikXojb1PIFc/9Mt28/y+iRklkrw==",
      "cpu": [
        "arm64"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "linux"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-linux-ppc64": {
      "version": "1.2.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linux-ppc64/-/sharp-libvips-linux-ppc64-1.2.4.tgz",
      "integrity": "sha512-FMuvGijLDYG6lW+b/UvyilUWu5Ayu+3r2d1S8notiGCIyYU/76eig1UfMmkZ7vwgOrzKzlQbFSuQfgm7GYUPpA==",
      "cpu": [
        "ppc64"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "linux"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-linux-riscv64": {
      "version": "1.2.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linux-riscv64/-/sharp-libvips-linux-riscv64-1.2.4.tgz",
      "integrity": "sha512-oVDbcR4zUC0ce82teubSm+x6ETixtKZBh/qbREIOcI3cULzDyb18Sr/Wcyx7NRQeQzOiHTNbZFF1UwPS2scyGA==",
      "cpu": [
        "riscv64"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "linux"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-linux-s390x": {
      "version": "1.2.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linux-s390x/-/sharp-libvips-linux-s390x-1.2.4.tgz",
      "integrity": "sha512-qmp9VrzgPgMoGZyPvrQHqk02uyjA0/QrTO26Tqk6l4ZV0MPWIW6LTkqOIov+J1yEu7MbFQaDpwdwJKhbJvuRxQ==",
      "cpu": [
        "s390x"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "linux"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-linux-x64": {
      "version": "1.2.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linux-x64/-/sharp-libvips-linux-x64-1.2.4.tgz",
      "integrity": "sha512-tJxiiLsmHc9Ax1bz3oaOYBURTXGIRDODBqhveVHonrHJ9/+k89qbLl0bcJns+e4t4rvaNBxaEZsFtSfAdquPrw==",
      "cpu": [
        "x64"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "linux"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-linuxmusl-arm64": {
      "version": "1.2.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linuxmusl-arm64/-/sharp-libvips-linuxmusl-arm64-1.2.4.tgz",
      "integrity": "sha512-FVQHuwx1IIuNow9QAbYUzJ+En8KcVm9Lk5+uGUQJHaZmMECZmOlix9HnH7n1TRkXMS0pGxIJokIVB9SuqZGGXw==",
      "cpu": [
        "arm64"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "linux"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-linuxmusl-x64": {
      "version": "1.2.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linuxmusl-x64/-/sharp-libvips-linuxmusl-x64-1.2.4.tgz",
      "integrity": "sha512-+LpyBk7L44ZIXwz/VYfglaX/okxezESc6UxDSoyo2Ks6Jxc4Y7sGjpgU9s4PMgqgjj1gZCylTieNamqA1MF7Dg==",
      "cpu": [
        "x64"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "linux"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-linux-arm": {
      "version": "0.34.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-linux-arm/-/sharp-linux-arm-0.34.5.tgz",
      "integrity": "sha512-9dLqsvwtg1uuXBGZKsxem9595+ujv0sJ6Vi8wcTANSFpwV/GONat5eCkzQo/1O6zRIkh0m/8+5BjrRr7jDUSZw==",
      "cpu": [
        "arm"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": "^18.17.0 || ^20.3.0 || >=21.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-linux-arm": "1.2.4"
      }
    },
    "node_modules/@img/sharp-linux-arm64": {
      "version": "0.34.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-linux-arm64/-/sharp-linux-arm64-0.34.5.tgz",
      "integrity": "sha512-bKQzaJRY/bkPOXyKx5EVup7qkaojECG6NLYswgktOZjaXecSAeCWiZwwiFf3/Y+O1HrauiE3FVsGxFg8c24rZg==",
      "cpu": [
        "arm64"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": "^18.17.0 || ^20.3.0 || >=21.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-linux-arm64": "1.2.4"
      }
    },
    "node_modules/@img/sharp-linux-ppc64": {
      "version": "0.34.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-linux-ppc64/-/sharp-linux-ppc64-0.34.5.tgz",
      "integrity": "sha512-7zznwNaqW6YtsfrGGDA6BRkISKAAE1Jo0QdpNYXNMHu2+0dTrPflTLNkpc8l7MUP5M16ZJcUvysVWWrMefZquA==",
      "cpu": [
        "ppc64"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": "^18.17.0 || ^20.3.0 || >=21.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-linux-ppc64": "1.2.4"
      }
    },
    "node_modules/@img/sharp-linux-riscv64": {
      "version": "0.34.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-linux-riscv64/-/sharp-linux-riscv64-0.34.5.tgz",
      "integrity": "sha512-51gJuLPTKa7piYPaVs8GmByo7/U7/7TZOq+cnXJIHZKavIRHAP77e3N2HEl3dgiqdD/w0yUfiJnII77PuDDFdw==",
      "cpu": [
        "riscv64"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": "^18.17.0 || ^20.3.0 || >=21.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-linux-riscv64": "1.2.4"
      }
    },
    "node_modules/@img/sharp-linux-s390x": {
      "version": "0.34.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-linux-s390x/-/sharp-linux-s390x-0.34.5.tgz",
      "integrity": "sha512-nQtCk0PdKfho3eC5MrbQoigJ2gd1CgddUMkabUj+rBevs8tZ2cULOx46E7oyX+04WGfABgIwmMC0VqieTiR4jg==",
      "cpu": [
        "s390x"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": "^18.17.0 || ^20.3.0 || >=21.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-linux-s390x": "1.2.4"
      }
    },
    "node_modules/@img/sharp-linux-x64": {
      "version": "0.34.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-linux-x64/-/sharp-linux-x64-0.34.5.tgz",
      "integrity": "sha512-MEzd8HPKxVxVenwAa+JRPwEC7QFjoPWuS5NZnBt6B3pu7EG2Ge0id1oLHZpPJdn3OQK+BQDiw9zStiHBTJQQQQ==",
      "cpu": [
        "x64"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": "^18.17.0 || ^20.3.0 || >=21.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-linux-x64": "1.2.4"
      }
    },
    "node_modules/@img/sharp-linuxmusl-arm64": {
      "version": "0.34.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-linuxmusl-arm64/-/sharp-linuxmusl-arm64-0.34.5.tgz",
      "integrity": "sha512-fprJR6GtRsMt6Kyfq44IsChVZeGN97gTD331weR1ex1c1rypDEABN6Tm2xa1wE6lYb5DdEnk03NZPqA7Id21yg==",
      "cpu": [
        "arm64"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": "^18.17.0 || ^20.3.0 || >=21.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-linuxmusl-arm64": "1.2.4"
      }
    },
    "node_modules/@img/sharp-linuxmusl-x64": {
      "version": "0.34.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-linuxmusl-x64/-/sharp-linuxmusl-x64-0.34.5.tgz",
      "integrity": "sha512-Jg8wNT1MUzIvhBFxViqrEhWDGzqymo3sV7z7ZsaWbZNDLXRJZoRGrjulp60YYtV4wfY8VIKcWidjojlLcWrd8Q==",
      "cpu": [
        "x64"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": "^18.17.0 || ^20.3.0 || >=21.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-linuxmusl-x64": "1.2.4"
      }
    },
    "node_modules/@img/sharp-wasm32": {
      "version": "0.34.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-wasm32/-/sharp-wasm32-0.34.5.tgz",
      "integrity": "sha512-OdWTEiVkY2PHwqkbBI8frFxQQFekHaSSkUIJkwzclWZe64O1X4UlUjqqqLaPbUpMOQk6FBu/HtlGXNblIs0huw==",
      "cpu": [
        "wasm32"
      ],
      "license": "Apache-2.0 AND LGPL-3.0-or-later AND MIT",
      "optional": true,
      "dependencies": {
        "@emnapi/runtime": "^1.7.0"
      },
      "engines": {
        "node": "^18.17.0 || ^20.3.0 || >=21.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-win32-arm64": {
      "version": "0.34.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-win32-arm64/-/sharp-win32-arm64-0.34.5.tgz",
      "integrity": "sha512-WQ3AgWCWYSb2yt+IG8mnC6Jdk9Whs7O0gxphblsLvdhSpSTtmu69ZG1Gkb6NuvxsNACwiPV6cNSZNzt0KPsw7g==",
      "cpu": [
        "arm64"
      ],
      "license": "Apache-2.0 AND LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": "^18.17.0 || ^20.3.0 || >=21.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-win32-ia32": {
      "version": "0.34.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-win32-ia32/-/sharp-win32-ia32-0.34.5.tgz",
      "integrity": "sha512-FV9m/7NmeCmSHDD5j4+4pNI8Cp3aW+JvLoXcTUo0IqyjSfAZJ8dIUmijx1qaJsIiU+Hosw6xM5KijAWRJCSgNg==",
      "cpu": [
        "ia32"
      ],
      "license": "Apache-2.0 AND LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": "^18.17.0 || ^20.3.0 || >=21.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-win32-x64": {
      "version": "0.34.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-win32-x64/-/sharp-win32-x64-0.34.5.tgz",
      "integrity": "sha512-+29YMsqY2/9eFEiW93eqWnuLcWcufowXewwSNIT6UwZdUUCrM3oFjMWH/Z6/TMmb4hlFenmfAVbpWeup2jryCw==",
      "cpu": [
        "x64"
      ],
      "license": "Apache-2.0 AND LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": "^18.17.0 || ^20.3.0 || >=21.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@jridgewell/gen-mapping": {
      "version": "0.3.13",
      "resolved": "https://registry.npmjs.org/@jridgewell/gen-mapping/-/gen-mapping-0.3.13.tgz",
      "integrity": "sha512-2kkt/7niJ6MgEPxF0bYdQ6etZaA+fQvDcLKckhy1yIQOzaoKjBBjSj63/aLVjYE3qhRt5dvM+uUyfCg6UKCBbA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jridgewell/sourcemap-codec": "^1.5.0",
        "@jridgewell/trace-mapping": "^0.3.24"
      }
    },
    "node_modules/@jridgewell/remapping": {
      "version": "2.3.5",
      "resolved": "https://registry.npmjs.org/@jridgewell/remapping/-/remapping-2.3.5.tgz",
      "integrity": "sha512-LI9u/+laYG4Ds1TDKSJW2YPrIlcVYOwi2fUC6xB43lueCjgxV4lffOCZCtYFiH6TNOX+tQKXx97T4IKHbhyHEQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jridgewell/gen-mapping": "^0.3.5",
        "@jridgewell/trace-mapping": "^0.3.24"
      }
    },
    "node_modules/@jridgewell/resolve-uri": {
      "version": "3.1.2",
      "resolved": "https://registry.npmjs.org/@jridgewell/resolve-uri/-/resolve-uri-3.1.2.tgz",
      "integrity": "sha512-bRISgCIjP20/tbWSPWMEi54QVPRZExkuD9lJL+UIxUKtwVJA8wW1Trb1jMs1RFXo1CBTNZ/5hpC9QvmKWdopKw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.0.0"
      }
    },
    "node_modules/@jridgewell/sourcemap-codec": {
      "version": "1.5.5",
      "resolved": "https://registry.npmjs.org/@jridgewell/sourcemap-codec/-/sourcemap-codec-1.5.5.tgz",
      "integrity": "sha512-cYQ9310grqxueWbl+WuIUIaiUaDcj7WOq5fVhEljNVgRfOUhY9fy2zTvfoqWsnebh8Sl70VScFbICvJnLKB0Og==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@jridgewell/trace-mapping": {
      "version": "0.3.31",
      "resolved": "https://registry.npmjs.org/@jridgewell/trace-mapping/-/trace-mapping-0.3.31.tgz",
      "integrity": "sha512-zzNR+SdQSDJzc8joaeP8QQoCQr8NuYx2dIIytl1QeBEZHJ9uW6hebsrYgbz8hJwUQao3TWCMtmfV8Nu1twOLAw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jridgewell/resolve-uri": "^3.1.0",
        "@jridgewell/sourcemap-codec": "^1.4.14"
      }
    },
    "node_modules/@napi-rs/wasm-runtime": {
      "version": "0.2.12",
      "resolved": "https://registry.npmjs.org/@napi-rs/wasm-runtime/-/wasm-runtime-0.2.12.tgz",
      "integrity": "sha512-ZVWUcfwY4E/yPitQJl481FjFo3K22D6qF0DuFH6Y/nbnE11GY5uguDxZMGXPQ8WQ0128MXQD7TnfHyK4oWoIJQ==",
      "dev": true,
      "license": "MIT",
      "optional": true,
      "dependencies": {
        "@emnapi/core": "^1.4.3",
        "@emnapi/runtime": "^1.4.3",
        "@tybys/wasm-util": "^0.10.0"
      }
    },
    "node_modules/@next/env": {
      "version": "16.0.10",
      "resolved": "https://registry.npmjs.org/@next/env/-/env-16.0.10.tgz",
      "integrity": "sha512-8tuaQkyDVgeONQ1MeT9Mkk8pQmZapMKFh5B+OrFUlG3rVmYTXcXlBetBgTurKXGaIZvkoqRT9JL5K3phXcgang==",
      "license": "MIT"
    },
    "node_modules/@next/eslint-plugin-next": {
      "version": "16.0.3",
      "resolved": "https://registry.npmjs.org/@next/eslint-plugin-next/-/eslint-plugin-next-16.0.3.tgz",
      "integrity": "sha512-6sPWmZetzFWMsz7Dhuxsdmbu3fK+/AxKRtj7OB0/3OZAI2MHB/v2FeYh271LZ9abvnM1WIwWc/5umYjx0jo5sQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "fast-glob": "3.3.1"
      }
    },
    "node_modules/@next/swc-darwin-arm64": {
      "version": "16.0.10",
      "resolved": "https://registry.npmjs.org/@next/swc-darwin-arm64/-/swc-darwin-arm64-16.0.10.tgz",
      "integrity": "sha512-4XgdKtdVsaflErz+B5XeG0T5PeXKDdruDf3CRpnhN+8UebNa5N2H58+3GDgpn/9GBurrQ1uWW768FfscwYkJRg==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-darwin-x64": {
      "version": "16.0.10",
      "resolved": "https://registry.npmjs.org/@next/swc-darwin-x64/-/swc-darwin-x64-16.0.10.tgz",
      "integrity": "sha512-spbEObMvRKkQ3CkYVOME+ocPDFo5UqHb8EMTS78/0mQ+O1nqE8toHJVioZo4TvebATxgA8XMTHHrScPrn68OGw==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-linux-arm64-gnu": {
      "version": "16.0.10",
      "resolved": "https://registry.npmjs.org/@next/swc-linux-arm64-gnu/-/swc-linux-arm64-gnu-16.0.10.tgz",
      "integrity": "sha512-uQtWE3X0iGB8apTIskOMi2w/MKONrPOUCi5yLO+v3O8Mb5c7K4Q5KD1jvTpTF5gJKa3VH/ijKjKUq9O9UhwOYw==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-linux-arm64-musl": {
      "version": "16.0.10",
      "resolved": "https://registry.npmjs.org/@next/swc-linux-arm64-musl/-/swc-linux-arm64-musl-16.0.10.tgz",
      "integrity": "sha512-llA+hiDTrYvyWI21Z0L1GiXwjQaanPVQQwru5peOgtooeJ8qx3tlqRV2P7uH2pKQaUfHxI/WVarvI5oYgGxaTw==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-linux-x64-gnu": {
      "version": "16.0.10",
      "resolved": "https://registry.npmjs.org/@next/swc-linux-x64-gnu/-/swc-linux-x64-gnu-16.0.10.tgz",
      "integrity": "sha512-AK2q5H0+a9nsXbeZ3FZdMtbtu9jxW4R/NgzZ6+lrTm3d6Zb7jYrWcgjcpM1k8uuqlSy4xIyPR2YiuUr+wXsavA==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-linux-x64-musl": {
      "version": "16.0.10",
      "resolved": "https://registry.npmjs.org/@next/swc-linux-x64-musl/-/swc-linux-x64-musl-16.0.10.tgz",
      "integrity": "sha512-1TDG9PDKivNw5550S111gsO4RGennLVl9cipPhtkXIFVwo31YZ73nEbLjNC8qG3SgTz/QZyYyaFYMeY4BKZR/g==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-win32-arm64-msvc": {
      "version": "16.0.10",
      "resolved": "https://registry.npmjs.org/@next/swc-win32-arm64-msvc/-/swc-win32-arm64-msvc-16.0.10.tgz",
      "integrity": "sha512-aEZIS4Hh32xdJQbHz121pyuVZniSNoqDVx1yIr2hy+ZwJGipeqnMZBJHyMxv2tiuAXGx6/xpTcQJ6btIiBjgmg==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-win32-x64-msvc": {
      "version": "16.0.10",
      "resolved": "https://registry.npmjs.org/@next/swc-win32-x64-msvc/-/swc-win32-x64-msvc-16.0.10.tgz",
      "integrity": "sha512-E+njfCoFLb01RAFEnGZn6ERoOqhK1Gl3Lfz1Kjnj0Ulfu7oJbuMyvBKNj/bw8XZnenHDASlygTjZICQW+rYW1Q==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@nodelib/fs.scandir": {
      "version": "2.1.5",
      "resolved": "https://registry.npmjs.org/@nodelib/fs.scandir/-/fs.scandir-2.1.5.tgz",
      "integrity": "sha512-vq24Bq3ym5HEQm2NKCr3yXDwjc7vTsEThRDnkp2DK9p1uqLR+DHurm/NOTo0KG7HYHU7eppKZj3MyqYuMBf62g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@nodelib/fs.stat": "2.0.5",
        "run-parallel": "^1.1.9"
      },
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/@nodelib/fs.stat": {
      "version": "2.0.5",
      "resolved": "https://registry.npmjs.org/@nodelib/fs.stat/-/fs.stat-2.0.5.tgz",
      "integrity": "sha512-RkhPPp2zrqDAQA/2jNhnztcPAlv64XdhIp7a7454A5ovI7Bukxgt7MX7udwAu3zg1DcpPU0rz3VV1SeaqvY4+A==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/@nodelib/fs.walk": {
      "version": "1.2.8",
      "resolved": "https://registry.npmjs.org/@nodelib/fs.walk/-/fs.walk-1.2.8.tgz",
      "integrity": "sha512-oGB+UxlgWcgQkgwo8GcEGwemoTFt3FIO9ababBmaGwXIoBKZ+GTy0pP185beGg7Llih/NSHSV2XAs1lnznocSg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@nodelib/fs.scandir": "2.1.5",
        "fastq": "^1.6.0"
      },
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/@nolyfill/is-core-module": {
      "version": "1.0.39",
      "resolved": "https://registry.npmjs.org/@nolyfill/is-core-module/-/is-core-module-1.0.39.tgz",
      "integrity": "sha512-nn5ozdjYQpUCZlWGuxcJY/KpxkWQs4DcbMCmKojjyrYDEAGy4Ce19NN4v5MduafTwJlbKc99UA8YhSVqq9yPZA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=12.4.0"
      }
    },
    "node_modules/@panva/hkdf": {
      "version": "1.2.1",
      "resolved": "https://registry.npmjs.org/@panva/hkdf/-/hkdf-1.2.1.tgz",
      "integrity": "sha512-6oclG6Y3PiDFcoyk8srjLfVKyMfVCKJ27JwNPViuXziFpmdz+MZnZN/aKY0JGXgYuO/VghU0jcOAZgWXZ1Dmrw==",
      "license": "MIT",
      "funding": {
        "url": "https://github.com/sponsors/panva"
      }
    },
    "node_modules/@rtsao/scc": {
      "version": "1.1.0",
      "resolved": "https://registry.npmjs.org/@rtsao/scc/-/scc-1.1.0.tgz",
      "integrity": "sha512-zt6OdqaDoOnJ1ZYsCYGt9YmWzDXl4vQdKTyJev62gFhRGKdx7mcT54V9KIjg+d2wi9EXsPvAPKe7i7WjfVWB8g==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@swc/helpers": {
      "version": "0.5.15",
      "resolved": "https://registry.npmjs.org/@swc/helpers/-/helpers-0.5.15.tgz",
      "integrity": "sha512-JQ5TuMi45Owi4/BIMAJBoSQoOJu12oOk/gADqlcUL9JEdHB8vyjUSsxqeNXnmXHjYKMi2WcYtezGEEhqUI/E2g==",
      "license": "Apache-2.0",
      "dependencies": {
        "tslib": "^2.8.0"
      }
    },
    "node_modules/@tailwindcss/node": {
      "version": "4.1.17",
      "resolved": "https://registry.npmjs.org/@tailwindcss/node/-/node-4.1.17.tgz",
      "integrity": "sha512-csIkHIgLb3JisEFQ0vxr2Y57GUNYh447C8xzwj89U/8fdW8LhProdxvnVH6U8M2Y73QKiTIH+LWbK3V2BBZsAg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jridgewell/remapping": "^2.3.4",
        "enhanced-resolve": "^5.18.3",
        "jiti": "^2.6.1",
        "lightningcss": "1.30.2",
        "magic-string": "^0.30.21",
        "source-map-js": "^1.2.1",
        "tailwindcss": "4.1.17"
      }
    },
    "node_modules/@tailwindcss/oxide": {
      "version": "4.1.17",
      "resolved": "https://registry.npmjs.org/@tailwindcss/oxide/-/oxide-4.1.17.tgz",
      "integrity": "sha512-F0F7d01fmkQhsTjXezGBLdrl1KresJTcI3DB8EkScCldyKp3Msz4hub4uyYaVnk88BAS1g5DQjjF6F5qczheLA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 10"
      },
      "optionalDependencies": {
        "@tailwindcss/oxide-android-arm64": "4.1.17",
        "@tailwindcss/oxide-darwin-arm64": "4.1.17",
        "@tailwindcss/oxide-darwin-x64": "4.1.17",
        "@tailwindcss/oxide-freebsd-x64": "4.1.17",
        "@tailwindcss/oxide-linux-arm-gnueabihf": "4.1.17",
        "@tailwindcss/oxide-linux-arm64-gnu": "4.1.17",
        "@tailwindcss/oxide-linux-arm64-musl": "4.1.17",
        "@tailwindcss/oxide-linux-x64-gnu": "4.1.17",
        "@tailwindcss/oxide-linux-x64-musl": "4.1.17",
        "@tailwindcss/oxide-wasm32-wasi": "4.1.17",
        "@tailwindcss/oxide-win32-arm64-msvc": "4.1.17",
        "@tailwindcss/oxide-win32-x64-msvc": "4.1.17"
      }
    },
    "node_modules/@tailwindcss/oxide-android-arm64": {
      "version": "4.1.17",
      "resolved": "https://registry.npmjs.org/@tailwindcss/oxide-android-arm64/-/oxide-android-arm64-4.1.17.tgz",
      "integrity": "sha512-BMqpkJHgOZ5z78qqiGE6ZIRExyaHyuxjgrJ6eBO5+hfrfGkuya0lYfw8fRHG77gdTjWkNWEEm+qeG2cDMxArLQ==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "android"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@tailwindcss/oxide-darwin-arm64": {
      "version": "4.1.17",
      "resolved": "https://registry.npmjs.org/@tailwindcss/oxide-darwin-arm64/-/oxide-darwin-arm64-4.1.17.tgz",
      "integrity": "sha512-EquyumkQweUBNk1zGEU/wfZo2qkp/nQKRZM8bUYO0J+Lums5+wl2CcG1f9BgAjn/u9pJzdYddHWBiFXJTcxmOg==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@tailwindcss/oxide-darwin-x64": {
      "version": "4.1.17",
      "resolved": "https://registry.npmjs.org/@tailwindcss/oxide-darwin-x64/-/oxide-darwin-x64-4.1.17.tgz",
      "integrity": "sha512-gdhEPLzke2Pog8s12oADwYu0IAw04Y2tlmgVzIN0+046ytcgx8uZmCzEg4VcQh+AHKiS7xaL8kGo/QTiNEGRog==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@tailwindcss/oxide-freebsd-x64": {
      "version": "4.1.17",
      "resolved": "https://registry.npmjs.org/@tailwindcss/oxide-freebsd-x64/-/oxide-freebsd-x64-4.1.17.tgz",
      "integrity": "sha512-hxGS81KskMxML9DXsaXT1H0DyA+ZBIbyG/sSAjWNe2EDl7TkPOBI42GBV3u38itzGUOmFfCzk1iAjDXds8Oh0g==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "freebsd"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@tailwindcss/oxide-linux-arm-gnueabihf": {
      "version": "4.1.17",
      "resolved": "https://registry.npmjs.org/@tailwindcss/oxide-linux-arm-gnueabihf/-/oxide-linux-arm-gnueabihf-4.1.17.tgz",
      "integrity": "sha512-k7jWk5E3ldAdw0cNglhjSgv501u7yrMf8oeZ0cElhxU6Y2o7f8yqelOp3fhf7evjIS6ujTI3U8pKUXV2I4iXHQ==",
      "cpu": [
        "arm"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@tailwindcss/oxide-linux-arm64-gnu": {
      "version": "4.1.17",
      "resolved": "https://registry.npmjs.org/@tailwindcss/oxide-linux-arm64-gnu/-/oxide-linux-arm64-gnu-4.1.17.tgz",
      "integrity": "sha512-HVDOm/mxK6+TbARwdW17WrgDYEGzmoYayrCgmLEw7FxTPLcp/glBisuyWkFz/jb7ZfiAXAXUACfyItn+nTgsdQ==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@tailwindcss/oxide-linux-arm64-musl": {
      "version": "4.1.17",
      "resolved": "https://registry.npmjs.org/@tailwindcss/oxide-linux-arm64-musl/-/oxide-linux-arm64-musl-4.1.17.tgz",
      "integrity": "sha512-HvZLfGr42i5anKtIeQzxdkw/wPqIbpeZqe7vd3V9vI3RQxe3xU1fLjss0TjyhxWcBaipk7NYwSrwTwK1hJARMg==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@tailwindcss/oxide-linux-x64-gnu": {
      "version": "4.1.17",
      "resolved": "https://registry.npmjs.org/@tailwindcss/oxide-linux-x64-gnu/-/oxide-linux-x64-gnu-4.1.17.tgz",
      "integrity": "sha512-M3XZuORCGB7VPOEDH+nzpJ21XPvK5PyjlkSFkFziNHGLc5d6g3di2McAAblmaSUNl8IOmzYwLx9NsE7bplNkwQ==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@tailwindcss/oxide-linux-x64-musl": {
      "version": "4.1.17",
      "resolved": "https://registry.npmjs.org/@tailwindcss/oxide-linux-x64-musl/-/oxide-linux-x64-musl-4.1.17.tgz",
      "integrity": "sha512-k7f+pf9eXLEey4pBlw+8dgfJHY4PZ5qOUFDyNf7SI6lHjQ9Zt7+NcscjpwdCEbYi6FI5c2KDTDWyf2iHcCSyyQ==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@tailwindcss/oxide-wasm32-wasi": {
      "version": "4.1.17",
      "resolved": "https://registry.npmjs.org/@tailwindcss/oxide-wasm32-wasi/-/oxide-wasm32-wasi-4.1.17.tgz",
      "integrity": "sha512-cEytGqSSoy7zK4JRWiTCx43FsKP/zGr0CsuMawhH67ONlH+T79VteQeJQRO/X7L0juEUA8ZyuYikcRBf0vsxhg==",
      "bundleDependencies": [
        "@napi-rs/wasm-runtime",
        "@emnapi/core",
        "@emnapi/runtime",
        "@tybys/wasm-util",
        "@emnapi/wasi-threads",
        "tslib"
      ],
      "cpu": [
        "wasm32"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "dependencies": {
        "@emnapi/core": "^1.6.0",
        "@emnapi/runtime": "^1.6.0",
        "@emnapi/wasi-threads": "^1.1.0",
        "@napi-rs/wasm-runtime": "^1.0.7",
        "@tybys/wasm-util": "^0.10.1",
        "tslib": "^2.4.0"
      },
      "engines": {
        "node": ">=14.0.0"
      }
    },
    "node_modules/@tailwindcss/oxide-win32-arm64-msvc": {
      "version": "4.1.17",
      "resolved": "https://registry.npmjs.org/@tailwindcss/oxide-win32-arm64-msvc/-/oxide-win32-arm64-msvc-4.1.17.tgz",
      "integrity": "sha512-JU5AHr7gKbZlOGvMdb4722/0aYbU+tN6lv1kONx0JK2cGsh7g148zVWLM0IKR3NeKLv+L90chBVYcJ8uJWbC9A==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@tailwindcss/oxide-win32-x64-msvc": {
      "version": "4.1.17",
      "resolved": "https://registry.npmjs.org/@tailwindcss/oxide-win32-x64-msvc/-/oxide-win32-x64-msvc-4.1.17.tgz",
      "integrity": "sha512-SKWM4waLuqx0IH+FMDUw6R66Hu4OuTALFgnleKbqhgGU30DY20NORZMZUKgLRjQXNN2TLzKvh48QXTig4h4bGw==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@tailwindcss/postcss": {
      "version": "4.1.17",
      "resolved": "https://registry.npmjs.org/@tailwindcss/postcss/-/postcss-4.1.17.tgz",
      "integrity": "sha512-+nKl9N9mN5uJ+M7dBOOCzINw94MPstNR/GtIhz1fpZysxL/4a+No64jCBD6CPN+bIHWFx3KWuu8XJRrj/572Dw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@alloc/quick-lru": "^5.2.0",
        "@tailwindcss/node": "4.1.17",
        "@tailwindcss/oxide": "4.1.17",
        "postcss": "^8.4.41",
        "tailwindcss": "4.1.17"
      }
    },
    "node_modules/@tybys/wasm-util": {
      "version": "0.10.1",
      "resolved": "https://registry.npmjs.org/@tybys/wasm-util/-/wasm-util-0.10.1.tgz",
      "integrity": "sha512-9tTaPJLSiejZKx+Bmog4uSubteqTvFrVrURwkmHixBo0G4seD0zUxp98E1DzUBJxLQ3NPwXrGKDiVjwx/DpPsg==",
      "dev": true,
      "license": "MIT",
      "optional": true,
      "dependencies": {
        "tslib": "^2.4.0"
      }
    },
    "node_modules/@types/estree": {
      "version": "1.0.8",
      "resolved": "https://registry.npmjs.org/@types/estree/-/estree-1.0.8.tgz",
      "integrity": "sha512-dWHzHa2WqEXI/O1E9OjrocMTKJl2mSrEolh1Iomrv6U+JuNwaHXsXx9bLu5gG7BUWFIN0skIQJQ/L1rIex4X6w==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@types/json-schema": {
      "version": "7.0.15",
      "resolved": "https://registry.npmjs.org/@types/json-schema/-/json-schema-7.0.15.tgz",
      "integrity": "sha512-5+fP8P8MFNC+AyZCDxrB2pkZFPGzqQWUzpSeuuVLvm8VMcorNYavBqoFcxK8bQz4Qsbn4oUEEem4wDLfcysGHA==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@types/json5": {
      "version": "0.0.29",
      "resolved": "https://registry.npmjs.org/@types/json5/-/json5-0.0.29.tgz",
      "integrity": "sha512-dRLjCWHYg4oaA77cxO64oO+7JwCwnIzkZPdrrC71jQmQtlhM556pwKo5bUzqvZndkVbeFLIIi+9TC40JNF5hNQ==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@types/node": {
      "version": "20.19.25",
      "resolved": "https://registry.npmjs.org/@types/node/-/node-20.19.25.tgz",
      "integrity": "sha512-ZsJzA5thDQMSQO788d7IocwwQbI8B5OPzmqNvpf3NY/+MHDAS759Wo0gd2WQeXYt5AAAQjzcrTVC6SKCuYgoCQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "undici-types": "~6.21.0"
      }
    },
    "node_modules/@types/react": {
      "version": "19.2.7",
      "resolved": "https://registry.npmjs.org/@types/react/-/react-19.2.7.tgz",
      "integrity": "sha512-MWtvHrGZLFttgeEj28VXHxpmwYbor/ATPYbBfSFZEIRK0ecCFLl2Qo55z52Hss+UV9CRN7trSeq1zbgx7YDWWg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "csstype": "^3.2.2"
      }
    },
    "node_modules/@types/react-dom": {
      "version": "19.2.3",
      "resolved": "https://registry.npmjs.org/@types/react-dom/-/react-dom-19.2.3.tgz",
      "integrity": "sha512-jp2L/eY6fn+KgVVQAOqYItbF0VY/YApe5Mz2F0aykSO8gx31bYCZyvSeYxCHKvzHG5eZjc+zyaS5BrBWya2+kQ==",
      "dev": true,
      "license": "MIT",
      "peerDependencies": {
        "@types/react": "^19.2.0"
      }
    },
    "node_modules/@typescript-eslint/eslint-plugin": {
      "version": "8.47.0",
      "resolved": "https://registry.npmjs.org/@typescript-eslint/eslint-plugin/-/eslint-plugin-8.47.0.tgz",
      "integrity": "sha512-fe0rz9WJQ5t2iaLfdbDc9T80GJy0AeO453q8C3YCilnGozvOyCG5t+EZtg7j7D88+c3FipfP/x+wzGnh1xp8ZA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@eslint-community/regexpp": "^4.10.0",
        "@typescript-eslint/scope-manager": "8.47.0",
        "@typescript-eslint/type-utils": "8.47.0",
        "@typescript-eslint/utils": "8.47.0",
        "@typescript-eslint/visitor-keys": "8.47.0",
        "graphemer": "^1.4.0",
        "ignore": "^7.0.0",
        "natural-compare": "^1.4.0",
        "ts-api-utils": "^2.1.0"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/typescript-eslint"
      },
      "peerDependencies": {
        "@typescript-eslint/parser": "^8.47.0",
        "eslint": "^8.57.0 || ^9.0.0",
        "typescript": ">=4.8.4 <6.0.0"
      }
    },
    "node_modules/@typescript-eslint/eslint-plugin/node_modules/ignore": {
      "version": "7.0.5",
      "resolved": "https://registry.npmjs.org/ignore/-/ignore-7.0.5.tgz",
      "integrity": "sha512-Hs59xBNfUIunMFgWAbGX5cq6893IbWg4KnrjbYwX3tx0ztorVgTDA6B2sxf8ejHJ4wz8BqGUMYlnzNBer5NvGg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 4"
      }
    },
    "node_modules/@typescript-eslint/parser": {
      "version": "8.47.0",
      "resolved": "https://registry.npmjs.org/@typescript-eslint/parser/-/parser-8.47.0.tgz",
      "integrity": "sha512-lJi3PfxVmo0AkEY93ecfN+r8SofEqZNGByvHAI3GBLrvt1Cw6H5k1IM02nSzu0RfUafr2EvFSw0wAsZgubNplQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@typescript-eslint/scope-manager": "8.47.0",
        "@typescript-eslint/types": "8.47.0",
        "@typescript-eslint/typescript-estree": "8.47.0",
        "@typescript-eslint/visitor-keys": "8.47.0",
        "debug": "^4.3.4"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/typescript-eslint"
      },
      "peerDependencies": {
        "eslint": "^8.57.0 || ^9.0.0",
        "typescript": ">=4.8.4 <6.0.0"
      }
    },
    "node_modules/@typescript-eslint/project-service": {
      "version": "8.47.0",
      "resolved": "https://registry.npmjs.org/@typescript-eslint/project-service/-/project-service-8.47.0.tgz",
      "integrity": "sha512-2X4BX8hUeB5JcA1TQJ7GjcgulXQ+5UkNb0DL8gHsHUHdFoiCTJoYLTpib3LtSDPZsRET5ygN4qqIWrHyYIKERA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@typescript-eslint/tsconfig-utils": "^8.47.0",
        "@typescript-eslint/types": "^8.47.0",
        "debug": "^4.3.4"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/typescript-eslint"
      },
      "peerDependencies": {
        "typescript": ">=4.8.4 <6.0.0"
      }
    },
    "node_modules/@typescript-eslint/scope-manager": {
      "version": "8.47.0",
      "resolved": "https://registry.npmjs.org/@typescript-eslint/scope-manager/-/scope-manager-8.47.0.tgz",
      "integrity": "sha512-a0TTJk4HXMkfpFkL9/WaGTNuv7JWfFTQFJd6zS9dVAjKsojmv9HT55xzbEpnZoY+VUb+YXLMp+ihMLz/UlZfDg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@typescript-eslint/types": "8.47.0",
        "@typescript-eslint/visitor-keys": "8.47.0"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/typescript-eslint"
      }
    },
    "node_modules/@typescript-eslint/tsconfig-utils": {
      "version": "8.47.0",
      "resolved": "https://registry.npmjs.org/@typescript-eslint/tsconfig-utils/-/tsconfig-utils-8.47.0.tgz",
      "integrity": "sha512-ybUAvjy4ZCL11uryalkKxuT3w3sXJAuWhOoGS3T/Wu+iUu1tGJmk5ytSY8gbdACNARmcYEB0COksD2j6hfGK2g==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/typescript-eslint"
      },
      "peerDependencies": {
        "typescript": ">=4.8.4 <6.0.0"
      }
    },
    "node_modules/@typescript-eslint/type-utils": {
      "version": "8.47.0",
      "resolved": "https://registry.npmjs.org/@typescript-eslint/type-utils/-/type-utils-8.47.0.tgz",
      "integrity": "sha512-QC9RiCmZ2HmIdCEvhd1aJELBlD93ErziOXXlHEZyuBo3tBiAZieya0HLIxp+DoDWlsQqDawyKuNEhORyku+P8A==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@typescript-eslint/types": "8.47.0",
        "@typescript-eslint/typescript-estree": "8.47.0",
        "@typescript-eslint/utils": "8.47.0",
        "debug": "^4.3.4",
        "ts-api-utils": "^2.1.0"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/typescript-eslint"
      },
      "peerDependencies": {
        "eslint": "^8.57.0 || ^9.0.0",
        "typescript": ">=4.8.4 <6.0.0"
      }
    },
    "node_modules/@typescript-eslint/types": {
      "version": "8.47.0",
      "resolved": "https://registry.npmjs.org/@typescript-eslint/types/-/types-8.47.0.tgz",
      "integrity": "sha512-nHAE6bMKsizhA2uuYZbEbmp5z2UpffNrPEqiKIeN7VsV6UY/roxanWfoRrf6x/k9+Obf+GQdkm0nPU+vnMXo9A==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/typescript-eslint"
      }
    },
    "node_modules/@typescript-eslint/typescript-estree": {
      "version": "8.47.0",
      "resolved": "https://registry.npmjs.org/@typescript-eslint/typescript-estree/-/typescript-estree-8.47.0.tgz",
      "integrity": "sha512-k6ti9UepJf5NpzCjH31hQNLHQWupTRPhZ+KFF8WtTuTpy7uHPfeg2NM7cP27aCGajoEplxJDFVCEm9TGPYyiVg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@typescript-eslint/project-service": "8.47.0",
        "@typescript-eslint/tsconfig-utils": "8.47.0",
        "@typescript-eslint/types": "8.47.0",
        "@typescript-eslint/visitor-keys": "8.47.0",
        "debug": "^4.3.4",
        "fast-glob": "^3.3.2",
        "is-glob": "^4.0.3",
        "minimatch": "^9.0.4",
        "semver": "^7.6.0",
        "ts-api-utils": "^2.1.0"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/typescript-eslint"
      },
      "peerDependencies": {
        "typescript": ">=4.8.4 <6.0.0"
      }
    },
    "node_modules/@typescript-eslint/typescript-estree/node_modules/brace-expansion": {
      "version": "2.0.2",
      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-2.0.2.tgz",
      "integrity": "sha512-Jt0vHyM+jmUBqojB7E1NIYadt0vI0Qxjxd2TErW94wDz+E2LAm5vKMXXwg6ZZBTHPuUlDgQHKXvjGBdfcF1ZDQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "balanced-match": "^1.0.0"
      }
    },
    "node_modules/@typescript-eslint/typescript-estree/node_modules/fast-glob": {
      "version": "3.3.3",
      "resolved": "https://registry.npmjs.org/fast-glob/-/fast-glob-3.3.3.tgz",
      "integrity": "sha512-7MptL8U0cqcFdzIzwOTHoilX9x5BrNqye7Z/LuC7kCMRio1EMSyqRK3BEAUD7sXRq4iT4AzTVuZdhgQ2TCvYLg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@nodelib/fs.stat": "^2.0.2",
        "@nodelib/fs.walk": "^1.2.3",
        "glob-parent": "^5.1.2",
        "merge2": "^1.3.0",
        "micromatch": "^4.0.8"
      },
      "engines": {
        "node": ">=8.6.0"
      }
    },
    "node_modules/@typescript-eslint/typescript-estree/node_modules/glob-parent": {
      "version": "5.1.2",
      "resolved": "https://registry.npmjs.org/glob-parent/-/glob-parent-5.1.2.tgz",
      "integrity": "sha512-AOIgSQCepiJYwP3ARnGx+5VnTu2HBYdzbGP45eLw1vr3zB3vZLeyed1sC9hnbcOc9/SrMyM5RPQrkGz4aS9Zow==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "is-glob": "^4.0.1"
      },
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/@typescript-eslint/typescript-estree/node_modules/minimatch": {
      "version": "9.0.5",
      "resolved": "https://registry.npmjs.org/minimatch/-/minimatch-9.0.5.tgz",
      "integrity": "sha512-G6T0ZX48xgozx7587koeX9Ys2NYy6Gmv//P89sEte9V9whIapMNF4idKxnW2QtCcLiTWlb/wfCabAtAFWhhBow==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "brace-expansion": "^2.0.1"
      },
      "engines": {
        "node": ">=16 || 14 >=14.17"
      },
      "funding": {
        "url": "https://github.com/sponsors/isaacs"
      }
    },
    "node_modules/@typescript-eslint/typescript-estree/node_modules/semver": {
      "version": "7.7.3",
      "resolved": "https://registry.npmjs.org/semver/-/semver-7.7.3.tgz",
      "integrity": "sha512-SdsKMrI9TdgjdweUSR9MweHA4EJ8YxHn8DFaDisvhVlUOe4BF1tLD7GAj0lIqWVl+dPb/rExr0Btby5loQm20Q==",
      "dev": true,
      "license": "ISC",
      "bin": {
        "semver": "bin/semver.js"
      },
      "engines": {
        "node": ">=10"
      }
    },
    "node_modules/@typescript-eslint/utils": {
      "version": "8.47.0",
      "resolved": "https://registry.npmjs.org/@typescript-eslint/utils/-/utils-8.47.0.tgz",
      "integrity": "sha512-g7XrNf25iL4TJOiPqatNuaChyqt49a/onq5YsJ9+hXeugK+41LVg7AxikMfM02PC6jbNtZLCJj6AUcQXJS/jGQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@eslint-community/eslint-utils": "^4.7.0",
        "@typescript-eslint/scope-manager": "8.47.0",
        "@typescript-eslint/types": "8.47.0",
        "@typescript-eslint/typescript-estree": "8.47.0"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/typescript-eslint"
      },
      "peerDependencies": {
        "eslint": "^8.57.0 || ^9.0.0",
        "typescript": ">=4.8.4 <6.0.0"
      }
    },
    "node_modules/@typescript-eslint/visitor-keys": {
      "version": "8.47.0",
      "resolved": "https://registry.npmjs.org/@typescript-eslint/visitor-keys/-/visitor-keys-8.47.0.tgz",
      "integrity": "sha512-SIV3/6eftCy1bNzCQoPmbWsRLujS8t5iDIZ4spZOBHqrM+yfX2ogg8Tt3PDTAVKw3sSCiUgg30uOAvK2r9zGjQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@typescript-eslint/types": "8.47.0",
        "eslint-visitor-keys": "^4.2.1"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/typescript-eslint"
      }
    },
    "node_modules/@unrs/resolver-binding-android-arm-eabi": {
      "version": "1.11.1",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-android-arm-eabi/-/resolver-binding-android-arm-eabi-1.11.1.tgz",
      "integrity": "sha512-ppLRUgHVaGRWUx0R0Ut06Mjo9gBaBkg3v/8AxusGLhsIotbBLuRk51rAzqLC8gq6NyyAojEXglNjzf6R948DNw==",
      "cpu": [
        "arm"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "android"
      ]
    },
    "node_modules/@unrs/resolver-binding-android-arm64": {
      "version": "1.11.1",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-android-arm64/-/resolver-binding-android-arm64-1.11.1.tgz",
      "integrity": "sha512-lCxkVtb4wp1v+EoN+HjIG9cIIzPkX5OtM03pQYkG+U5O/wL53LC4QbIeazgiKqluGeVEeBlZahHalCaBvU1a2g==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "android"
      ]
    },
    "node_modules/@unrs/resolver-binding-darwin-arm64": {
      "version": "1.11.1",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-darwin-arm64/-/resolver-binding-darwin-arm64-1.11.1.tgz",
      "integrity": "sha512-gPVA1UjRu1Y/IsB/dQEsp2V1pm44Of6+LWvbLc9SDk1c2KhhDRDBUkQCYVWe6f26uJb3fOK8saWMgtX8IrMk3g==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ]
    },
    "node_modules/@unrs/resolver-binding-darwin-x64": {
      "version": "1.11.1",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-darwin-x64/-/resolver-binding-darwin-x64-1.11.1.tgz",
      "integrity": "sha512-cFzP7rWKd3lZaCsDze07QX1SC24lO8mPty9vdP+YVa3MGdVgPmFc59317b2ioXtgCMKGiCLxJ4HQs62oz6GfRQ==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ]
    },
    "node_modules/@unrs/resolver-binding-freebsd-x64": {
      "version": "1.11.1",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-freebsd-x64/-/resolver-binding-freebsd-x64-1.11.1.tgz",
      "integrity": "sha512-fqtGgak3zX4DCB6PFpsH5+Kmt/8CIi4Bry4rb1ho6Av2QHTREM+47y282Uqiu3ZRF5IQioJQ5qWRV6jduA+iGw==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "freebsd"
      ]
    },
    "node_modules/@unrs/resolver-binding-linux-arm-gnueabihf": {
      "version": "1.11.1",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-linux-arm-gnueabihf/-/resolver-binding-linux-arm-gnueabihf-1.11.1.tgz",
      "integrity": "sha512-u92mvlcYtp9MRKmP+ZvMmtPN34+/3lMHlyMj7wXJDeXxuM0Vgzz0+PPJNsro1m3IZPYChIkn944wW8TYgGKFHw==",
      "cpu": [
        "arm"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@unrs/resolver-binding-linux-arm-musleabihf": {
      "version": "1.11.1",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-linux-arm-musleabihf/-/resolver-binding-linux-arm-musleabihf-1.11.1.tgz",
      "integrity": "sha512-cINaoY2z7LVCrfHkIcmvj7osTOtm6VVT16b5oQdS4beibX2SYBwgYLmqhBjA1t51CarSaBuX5YNsWLjsqfW5Cw==",
      "cpu": [
        "arm"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@unrs/resolver-binding-linux-arm64-gnu": {
      "version": "1.11.1",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-linux-arm64-gnu/-/resolver-binding-linux-arm64-gnu-1.11.1.tgz",
      "integrity": "sha512-34gw7PjDGB9JgePJEmhEqBhWvCiiWCuXsL9hYphDF7crW7UgI05gyBAi6MF58uGcMOiOqSJ2ybEeCvHcq0BCmQ==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@unrs/resolver-binding-linux-arm64-musl": {
      "version": "1.11.1",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-linux-arm64-musl/-/resolver-binding-linux-arm64-musl-1.11.1.tgz",
      "integrity": "sha512-RyMIx6Uf53hhOtJDIamSbTskA99sPHS96wxVE/bJtePJJtpdKGXO1wY90oRdXuYOGOTuqjT8ACccMc4K6QmT3w==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@unrs/resolver-binding-linux-ppc64-gnu": {
      "version": "1.11.1",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-linux-ppc64-gnu/-/resolver-binding-linux-ppc64-gnu-1.11.1.tgz",
      "integrity": "sha512-D8Vae74A4/a+mZH0FbOkFJL9DSK2R6TFPC9M+jCWYia/q2einCubX10pecpDiTmkJVUH+y8K3BZClycD8nCShA==",
      "cpu": [
        "ppc64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@unrs/resolver-binding-linux-riscv64-gnu": {
      "version": "1.11.1",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-linux-riscv64-gnu/-/resolver-binding-linux-riscv64-gnu-1.11.1.tgz",
      "integrity": "sha512-frxL4OrzOWVVsOc96+V3aqTIQl1O2TjgExV4EKgRY09AJ9leZpEg8Ak9phadbuX0BA4k8U5qtvMSQQGGmaJqcQ==",
      "cpu": [
        "riscv64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@unrs/resolver-binding-linux-riscv64-musl": {
      "version": "1.11.1",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-linux-riscv64-musl/-/resolver-binding-linux-riscv64-musl-1.11.1.tgz",
      "integrity": "sha512-mJ5vuDaIZ+l/acv01sHoXfpnyrNKOk/3aDoEdLO/Xtn9HuZlDD6jKxHlkN8ZhWyLJsRBxfv9GYM2utQ1SChKew==",
      "cpu": [
        "riscv64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@unrs/resolver-binding-linux-s390x-gnu": {
      "version": "1.11.1",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-linux-s390x-gnu/-/resolver-binding-linux-s390x-gnu-1.11.1.tgz",
      "integrity": "sha512-kELo8ebBVtb9sA7rMe1Cph4QHreByhaZ2QEADd9NzIQsYNQpt9UkM9iqr2lhGr5afh885d/cB5QeTXSbZHTYPg==",
      "cpu": [
        "s390x"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@unrs/resolver-binding-linux-x64-gnu": {
      "version": "1.11.1",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-linux-x64-gnu/-/resolver-binding-linux-x64-gnu-1.11.1.tgz",
      "integrity": "sha512-C3ZAHugKgovV5YvAMsxhq0gtXuwESUKc5MhEtjBpLoHPLYM+iuwSj3lflFwK3DPm68660rZ7G8BMcwSro7hD5w==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@unrs/resolver-binding-linux-x64-musl": {
      "version": "1.11.1",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-linux-x64-musl/-/resolver-binding-linux-x64-musl-1.11.1.tgz",
      "integrity": "sha512-rV0YSoyhK2nZ4vEswT/QwqzqQXw5I6CjoaYMOX0TqBlWhojUf8P94mvI7nuJTeaCkkds3QE4+zS8Ko+GdXuZtA==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@unrs/resolver-binding-wasm32-wasi": {
      "version": "1.11.1",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-wasm32-wasi/-/resolver-binding-wasm32-wasi-1.11.1.tgz",
      "integrity": "sha512-5u4RkfxJm+Ng7IWgkzi3qrFOvLvQYnPBmjmZQ8+szTK/b31fQCnleNl1GgEt7nIsZRIf5PLhPwT0WM+q45x/UQ==",
      "cpu": [
        "wasm32"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "dependencies": {
        "@napi-rs/wasm-runtime": "^0.2.11"
      },
      "engines": {
        "node": ">=14.0.0"
      }
    },
    "node_modules/@unrs/resolver-binding-win32-arm64-msvc": {
      "version": "1.11.1",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-win32-arm64-msvc/-/resolver-binding-win32-arm64-msvc-1.11.1.tgz",
      "integrity": "sha512-nRcz5Il4ln0kMhfL8S3hLkxI85BXs3o8EYoattsJNdsX4YUU89iOkVn7g0VHSRxFuVMdM4Q1jEpIId1Ihim/Uw==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ]
    },
    "node_modules/@unrs/resolver-binding-win32-ia32-msvc": {
      "version": "1.11.1",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-win32-ia32-msvc/-/resolver-binding-win32-ia32-msvc-1.11.1.tgz",
      "integrity": "sha512-DCEI6t5i1NmAZp6pFonpD5m7i6aFrpofcp4LA2i8IIq60Jyo28hamKBxNrZcyOwVOZkgsRp9O2sXWBWP8MnvIQ==",
      "cpu": [
        "ia32"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ]
    },
    "node_modules/@unrs/resolver-binding-win32-x64-msvc": {
      "version": "1.11.1",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-win32-x64-msvc/-/resolver-binding-win32-x64-msvc-1.11.1.tgz",
      "integrity": "sha512-lrW200hZdbfRtztbygyaq/6jP6AKE8qQN2KvPcJ+x7wiD038YtnYtZ82IMNJ69GJibV7bwL3y9FgK+5w/pYt6g==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ]
    },
    "node_modules/acorn": {
      "version": "8.15.0",
      "resolved": "https://registry.npmjs.org/acorn/-/acorn-8.15.0.tgz",
      "integrity": "sha512-NZyJarBfL7nWwIq+FDL6Zp/yHEhePMNnnJ0y3qfieCrmNvYct8uvtiV41UvlSe6apAfk0fY1FbWx+NwfmpvtTg==",
      "dev": true,
      "license": "MIT",
      "bin": {
        "acorn": "bin/acorn"
      },
      "engines": {
        "node": ">=0.4.0"
      }
    },
    "node_modules/acorn-jsx": {
      "version": "5.3.2",
      "resolved": "https://registry.npmjs.org/acorn-jsx/-/acorn-jsx-5.3.2.tgz",
      "integrity": "sha512-rq9s+JNhf0IChjtDXxllJ7g41oZk5SlXtp0LHwyA5cejwn7vKmKp4pPri6YEePv2PU65sAsegbXtIinmDFDXgQ==",
      "dev": true,
      "license": "MIT",
      "peerDependencies": {
        "acorn": "^6.0.0 || ^7.0.0 || ^8.0.0"
      }
    },
    "node_modules/ajv": {
      "version": "6.12.6",
      "resolved": "https://registry.npmjs.org/ajv/-/ajv-6.12.6.tgz",
      "integrity": "sha512-j3fVLgvTo527anyYyJOGTYJbG+vnnQYvE0m5mmkc1TK+nxAppkCLMIL0aZ4dblVCNoGShhm+kzE4ZUykBoMg4g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "fast-deep-equal": "^3.1.1",
        "fast-json-stable-stringify": "^2.0.0",
        "json-schema-traverse": "^0.4.1",
        "uri-js": "^4.2.2"
      },
      "funding": {
        "type": "github",
        "url": "https://github.com/sponsors/epoberezkin"
      }
    },
    "node_modules/ansi-styles": {
      "version": "4.3.0",
      "resolved": "https://registry.npmjs.org/ansi-styles/-/ansi-styles-4.3.0.tgz",
      "integrity": "sha512-zbB9rCJAT1rbjiVDb2hqKFHNYLxgtk8NURxZ3IZwD3F6NtxbXZQCnnSi1Lkx+IDohdPlFp222wVALIheZJQSEg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "color-convert": "^2.0.1"
      },
      "engines": {
        "node": ">=8"
      },
      "funding": {
        "url": "https://github.com/chalk/ansi-styles?sponsor=1"
      }
    },
    "node_modules/argparse": {
      "version": "2.0.1",
      "resolved": "https://registry.npmjs.org/argparse/-/argparse-2.0.1.tgz",
      "integrity": "sha512-8+9WqebbFzpX9OR+Wa6O29asIogeRMzcGtAINdpMHHyAg10f05aSFVBbcEqGf/PXw1EjAZ+q2/bEBg3DvurK3Q==",
      "dev": true,
      "license": "Python-2.0"
    },
    "node_modules/aria-query": {
      "version": "5.3.2",
      "resolved": "https://registry.npmjs.org/aria-query/-/aria-query-5.3.2.tgz",
      "integrity": "sha512-COROpnaoap1E2F000S62r6A60uHZnmlvomhfyT2DlTcrY1OrBKn2UhH7qn5wTC9zMvD0AY7csdPSNwKP+7WiQw==",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/array-buffer-byte-length": {
      "version": "1.0.2",
      "resolved": "https://registry.npmjs.org/array-buffer-byte-length/-/array-buffer-byte-length-1.0.2.tgz",
      "integrity": "sha512-LHE+8BuR7RYGDKvnrmcuSq3tDcKv9OFEXQt/HpbZhY7V6h0zlUXutnAD82GiFx9rdieCMjkvtcsPqBwgUl1Iiw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.3",
        "is-array-buffer": "^3.0.5"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/array-includes": {
      "version": "3.1.9",
      "resolved": "https://registry.npmjs.org/array-includes/-/array-includes-3.1.9.tgz",
      "integrity": "sha512-FmeCCAenzH0KH381SPT5FZmiA/TmpndpcaShhfgEN9eCVjnFBqq3l1xrI42y8+PPLI6hypzou4GXw00WHmPBLQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.8",
        "call-bound": "^1.0.4",
        "define-properties": "^1.2.1",
        "es-abstract": "^1.24.0",
        "es-object-atoms": "^1.1.1",
        "get-intrinsic": "^1.3.0",
        "is-string": "^1.1.1",
        "math-intrinsics": "^1.1.0"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/array.prototype.findlast": {
      "version": "1.2.5",
      "resolved": "https://registry.npmjs.org/array.prototype.findlast/-/array.prototype.findlast-1.2.5.tgz",
      "integrity": "sha512-CVvd6FHg1Z3POpBLxO6E6zr+rSKEQ9L6rZHAaY7lLfhKsWYUBBOuMs0e9o24oopj6H+geRCX0YJ+TJLBK2eHyQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.7",
        "define-properties": "^1.2.1",
        "es-abstract": "^1.23.2",
        "es-errors": "^1.3.0",
        "es-object-atoms": "^1.0.0",
        "es-shim-unscopables": "^1.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/array.prototype.findlastindex": {
      "version": "1.2.6",
      "resolved": "https://registry.npmjs.org/array.prototype.findlastindex/-/array.prototype.findlastindex-1.2.6.tgz",
      "integrity": "sha512-F/TKATkzseUExPlfvmwQKGITM3DGTK+vkAsCZoDc5daVygbJBnjEUCbgkAvVFsgfXfX4YIqZ/27G3k3tdXrTxQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.8",
        "call-bound": "^1.0.4",
        "define-properties": "^1.2.1",
        "es-abstract": "^1.23.9",
        "es-errors": "^1.3.0",
        "es-object-atoms": "^1.1.1",
        "es-shim-unscopables": "^1.1.0"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/array.prototype.flat": {
      "version": "1.3.3",
      "resolved": "https://registry.npmjs.org/array.prototype.flat/-/array.prototype.flat-1.3.3.tgz",
      "integrity": "sha512-rwG/ja1neyLqCuGZ5YYrznA62D4mZXg0i1cIskIUKSiqF3Cje9/wXAls9B9s1Wa2fomMsIv8czB8jZcPmxCXFg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.8",
        "define-properties": "^1.2.1",
        "es-abstract": "^1.23.5",
        "es-shim-unscopables": "^1.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/array.prototype.flatmap": {
      "version": "1.3.3",
      "resolved": "https://registry.npmjs.org/array.prototype.flatmap/-/array.prototype.flatmap-1.3.3.tgz",
      "integrity": "sha512-Y7Wt51eKJSyi80hFrJCePGGNo5ktJCslFuboqJsbf57CCPcm5zztluPlc4/aD8sWsKvlwatezpV4U1efk8kpjg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.8",
        "define-properties": "^1.2.1",
        "es-abstract": "^1.23.5",
        "es-shim-unscopables": "^1.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/array.prototype.tosorted": {
      "version": "1.1.4",
      "resolved": "https://registry.npmjs.org/array.prototype.tosorted/-/array.prototype.tosorted-1.1.4.tgz",
      "integrity": "sha512-p6Fx8B7b7ZhL/gmUsAy0D15WhvDccw3mnGNbZpi3pmeJdxtWsj2jEaI4Y6oo3XiHfzuSgPwKc04MYt6KgvC/wA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.7",
        "define-properties": "^1.2.1",
        "es-abstract": "^1.23.3",
        "es-errors": "^1.3.0",
        "es-shim-unscopables": "^1.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/arraybuffer.prototype.slice": {
      "version": "1.0.4",
      "resolved": "https://registry.npmjs.org/arraybuffer.prototype.slice/-/arraybuffer.prototype.slice-1.0.4.tgz",
      "integrity": "sha512-BNoCY6SXXPQ7gF2opIP4GBE+Xw7U+pHMYKuzjgCN3GwiaIR09UUeKfheyIry77QtrCBlC0KK0q5/TER/tYh3PQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "array-buffer-byte-length": "^1.0.1",
        "call-bind": "^1.0.8",
        "define-properties": "^1.2.1",
        "es-abstract": "^1.23.5",
        "es-errors": "^1.3.0",
        "get-intrinsic": "^1.2.6",
        "is-array-buffer": "^3.0.4"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/ast-types-flow": {
      "version": "0.0.8",
      "resolved": "https://registry.npmjs.org/ast-types-flow/-/ast-types-flow-0.0.8.tgz",
      "integrity": "sha512-OH/2E5Fg20h2aPrbe+QL8JZQFko0YZaF+j4mnQ7BGhfavO7OpSLa8a0y9sBwomHdSbkhTS8TQNayBfnW5DwbvQ==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/async-function": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/async-function/-/async-function-1.0.0.tgz",
      "integrity": "sha512-hsU18Ae8CDTR6Kgu9DYf0EbCr/a5iGL0rytQDobUcdpYOKokk8LEjVphnXkDkgpi0wYVsqrXuP0bZxJaTqdgoA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/available-typed-arrays": {
      "version": "1.0.7",
      "resolved": "https://registry.npmjs.org/available-typed-arrays/-/available-typed-arrays-1.0.7.tgz",
      "integrity": "sha512-wvUjBtSGN7+7SjNpq/9M2Tg350UZD3q62IFZLbRAR1bSMlCo1ZaeW+BJ+D090e4hIIZLBcTDWe4Mh4jvUDajzQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "possible-typed-array-names": "^1.0.0"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/axe-core": {
      "version": "4.11.0",
      "resolved": "https://registry.npmjs.org/axe-core/-/axe-core-4.11.0.tgz",
      "integrity": "sha512-ilYanEU8vxxBexpJd8cWM4ElSQq4QctCLKih0TSfjIfCQTeyH/6zVrmIJfLPrKTKJRbiG+cfnZbQIjAlJmF1jQ==",
      "dev": true,
      "license": "MPL-2.0",
      "engines": {
        "node": ">=4"
      }
    },
    "node_modules/axobject-query": {
      "version": "4.1.0",
      "resolved": "https://registry.npmjs.org/axobject-query/-/axobject-query-4.1.0.tgz",
      "integrity": "sha512-qIj0G9wZbMGNLjLmg1PT6v2mE9AH2zlnADJD/2tC6E00hgmhUOfEB6greHPAfLRSufHqROIUTkw6E+M3lH0PTQ==",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/balanced-match": {
      "version": "1.0.2",
      "resolved": "https://registry.npmjs.org/balanced-match/-/balanced-match-1.0.2.tgz",
      "integrity": "sha512-3oSeUO0TMV67hN1AmbXsK4yaqU7tjiHlbxRDZOpH0KW9+CeX4bRAaX0Anxt0tx2MrpRpWwQaPwIlISEJhYU5Pw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/baseline-browser-mapping": {
      "version": "2.9.5",
      "resolved": "https://registry.npmjs.org/baseline-browser-mapping/-/baseline-browser-mapping-2.9.5.tgz",
      "integrity": "sha512-D5vIoztZOq1XM54LUdttJVc96ggEsIfju2JBvht06pSzpckp3C7HReun67Bghzrtdsq9XdMGbSSB3v3GhMNmAA==",
      "dev": true,
      "license": "Apache-2.0",
      "bin": {
        "baseline-browser-mapping": "dist/cli.js"
      }
    },
    "node_modules/brace-expansion": {
      "version": "1.1.12",
      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.12.tgz",
      "integrity": "sha512-9T9UjW3r0UW5c1Q7GTwllptXwhvYmEzFhzMfZ9H7FQWt+uZePjZPjBP/W1ZEyZ1twGWom5/56TF4lPcqjnDHcg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "balanced-match": "^1.0.0",
        "concat-map": "0.0.1"
      }
    },
    "node_modules/braces": {
      "version": "3.0.3",
      "resolved": "https://registry.npmjs.org/braces/-/braces-3.0.3.tgz",
      "integrity": "sha512-yQbXgO/OSZVD2IsiLlro+7Hf6Q18EJrKSEsdoMzKePKXct3gvD8oLcOQdIzGupr5Fj+EDe8gO/lxc1BzfMpxvA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "fill-range": "^7.1.1"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/browserslist": {
      "version": "4.28.0",
      "resolved": "https://registry.npmjs.org/browserslist/-/browserslist-4.28.0.tgz",
      "integrity": "sha512-tbydkR/CxfMwelN0vwdP/pLkDwyAASZ+VfWm4EOwlB6SWhx1sYnWLqo8N5j0rAzPfzfRaxt0mM/4wPU/Su84RQ==",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/browserslist"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/browserslist"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "baseline-browser-mapping": "^2.8.25",
        "caniuse-lite": "^1.0.30001754",
        "electron-to-chromium": "^1.5.249",
        "node-releases": "^2.0.27",
        "update-browserslist-db": "^1.1.4"
      },
      "bin": {
        "browserslist": "cli.js"
      },
      "engines": {
        "node": "^6 || ^7 || ^8 || ^9 || ^10 || ^11 || ^12 || >=13.7"
      }
    },
    "node_modules/call-bind": {
      "version": "1.0.8",
      "resolved": "https://registry.npmjs.org/call-bind/-/call-bind-1.0.8.tgz",
      "integrity": "sha512-oKlSFMcMwpUg2ednkhQ454wfWiU/ul3CkJe/PEHcTKuiX6RpbehUiFMXu13HalGZxfUwCQzZG747YXBn1im9ww==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind-apply-helpers": "^1.0.0",
        "es-define-property": "^1.0.0",
        "get-intrinsic": "^1.2.4",
        "set-function-length": "^1.2.2"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/call-bind-apply-helpers": {
      "version": "1.0.2",
      "resolved": "https://registry.npmjs.org/call-bind-apply-helpers/-/call-bind-apply-helpers-1.0.2.tgz",
      "integrity": "sha512-Sp1ablJ0ivDkSzjcaJdxEunN5/XvksFJ2sMBFfq6x0ryhQV/2b/KwFe21cMpmHtPOSij8K99/wSfoEuTObmuMQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "es-errors": "^1.3.0",
        "function-bind": "^1.1.2"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/call-bound": {
      "version": "1.0.4",
      "resolved": "https://registry.npmjs.org/call-bound/-/call-bound-1.0.4.tgz",
      "integrity": "sha512-+ys997U96po4Kx/ABpBCqhA9EuxJaQWDQg7295H4hBphv3IZg0boBKuwYpt4YXp6MZ5AmZQnU/tyMTlRpaSejg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind-apply-helpers": "^1.0.2",
        "get-intrinsic": "^1.3.0"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/callsites": {
      "version": "3.1.0",
      "resolved": "https://registry.npmjs.org/callsites/-/callsites-3.1.0.tgz",
      "integrity": "sha512-P8BjAsXvZS+VIDUI11hHCQEv74YT67YUi5JJFNWIqL235sBmjX4+qx9Muvls5ivyNENctx46xQLQ3aTuE7ssaQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/caniuse-lite": {
      "version": "1.0.30001757",
      "resolved": "https://registry.npmjs.org/caniuse-lite/-/caniuse-lite-1.0.30001757.tgz",
      "integrity": "sha512-r0nnL/I28Zi/yjk1el6ilj27tKcdjLsNqAOZr0yVjWPrSQyHgKI2INaEWw21bAQSv2LXRt1XuCS/GomNpWOxsQ==",
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/browserslist"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/caniuse-lite"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "CC-BY-4.0"
    },
    "node_modules/chalk": {
      "version": "4.1.2",
      "resolved": "https://registry.npmjs.org/chalk/-/chalk-4.1.2.tgz",
      "integrity": "sha512-oKnbhFyRIXpUuez8iBMmyEa4nbj4IOQyuhc/wy9kY7/WVPcwIO9VA668Pu8RkO7+0G76SLROeyw9CpQ061i4mA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "ansi-styles": "^4.1.0",
        "supports-color": "^7.1.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/chalk/chalk?sponsor=1"
      }
    },
    "node_modules/client-only": {
      "version": "0.0.1",
      "resolved": "https://registry.npmjs.org/client-only/-/client-only-0.0.1.tgz",
      "integrity": "sha512-IV3Ou0jSMzZrd3pZ48nLkT9DA7Ag1pnPzaiQhpW7c3RbcqqzvzzVu+L8gfqMp/8IM2MQtSiqaCxrrcfu8I8rMA==",
      "license": "MIT"
    },
    "node_modules/color-convert": {
      "version": "2.0.1",
      "resolved": "https://registry.npmjs.org/color-convert/-/color-convert-2.0.1.tgz",
      "integrity": "sha512-RRECPsj7iu/xb5oKYcsFHSppFNnsj/52OVTRKb4zP5onXwVF3zVmmToNcOfGC+CRDpfK/U584fMg38ZHCaElKQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "color-name": "~1.1.4"
      },
      "engines": {
        "node": ">=7.0.0"
      }
    },
    "node_modules/color-name": {
      "version": "1.1.4",
      "resolved": "https://registry.npmjs.org/color-name/-/color-name-1.1.4.tgz",
      "integrity": "sha512-dOy+3AuW3a2wNbZHIuMZpTcgjGuLU/uBL/ubcZF9OXbDo8ff4O8yVp5Bf0efS8uEoYo5q4Fx7dY9OgQGXgAsQA==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/concat-map": {
      "version": "0.0.1",
      "resolved": "https://registry.npmjs.org/concat-map/-/concat-map-0.0.1.tgz",
      "integrity": "sha512-/Srv4dswyQNBfohGpz9o6Yb3Gz3SrUDqBH5rTuhGR7ahtlbYKnVxw2bCFMRljaA7EXHaXZ8wsHdodFvbkhKmqg==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/convert-source-map": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/convert-source-map/-/convert-source-map-2.0.0.tgz",
      "integrity": "sha512-Kvp459HrV2FEJ1CAsi1Ku+MY3kasH19TFykTz2xWmMeq6bk2NU3XXvfJ+Q61m0xktWwt+1HSYf3JZsTms3aRJg==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/cross-spawn": {
      "version": "7.0.6",
      "resolved": "https://registry.npmjs.org/cross-spawn/-/cross-spawn-7.0.6.tgz",
      "integrity": "sha512-uV2QOWP2nWzsy2aMp8aRibhi9dlzF5Hgh5SHaB9OiTGEyDTiJJyx0uy51QXdyWbtAHNua4XJzUKca3OzKUd3vA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "path-key": "^3.1.0",
        "shebang-command": "^2.0.0",
        "which": "^2.0.1"
      },
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/csstype": {
      "version": "3.2.3",
      "resolved": "https://registry.npmjs.org/csstype/-/csstype-3.2.3.tgz",
      "integrity": "sha512-z1HGKcYy2xA8AGQfwrn0PAy+PB7X/GSj3UVJW9qKyn43xWa+gl5nXmU4qqLMRzWVLFC8KusUX8T/0kCiOYpAIQ==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/damerau-levenshtein": {
      "version": "1.0.8",
      "resolved": "https://registry.npmjs.org/damerau-levenshtein/-/damerau-levenshtein-1.0.8.tgz",
      "integrity": "sha512-sdQSFB7+llfUcQHUQO3+B8ERRj0Oa4w9POWMI/puGtuf7gFywGmkaLCElnudfTiKZV+NvHqL0ifzdrI8Ro7ESA==",
      "dev": true,
      "license": "BSD-2-Clause"
    },
    "node_modules/data-view-buffer": {
      "version": "1.0.2",
      "resolved": "https://registry.npmjs.org/data-view-buffer/-/data-view-buffer-1.0.2.tgz",
      "integrity": "sha512-EmKO5V3OLXh1rtK2wgXRansaK1/mtVdTUEiEI0W8RkvgT05kfxaH29PliLnpLP73yYO6142Q72QNa8Wx/A5CqQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.3",
        "es-errors": "^1.3.0",
        "is-data-view": "^1.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/data-view-byte-length": {
      "version": "1.0.2",
      "resolved": "https://registry.npmjs.org/data-view-byte-length/-/data-view-byte-length-1.0.2.tgz",
      "integrity": "sha512-tuhGbE6CfTM9+5ANGf+oQb72Ky/0+s3xKUpHvShfiz2RxMFgFPjsXuRLBVMtvMs15awe45SRb83D6wH4ew6wlQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.3",
        "es-errors": "^1.3.0",
        "is-data-view": "^1.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/inspect-js"
      }
    },
    "node_modules/data-view-byte-offset": {
      "version": "1.0.1",
      "resolved": "https://registry.npmjs.org/data-view-byte-offset/-/data-view-byte-offset-1.0.1.tgz",
      "integrity": "sha512-BS8PfmtDGnrgYdOonGZQdLZslWIeCGFP9tpan0hi1Co2Zr2NKADsvGYA8XxuG/4UWgJ6Cjtv+YJnB6MM69QGlQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.2",
        "es-errors": "^1.3.0",
        "is-data-view": "^1.0.1"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/debug": {
      "version": "4.4.3",
      "resolved": "https://registry.npmjs.org/debug/-/debug-4.4.3.tgz",
      "integrity": "sha512-RGwwWnwQvkVfavKVt22FGLw+xYSdzARwm0ru6DhTVA3umU5hZc28V3kO4stgYryrTlLpuvgI9GiijltAjNbcqA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "ms": "^2.1.3"
      },
      "engines": {
        "node": ">=6.0"
      },
      "peerDependenciesMeta": {
        "supports-color": {
          "optional": true
        }
      }
    },
    "node_modules/deep-is": {
      "version": "0.1.4",
      "resolved": "https://registry.npmjs.org/deep-is/-/deep-is-0.1.4.tgz",
      "integrity": "sha512-oIPzksmTg4/MriiaYGO+okXDT7ztn/w3Eptv/+gSIdMdKsJo0u4CfYNFJPy+4SKMuCqGw2wxnA+URMg3t8a/bQ==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/define-data-property": {
      "version": "1.1.4",
      "resolved": "https://registry.npmjs.org/define-data-property/-/define-data-property-1.1.4.tgz",
      "integrity": "sha512-rBMvIzlpA8v6E+SJZoo++HAYqsLrkg7MSfIinMPFhmkorw7X+dOXVJQs+QT69zGkzMyfDnIMN2Wid1+NbL3T+A==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "es-define-property": "^1.0.0",
        "es-errors": "^1.3.0",
        "gopd": "^1.0.1"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/define-properties": {
      "version": "1.2.1",
      "resolved": "https://registry.npmjs.org/define-properties/-/define-properties-1.2.1.tgz",
      "integrity": "sha512-8QmQKqEASLd5nx0U1B1okLElbUuuttJ/AnYmRXbbbGDWh6uS208EjD4Xqq/I9wK7u0v6O08XhTWnt5XtEbR6Dg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "define-data-property": "^1.0.1",
        "has-property-descriptors": "^1.0.0",
        "object-keys": "^1.1.1"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/detect-libc": {
      "version": "2.1.2",
      "resolved": "https://registry.npmjs.org/detect-libc/-/detect-libc-2.1.2.tgz",
      "integrity": "sha512-Btj2BOOO83o3WyH59e8MgXsxEQVcarkUOpEYrubB0urwnN10yQ364rsiByU11nZlqWYZm05i/of7io4mzihBtQ==",
      "devOptional": true,
      "license": "Apache-2.0",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/doctrine": {
      "version": "2.1.0",
      "resolved": "https://registry.npmjs.org/doctrine/-/doctrine-2.1.0.tgz",
      "integrity": "sha512-35mSku4ZXK0vfCuHEDAwt55dg2jNajHZ1odvF+8SSr82EsZY4QmXfuWso8oEd8zRhVObSN18aM0CjSdoBX7zIw==",
      "dev": true,
      "license": "Apache-2.0",
      "dependencies": {
        "esutils": "^2.0.2"
      },
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/dunder-proto": {
      "version": "1.0.1",
      "resolved": "https://registry.npmjs.org/dunder-proto/-/dunder-proto-1.0.1.tgz",
      "integrity": "sha512-KIN/nDJBQRcXw0MLVhZE9iQHmG68qAVIBg9CqmUYjmQIhgij9U5MFvrqkUL5FbtyyzZuOeOt0zdeRe4UY7ct+A==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind-apply-helpers": "^1.0.1",
        "es-errors": "^1.3.0",
        "gopd": "^1.2.0"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/electron-to-chromium": {
      "version": "1.5.259",
      "resolved": "https://registry.npmjs.org/electron-to-chromium/-/electron-to-chromium-1.5.259.tgz",
      "integrity": "sha512-I+oLXgpEJzD6Cwuwt1gYjxsDmu/S/Kd41mmLA3O+/uH2pFRO/DvOjUyGozL8j3KeLV6WyZ7ssPwELMsXCcsJAQ==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/emoji-regex": {
      "version": "9.2.2",
      "resolved": "https://registry.npmjs.org/emoji-regex/-/emoji-regex-9.2.2.tgz",
      "integrity": "sha512-L18DaJsXSUk2+42pv8mLs5jJT2hqFkFE4j21wOmgbUqsZ2hL72NsUU785g9RXgo3s0ZNgVl42TiHp3ZtOv/Vyg==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/enhanced-resolve": {
      "version": "5.18.3",
      "resolved": "https://registry.npmjs.org/enhanced-resolve/-/enhanced-resolve-5.18.3.tgz",
      "integrity": "sha512-d4lC8xfavMeBjzGr2vECC3fsGXziXZQyJxD868h2M/mBI3PwAuODxAkLkq5HYuvrPYcUtiLzsTo8U3PgX3Ocww==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "graceful-fs": "^4.2.4",
        "tapable": "^2.2.0"
      },
      "engines": {
        "node": ">=10.13.0"
      }
    },
    "node_modules/es-abstract": {
      "version": "1.24.0",
      "resolved": "https://registry.npmjs.org/es-abstract/-/es-abstract-1.24.0.tgz",
      "integrity": "sha512-WSzPgsdLtTcQwm4CROfS5ju2Wa1QQcVeT37jFjYzdFz1r9ahadC8B8/a4qxJxM+09F18iumCdRmlr96ZYkQvEg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "array-buffer-byte-length": "^1.0.2",
        "arraybuffer.prototype.slice": "^1.0.4",
        "available-typed-arrays": "^1.0.7",
        "call-bind": "^1.0.8",
        "call-bound": "^1.0.4",
        "data-view-buffer": "^1.0.2",
        "data-view-byte-length": "^1.0.2",
        "data-view-byte-offset": "^1.0.1",
        "es-define-property": "^1.0.1",
        "es-errors": "^1.3.0",
        "es-object-atoms": "^1.1.1",
        "es-set-tostringtag": "^2.1.0",
        "es-to-primitive": "^1.3.0",
        "function.prototype.name": "^1.1.8",
        "get-intrinsic": "^1.3.0",
        "get-proto": "^1.0.1",
        "get-symbol-description": "^1.1.0",
        "globalthis": "^1.0.4",
        "gopd": "^1.2.0",
        "has-property-descriptors": "^1.0.2",
        "has-proto": "^1.2.0",
        "has-symbols": "^1.1.0",
        "hasown": "^2.0.2",
        "internal-slot": "^1.1.0",
        "is-array-buffer": "^3.0.5",
        "is-callable": "^1.2.7",
        "is-data-view": "^1.0.2",
        "is-negative-zero": "^2.0.3",
        "is-regex": "^1.2.1",
        "is-set": "^2.0.3",
        "is-shared-array-buffer": "^1.0.4",
        "is-string": "^1.1.1",
        "is-typed-array": "^1.1.15",
        "is-weakref": "^1.1.1",
        "math-intrinsics": "^1.1.0",
        "object-inspect": "^1.13.4",
        "object-keys": "^1.1.1",
        "object.assign": "^4.1.7",
        "own-keys": "^1.0.1",
        "regexp.prototype.flags": "^1.5.4",
        "safe-array-concat": "^1.1.3",
        "safe-push-apply": "^1.0.0",
        "safe-regex-test": "^1.1.0",
        "set-proto": "^1.0.0",
        "stop-iteration-iterator": "^1.1.0",
        "string.prototype.trim": "^1.2.10",
        "string.prototype.trimend": "^1.0.9",
        "string.prototype.trimstart": "^1.0.8",
        "typed-array-buffer": "^1.0.3",
        "typed-array-byte-length": "^1.0.3",
        "typed-array-byte-offset": "^1.0.4",
        "typed-array-length": "^1.0.7",
        "unbox-primitive": "^1.1.0",
        "which-typed-array": "^1.1.19"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/es-define-property": {
      "version": "1.0.1",
      "resolved": "https://registry.npmjs.org/es-define-property/-/es-define-property-1.0.1.tgz",
      "integrity": "sha512-e3nRfgfUZ4rNGL232gUgX06QNyyez04KdjFrF+LTRoOXmrOgFKDg4BCdsjW8EnT69eqdYGmRpJwiPVYNrCaW3g==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/es-errors": {
      "version": "1.3.0",
      "resolved": "https://registry.npmjs.org/es-errors/-/es-errors-1.3.0.tgz",
      "integrity": "sha512-Zf5H2Kxt2xjTvbJvP2ZWLEICxA6j+hAmMzIlypy4xcBg1vKVnx89Wy0GbS+kf5cwCVFFzdCFh2XSCFNULS6csw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/es-iterator-helpers": {
      "version": "1.2.1",
      "resolved": "https://registry.npmjs.org/es-iterator-helpers/-/es-iterator-helpers-1.2.1.tgz",
      "integrity": "sha512-uDn+FE1yrDzyC0pCo961B2IHbdM8y/ACZsKD4dG6WqrjV53BADjwa7D+1aom2rsNVfLyDgU/eigvlJGJ08OQ4w==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.8",
        "call-bound": "^1.0.3",
        "define-properties": "^1.2.1",
        "es-abstract": "^1.23.6",
        "es-errors": "^1.3.0",
        "es-set-tostringtag": "^2.0.3",
        "function-bind": "^1.1.2",
        "get-intrinsic": "^1.2.6",
        "globalthis": "^1.0.4",
        "gopd": "^1.2.0",
        "has-property-descriptors": "^1.0.2",
        "has-proto": "^1.2.0",
        "has-symbols": "^1.1.0",
        "internal-slot": "^1.1.0",
        "iterator.prototype": "^1.1.4",
        "safe-array-concat": "^1.1.3"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/es-object-atoms": {
      "version": "1.1.1",
      "resolved": "https://registry.npmjs.org/es-object-atoms/-/es-object-atoms-1.1.1.tgz",
      "integrity": "sha512-FGgH2h8zKNim9ljj7dankFPcICIK9Cp5bm+c2gQSYePhpaG5+esrLODihIorn+Pe6FGJzWhXQotPv73jTaldXA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "es-errors": "^1.3.0"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/es-set-tostringtag": {
      "version": "2.1.0",
      "resolved": "https://registry.npmjs.org/es-set-tostringtag/-/es-set-tostringtag-2.1.0.tgz",
      "integrity": "sha512-j6vWzfrGVfyXxge+O0x5sh6cvxAog0a/4Rdd2K36zCMV5eJ+/+tOAngRO8cODMNWbVRdVlmGZQL2YS3yR8bIUA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "es-errors": "^1.3.0",
        "get-intrinsic": "^1.2.6",
        "has-tostringtag": "^1.0.2",
        "hasown": "^2.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/es-shim-unscopables": {
      "version": "1.1.0",
      "resolved": "https://registry.npmjs.org/es-shim-unscopables/-/es-shim-unscopables-1.1.0.tgz",
      "integrity": "sha512-d9T8ucsEhh8Bi1woXCf+TIKDIROLG5WCkxg8geBCbvk22kzwC5G2OnXVMO6FUsvQlgUUXQ2itephWDLqDzbeCw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "hasown": "^2.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/es-to-primitive": {
      "version": "1.3.0",
      "resolved": "https://registry.npmjs.org/es-to-primitive/-/es-to-primitive-1.3.0.tgz",
      "integrity": "sha512-w+5mJ3GuFL+NjVtJlvydShqE1eN3h3PbI7/5LAsYJP/2qtuMXjfL2LpHSRqo4b4eSF5K/DH1JXKUAHSB2UW50g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "is-callable": "^1.2.7",
        "is-date-object": "^1.0.5",
        "is-symbol": "^1.0.4"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/escalade": {
      "version": "3.2.0",
      "resolved": "https://registry.npmjs.org/escalade/-/escalade-3.2.0.tgz",
      "integrity": "sha512-WUj2qlxaQtO4g6Pq5c29GTcWGDyd8itL8zTlipgECz3JesAiiOKotd8JU6otB3PACgG6xkJUyVhboMS+bje/jA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/escape-string-regexp": {
      "version": "4.0.0",
      "resolved": "https://registry.npmjs.org/escape-string-regexp/-/escape-string-regexp-4.0.0.tgz",
      "integrity": "sha512-TtpcNJ3XAzx3Gq8sWRzJaVajRs0uVxA2YAkdb1jm2YkPz4G6egUFAyA3n5vtEIZefPk5Wa4UXbKuS5fKkJWdgA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/eslint": {
      "version": "9.39.1",
      "resolved": "https://registry.npmjs.org/eslint/-/eslint-9.39.1.tgz",
      "integrity": "sha512-BhHmn2yNOFA9H9JmmIVKJmd288g9hrVRDkdoIgRCRuSySRUHH7r/DI6aAXW9T1WwUuY3DFgrcaqB+deURBLR5g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@eslint-community/eslint-utils": "^4.8.0",
        "@eslint-community/regexpp": "^4.12.1",
        "@eslint/config-array": "^0.21.1",
        "@eslint/config-helpers": "^0.4.2",
        "@eslint/core": "^0.17.0",
        "@eslint/eslintrc": "^3.3.1",
        "@eslint/js": "9.39.1",
        "@eslint/plugin-kit": "^0.4.1",
        "@humanfs/node": "^0.16.6",
        "@humanwhocodes/module-importer": "^1.0.1",
        "@humanwhocodes/retry": "^0.4.2",
        "@types/estree": "^1.0.6",
        "ajv": "^6.12.4",
        "chalk": "^4.0.0",
        "cross-spawn": "^7.0.6",
        "debug": "^4.3.2",
        "escape-string-regexp": "^4.0.0",
        "eslint-scope": "^8.4.0",
        "eslint-visitor-keys": "^4.2.1",
        "espree": "^10.4.0",
        "esquery": "^1.5.0",
        "esutils": "^2.0.2",
        "fast-deep-equal": "^3.1.3",
        "file-entry-cache": "^8.0.0",
        "find-up": "^5.0.0",
        "glob-parent": "^6.0.2",
        "ignore": "^5.2.0",
        "imurmurhash": "^0.1.4",
        "is-glob": "^4.0.0",
        "json-stable-stringify-without-jsonify": "^1.0.1",
        "lodash.merge": "^4.6.2",
        "minimatch": "^3.1.2",
        "natural-compare": "^1.4.0",
        "optionator": "^0.9.3"
      },
      "bin": {
        "eslint": "bin/eslint.js"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "url": "https://eslint.org/donate"
      },
      "peerDependencies": {
        "jiti": "*"
      },
      "peerDependenciesMeta": {
        "jiti": {
          "optional": true
        }
      }
    },
    "node_modules/eslint-config-next": {
      "version": "16.0.3",
      "resolved": "https://registry.npmjs.org/eslint-config-next/-/eslint-config-next-16.0.3.tgz",
      "integrity": "sha512-5F6qDjcZldf0Y0ZbqvWvap9xzYUxyDf7/of37aeyhvkrQokj/4bT1JYWZdlWUr283aeVa+s52mPq9ogmGg+5dw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@next/eslint-plugin-next": "16.0.3",
        "eslint-import-resolver-node": "^0.3.6",
        "eslint-import-resolver-typescript": "^3.5.2",
        "eslint-plugin-import": "^2.32.0",
        "eslint-plugin-jsx-a11y": "^6.10.0",
        "eslint-plugin-react": "^7.37.0",
        "eslint-plugin-react-hooks": "^7.0.0",
        "globals": "16.4.0",
        "typescript-eslint": "^8.46.0"
      },
      "peerDependencies": {
        "eslint": ">=9.0.0",
        "typescript": ">=3.3.1"
      },
      "peerDependenciesMeta": {
        "typescript": {
          "optional": true
        }
      }
    },
    "node_modules/eslint-config-next/node_modules/globals": {
      "version": "16.4.0",
      "resolved": "https://registry.npmjs.org/globals/-/globals-16.4.0.tgz",
      "integrity": "sha512-ob/2LcVVaVGCYN+r14cnwnoDPUufjiYgSqRhiFD0Q1iI4Odora5RE8Iv1D24hAz5oMophRGkGz+yuvQmmUMnMw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=18"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/eslint-import-resolver-node": {
      "version": "0.3.9",
      "resolved": "https://registry.npmjs.org/eslint-import-resolver-node/-/eslint-import-resolver-node-0.3.9.tgz",
      "integrity": "sha512-WFj2isz22JahUv+B788TlO3N6zL3nNJGU8CcZbPZvVEkBPaJdCV4vy5wyghty5ROFbCRnm132v8BScu5/1BQ8g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "debug": "^3.2.7",
        "is-core-module": "^2.13.0",
        "resolve": "^1.22.4"
      }
    },
    "node_modules/eslint-import-resolver-node/node_modules/debug": {
      "version": "3.2.7",
      "resolved": "https://registry.npmjs.org/debug/-/debug-3.2.7.tgz",
      "integrity": "sha512-CFjzYYAi4ThfiQvizrFQevTTXHtnCqWfe7x1AhgEscTz6ZbLbfoLRLPugTQyBth6f8ZERVUSyWHFD/7Wu4t1XQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "ms": "^2.1.1"
      }
    },
    "node_modules/eslint-import-resolver-typescript": {
      "version": "3.10.1",
      "resolved": "https://registry.npmjs.org/eslint-import-resolver-typescript/-/eslint-import-resolver-typescript-3.10.1.tgz",
      "integrity": "sha512-A1rHYb06zjMGAxdLSkN2fXPBwuSaQ0iO5M/hdyS0Ajj1VBaRp0sPD3dn1FhME3c/JluGFbwSxyCfqdSbtQLAHQ==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "@nolyfill/is-core-module": "1.0.39",
        "debug": "^4.4.0",
        "get-tsconfig": "^4.10.0",
        "is-bun-module": "^2.0.0",
        "stable-hash": "^0.0.5",
        "tinyglobby": "^0.2.13",
        "unrs-resolver": "^1.6.2"
      },
      "engines": {
        "node": "^14.18.0 || >=16.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/eslint-import-resolver-typescript"
      },
      "peerDependencies": {
        "eslint": "*",
        "eslint-plugin-import": "*",
        "eslint-plugin-import-x": "*"
      },
      "peerDependenciesMeta": {
        "eslint-plugin-import": {
          "optional": true
        },
        "eslint-plugin-import-x": {
          "optional": true
        }
      }
    },
    "node_modules/eslint-module-utils": {
      "version": "2.12.1",
      "resolved": "https://registry.npmjs.org/eslint-module-utils/-/eslint-module-utils-2.12.1.tgz",
      "integrity": "sha512-L8jSWTze7K2mTg0vos/RuLRS5soomksDPoJLXIslC7c8Wmut3bx7CPpJijDcBZtxQ5lrbUdM+s0OlNbz0DCDNw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "debug": "^3.2.7"
      },
      "engines": {
        "node": ">=4"
      },
      "peerDependenciesMeta": {
        "eslint": {
          "optional": true
        }
      }
    },
    "node_modules/eslint-module-utils/node_modules/debug": {
      "version": "3.2.7",
      "resolved": "https://registry.npmjs.org/debug/-/debug-3.2.7.tgz",
      "integrity": "sha512-CFjzYYAi4ThfiQvizrFQevTTXHtnCqWfe7x1AhgEscTz6ZbLbfoLRLPugTQyBth6f8ZERVUSyWHFD/7Wu4t1XQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "ms": "^2.1.1"
      }
    },
    "node_modules/eslint-plugin-import": {
      "version": "2.32.0",
      "resolved": "https://registry.npmjs.org/eslint-plugin-import/-/eslint-plugin-import-2.32.0.tgz",
      "integrity": "sha512-whOE1HFo/qJDyX4SnXzP4N6zOWn79WhnCUY/iDR0mPfQZO8wcYE4JClzI2oZrhBnnMUCBCHZhO6VQyoBU95mZA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@rtsao/scc": "^1.1.0",
        "array-includes": "^3.1.9",
        "array.prototype.findlastindex": "^1.2.6",
        "array.prototype.flat": "^1.3.3",
        "array.prototype.flatmap": "^1.3.3",
        "debug": "^3.2.7",
        "doctrine": "^2.1.0",
        "eslint-import-resolver-node": "^0.3.9",
        "eslint-module-utils": "^2.12.1",
        "hasown": "^2.0.2",
        "is-core-module": "^2.16.1",
        "is-glob": "^4.0.3",
        "minimatch": "^3.1.2",
        "object.fromentries": "^2.0.8",
        "object.groupby": "^1.0.3",
        "object.values": "^1.2.1",
        "semver": "^6.3.1",
        "string.prototype.trimend": "^1.0.9",
        "tsconfig-paths": "^3.15.0"
      },
      "engines": {
        "node": ">=4"
      },
      "peerDependencies": {
        "eslint": "^2 || ^3 || ^4 || ^5 || ^6 || ^7.2.0 || ^8 || ^9"
      }
    },
    "node_modules/eslint-plugin-import/node_modules/debug": {
      "version": "3.2.7",
      "resolved": "https://registry.npmjs.org/debug/-/debug-3.2.7.tgz",
      "integrity": "sha512-CFjzYYAi4ThfiQvizrFQevTTXHtnCqWfe7x1AhgEscTz6ZbLbfoLRLPugTQyBth6f8ZERVUSyWHFD/7Wu4t1XQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "ms": "^2.1.1"
      }
    },
    "node_modules/eslint-plugin-jsx-a11y": {
      "version": "6.10.2",
      "resolved": "https://registry.npmjs.org/eslint-plugin-jsx-a11y/-/eslint-plugin-jsx-a11y-6.10.2.tgz",
      "integrity": "sha512-scB3nz4WmG75pV8+3eRUQOHZlNSUhFNq37xnpgRkCCELU3XMvXAxLk1eqWWyE22Ki4Q01Fnsw9BA3cJHDPgn2Q==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "aria-query": "^5.3.2",
        "array-includes": "^3.1.8",
        "array.prototype.flatmap": "^1.3.2",
        "ast-types-flow": "^0.0.8",
        "axe-core": "^4.10.0",
        "axobject-query": "^4.1.0",
        "damerau-levenshtein": "^1.0.8",
        "emoji-regex": "^9.2.2",
        "hasown": "^2.0.2",
        "jsx-ast-utils": "^3.3.5",
        "language-tags": "^1.0.9",
        "minimatch": "^3.1.2",
        "object.fromentries": "^2.0.8",
        "safe-regex-test": "^1.0.3",
        "string.prototype.includes": "^2.0.1"
      },
      "engines": {
        "node": ">=4.0"
      },
      "peerDependencies": {
        "eslint": "^3 || ^4 || ^5 || ^6 || ^7 || ^8 || ^9"
      }
    },
    "node_modules/eslint-plugin-react": {
      "version": "7.37.5",
      "resolved": "https://registry.npmjs.org/eslint-plugin-react/-/eslint-plugin-react-7.37.5.tgz",
      "integrity": "sha512-Qteup0SqU15kdocexFNAJMvCJEfa2xUKNV4CC1xsVMrIIqEy3SQ/rqyxCWNzfrd3/ldy6HMlD2e0JDVpDg2qIA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "array-includes": "^3.1.8",
        "array.prototype.findlast": "^1.2.5",
        "array.prototype.flatmap": "^1.3.3",
        "array.prototype.tosorted": "^1.1.4",
        "doctrine": "^2.1.0",
        "es-iterator-helpers": "^1.2.1",
        "estraverse": "^5.3.0",
        "hasown": "^2.0.2",
        "jsx-ast-utils": "^2.4.1 || ^3.0.0",
        "minimatch": "^3.1.2",
        "object.entries": "^1.1.9",
        "object.fromentries": "^2.0.8",
        "object.values": "^1.2.1",
        "prop-types": "^15.8.1",
        "resolve": "^2.0.0-next.5",
        "semver": "^6.3.1",
        "string.prototype.matchall": "^4.0.12",
        "string.prototype.repeat": "^1.0.0"
      },
      "engines": {
        "node": ">=4"
      },
      "peerDependencies": {
        "eslint": "^3 || ^4 || ^5 || ^6 || ^7 || ^8 || ^9.7"
      }
    },
    "node_modules/eslint-plugin-react-hooks": {
      "version": "7.0.1",
      "resolved": "https://registry.npmjs.org/eslint-plugin-react-hooks/-/eslint-plugin-react-hooks-7.0.1.tgz",
      "integrity": "sha512-O0d0m04evaNzEPoSW+59Mezf8Qt0InfgGIBJnpC0h3NH/WjUAR7BIKUfysC6todmtiZ/A0oUVS8Gce0WhBrHsA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/core": "^7.24.4",
        "@babel/parser": "^7.24.4",
        "hermes-parser": "^0.25.1",
        "zod": "^3.25.0 || ^4.0.0",
        "zod-validation-error": "^3.5.0 || ^4.0.0"
      },
      "engines": {
        "node": ">=18"
      },
      "peerDependencies": {
        "eslint": "^3.0.0 || ^4.0.0 || ^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0-0 || ^9.0.0"
      }
    },
    "node_modules/eslint-plugin-react/node_modules/resolve": {
      "version": "2.0.0-next.5",
      "resolved": "https://registry.npmjs.org/resolve/-/resolve-2.0.0-next.5.tgz",
      "integrity": "sha512-U7WjGVG9sH8tvjW5SmGbQuui75FiyjAX72HX15DwBBwF9dNiQZRQAg9nnPhYy+TUnE0+VcrttuvNI8oSxZcocA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "is-core-module": "^2.13.0",
        "path-parse": "^1.0.7",
        "supports-preserve-symlinks-flag": "^1.0.0"
      },
      "bin": {
        "resolve": "bin/resolve"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/eslint-scope": {
      "version": "8.4.0",
      "resolved": "https://registry.npmjs.org/eslint-scope/-/eslint-scope-8.4.0.tgz",
      "integrity": "sha512-sNXOfKCn74rt8RICKMvJS7XKV/Xk9kA7DyJr8mJik3S7Cwgy3qlkkmyS2uQB3jiJg6VNdZd/pDBJu0nvG2NlTg==",
      "dev": true,
      "license": "BSD-2-Clause",
      "dependencies": {
        "esrecurse": "^4.3.0",
        "estraverse": "^5.2.0"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "url": "https://opencollective.com/eslint"
      }
    },
    "node_modules/eslint-visitor-keys": {
      "version": "4.2.1",
      "resolved": "https://registry.npmjs.org/eslint-visitor-keys/-/eslint-visitor-keys-4.2.1.tgz",
      "integrity": "sha512-Uhdk5sfqcee/9H/rCOJikYz67o0a2Tw2hGRPOG2Y1R2dg7brRe1uG0yaNQDHu+TO/uQPF/5eCapvYSmHUjt7JQ==",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "url": "https://opencollective.com/eslint"
      }
    },
    "node_modules/espree": {
      "version": "10.4.0",
      "resolved": "https://registry.npmjs.org/espree/-/espree-10.4.0.tgz",
      "integrity": "sha512-j6PAQ2uUr79PZhBjP5C5fhl8e39FmRnOjsD5lGnWrFU8i2G776tBK7+nP8KuQUTTyAZUwfQqXAgrVH5MbH9CYQ==",
      "dev": true,
      "license": "BSD-2-Clause",
      "dependencies": {
        "acorn": "^8.15.0",
        "acorn-jsx": "^5.3.2",
        "eslint-visitor-keys": "^4.2.1"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "url": "https://opencollective.com/eslint"
      }
    },
    "node_modules/esquery": {
      "version": "1.6.0",
      "resolved": "https://registry.npmjs.org/esquery/-/esquery-1.6.0.tgz",
      "integrity": "sha512-ca9pw9fomFcKPvFLXhBKUK90ZvGibiGOvRJNbjljY7s7uq/5YO4BOzcYtJqExdx99rF6aAcnRxHmcUHcz6sQsg==",
      "dev": true,
      "license": "BSD-3-Clause",
      "dependencies": {
        "estraverse": "^5.1.0"
      },
      "engines": {
        "node": ">=0.10"
      }
    },
    "node_modules/esrecurse": {
      "version": "4.3.0",
      "resolved": "https://registry.npmjs.org/esrecurse/-/esrecurse-4.3.0.tgz",
      "integrity": "sha512-KmfKL3b6G+RXvP8N1vr3Tq1kL/oCFgn2NYXEtqP8/L3pKapUA4G8cFVaoF3SU323CD4XypR/ffioHmkti6/Tag==",
      "dev": true,
      "license": "BSD-2-Clause",
      "dependencies": {
        "estraverse": "^5.2.0"
      },
      "engines": {
        "node": ">=4.0"
      }
    },
    "node_modules/estraverse": {
      "version": "5.3.0",
      "resolved": "https://registry.npmjs.org/estraverse/-/estraverse-5.3.0.tgz",
      "integrity": "sha512-MMdARuVEQziNTeJD8DgMqmhwR11BRQ/cBP+pLtYdSTnf3MIO8fFeiINEbX36ZdNlfU/7A9f3gUw49B3oQsvwBA==",
      "dev": true,
      "license": "BSD-2-Clause",
      "engines": {
        "node": ">=4.0"
      }
    },
    "node_modules/esutils": {
      "version": "2.0.3",
      "resolved": "https://registry.npmjs.org/esutils/-/esutils-2.0.3.tgz",
      "integrity": "sha512-kVscqXk4OCp68SZ0dkgEKVi6/8ij300KBWTJq32P/dYeWTSwK41WyTxalN1eRmA5Z9UU/LX9D7FWSmV9SAYx6g==",
      "dev": true,
      "license": "BSD-2-Clause",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/fast-deep-equal": {
      "version": "3.1.3",
      "resolved": "https://registry.npmjs.org/fast-deep-equal/-/fast-deep-equal-3.1.3.tgz",
      "integrity": "sha512-f3qQ9oQy9j2AhBe/H9VC91wLmKBCCU/gDOnKNAYG5hswO7BLKj09Hc5HYNz9cGI++xlpDCIgDaitVs03ATR84Q==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/fast-glob": {
      "version": "3.3.1",
      "resolved": "https://registry.npmjs.org/fast-glob/-/fast-glob-3.3.1.tgz",
      "integrity": "sha512-kNFPyjhh5cKjrUltxs+wFx+ZkbRaxxmZ+X0ZU31SOsxCEtP9VPgtq2teZw1DebupL5GmDaNQ6yKMMVcM41iqDg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@nodelib/fs.stat": "^2.0.2",
        "@nodelib/fs.walk": "^1.2.3",
        "glob-parent": "^5.1.2",
        "merge2": "^1.3.0",
        "micromatch": "^4.0.4"
      },
      "engines": {
        "node": ">=8.6.0"
      }
    },
    "node_modules/fast-glob/node_modules/glob-parent": {
      "version": "5.1.2",
      "resolved": "https://registry.npmjs.org/glob-parent/-/glob-parent-5.1.2.tgz",
      "integrity": "sha512-AOIgSQCepiJYwP3ARnGx+5VnTu2HBYdzbGP45eLw1vr3zB3vZLeyed1sC9hnbcOc9/SrMyM5RPQrkGz4aS9Zow==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "is-glob": "^4.0.1"
      },
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/fast-json-stable-stringify": {
      "version": "2.1.0",
      "resolved": "https://registry.npmjs.org/fast-json-stable-stringify/-/fast-json-stable-stringify-2.1.0.tgz",
      "integrity": "sha512-lhd/wF+Lk98HZoTCtlVraHtfh5XYijIjalXck7saUtuanSDyLMxnHhSXEDJqHxD7msR8D0uCmqlkwjCV8xvwHw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/fast-levenshtein": {
      "version": "2.0.6",
      "resolved": "https://registry.npmjs.org/fast-levenshtein/-/fast-levenshtein-2.0.6.tgz",
      "integrity": "sha512-DCXu6Ifhqcks7TZKY3Hxp3y6qphY5SJZmrWMDrKcERSOXWQdMhU9Ig/PYrzyw/ul9jOIyh0N4M0tbC5hodg8dw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/fastq": {
      "version": "1.19.1",
      "resolved": "https://registry.npmjs.org/fastq/-/fastq-1.19.1.tgz",
      "integrity": "sha512-GwLTyxkCXjXbxqIhTsMI2Nui8huMPtnxg7krajPJAjnEG/iiOS7i+zCtWGZR9G0NBKbXKh6X9m9UIsYX/N6vvQ==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "reusify": "^1.0.4"
      }
    },
    "node_modules/file-entry-cache": {
      "version": "8.0.0",
      "resolved": "https://registry.npmjs.org/file-entry-cache/-/file-entry-cache-8.0.0.tgz",
      "integrity": "sha512-XXTUwCvisa5oacNGRP9SfNtYBNAMi+RPwBFmblZEF7N7swHYQS6/Zfk7SRwx4D5j3CH211YNRco1DEMNVfZCnQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "flat-cache": "^4.0.0"
      },
      "engines": {
        "node": ">=16.0.0"
      }
    },
    "node_modules/fill-range": {
      "version": "7.1.1",
      "resolved": "https://registry.npmjs.org/fill-range/-/fill-range-7.1.1.tgz",
      "integrity": "sha512-YsGpe3WHLK8ZYi4tWDg2Jy3ebRz2rXowDxnld4bkQB00cc/1Zw9AWnC0i9ztDJitivtQvaI9KaLyKrc+hBW0yg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "to-regex-range": "^5.0.1"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/find-up": {
      "version": "5.0.0",
      "resolved": "https://registry.npmjs.org/find-up/-/find-up-5.0.0.tgz",
      "integrity": "sha512-78/PXT1wlLLDgTzDs7sjq9hzz0vXD+zn+7wypEe4fXQxCmdmqfGsEPQxmiCSQI3ajFV91bVSsvNtrJRiW6nGng==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "locate-path": "^6.0.0",
        "path-exists": "^4.0.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/flat-cache": {
      "version": "4.0.1",
      "resolved": "https://registry.npmjs.org/flat-cache/-/flat-cache-4.0.1.tgz",
      "integrity": "sha512-f7ccFPK3SXFHpx15UIGyRJ/FJQctuKZ0zVuN3frBo4HnK3cay9VEW0R6yPYFHC0AgqhukPzKjq22t5DmAyqGyw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "flatted": "^3.2.9",
        "keyv": "^4.5.4"
      },
      "engines": {
        "node": ">=16"
      }
    },
    "node_modules/flatted": {
      "version": "3.3.3",
      "resolved": "https://registry.npmjs.org/flatted/-/flatted-3.3.3.tgz",
      "integrity": "sha512-GX+ysw4PBCz0PzosHDepZGANEuFCMLrnRTiEy9McGjmkCQYwRq4A/X786G/fjM/+OjsWSU1ZrY5qyARZmO/uwg==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/for-each": {
      "version": "0.3.5",
      "resolved": "https://registry.npmjs.org/for-each/-/for-each-0.3.5.tgz",
      "integrity": "sha512-dKx12eRCVIzqCxFGplyFKJMPvLEWgmNtUrpTiJIR5u97zEhRG8ySrtboPHZXx7daLxQVrl643cTzbab2tkQjxg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "is-callable": "^1.2.7"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/function-bind": {
      "version": "1.1.2",
      "resolved": "https://registry.npmjs.org/function-bind/-/function-bind-1.1.2.tgz",
      "integrity": "sha512-7XHNxH7qX9xG5mIwxkhumTox/MIRNcOgDrxWsMt2pAr23WHp6MrRlN7FBSFpCpr+oVO0F744iUgR82nJMfG2SA==",
      "dev": true,
      "license": "MIT",
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/function.prototype.name": {
      "version": "1.1.8",
      "resolved": "https://registry.npmjs.org/function.prototype.name/-/function.prototype.name-1.1.8.tgz",
      "integrity": "sha512-e5iwyodOHhbMr/yNrc7fDYG4qlbIvI5gajyzPnb5TCwyhjApznQh1BMFou9b30SevY43gCJKXycoCBjMbsuW0Q==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.8",
        "call-bound": "^1.0.3",
        "define-properties": "^1.2.1",
        "functions-have-names": "^1.2.3",
        "hasown": "^2.0.2",
        "is-callable": "^1.2.7"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/functions-have-names": {
      "version": "1.2.3",
      "resolved": "https://registry.npmjs.org/functions-have-names/-/functions-have-names-1.2.3.tgz",
      "integrity": "sha512-xckBUXyTIqT97tq2x2AMb+g163b5JFysYk0x4qxNFwbfQkmNZoiRHb6sPzI9/QV33WeuvVYBUIiD4NzNIyqaRQ==",
      "dev": true,
      "license": "MIT",
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/generator-function": {
      "version": "2.0.1",
      "resolved": "https://registry.npmjs.org/generator-function/-/generator-function-2.0.1.tgz",
      "integrity": "sha512-SFdFmIJi+ybC0vjlHN0ZGVGHc3lgE0DxPAT0djjVg+kjOnSqclqmj0KQ7ykTOLP6YxoqOvuAODGdcHJn+43q3g==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/gensync": {
      "version": "1.0.0-beta.2",
      "resolved": "https://registry.npmjs.org/gensync/-/gensync-1.0.0-beta.2.tgz",
      "integrity": "sha512-3hN7NaskYvMDLQY55gnW3NQ+mesEAepTqlg+VEbj7zzqEMBVNhzcGYYeqFo/TlYz6eQiFcp1HcsCZO+nGgS8zg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/get-intrinsic": {
      "version": "1.3.0",
      "resolved": "https://registry.npmjs.org/get-intrinsic/-/get-intrinsic-1.3.0.tgz",
      "integrity": "sha512-9fSjSaos/fRIVIp+xSJlE6lfwhES7LNtKaCBIamHsjr2na1BiABJPo0mOjjz8GJDURarmCPGqaiVg5mfjb98CQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind-apply-helpers": "^1.0.2",
        "es-define-property": "^1.0.1",
        "es-errors": "^1.3.0",
        "es-object-atoms": "^1.1.1",
        "function-bind": "^1.1.2",
        "get-proto": "^1.0.1",
        "gopd": "^1.2.0",
        "has-symbols": "^1.1.0",
        "hasown": "^2.0.2",
        "math-intrinsics": "^1.1.0"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/get-proto": {
      "version": "1.0.1",
      "resolved": "https://registry.npmjs.org/get-proto/-/get-proto-1.0.1.tgz",
      "integrity": "sha512-sTSfBjoXBp89JvIKIefqw7U2CCebsc74kiY6awiGogKtoSGbgjYE/G/+l9sF3MWFPNc9IcoOC4ODfKHfxFmp0g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "dunder-proto": "^1.0.1",
        "es-object-atoms": "^1.0.0"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/get-symbol-description": {
      "version": "1.1.0",
      "resolved": "https://registry.npmjs.org/get-symbol-description/-/get-symbol-description-1.1.0.tgz",
      "integrity": "sha512-w9UMqWwJxHNOvoNzSJ2oPF5wvYcvP7jUvYzhp67yEhTi17ZDBBC1z9pTdGuzjD+EFIqLSYRweZjqfiPzQ06Ebg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.3",
        "es-errors": "^1.3.0",
        "get-intrinsic": "^1.2.6"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/get-tsconfig": {
      "version": "4.13.0",
      "resolved": "https://registry.npmjs.org/get-tsconfig/-/get-tsconfig-4.13.0.tgz",
      "integrity": "sha512-1VKTZJCwBrvbd+Wn3AOgQP/2Av+TfTCOlE4AcRJE72W1ksZXbAx8PPBR9RzgTeSPzlPMHrbANMH3LbltH73wxQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "resolve-pkg-maps": "^1.0.0"
      },
      "funding": {
        "url": "https://github.com/privatenumber/get-tsconfig?sponsor=1"
      }
    },
    "node_modules/glob-parent": {
      "version": "6.0.2",
      "resolved": "https://registry.npmjs.org/glob-parent/-/glob-parent-6.0.2.tgz",
      "integrity": "sha512-XxwI8EOhVQgWp6iDL+3b0r86f4d6AX6zSU55HfB4ydCEuXLXc5FcYeOu+nnGftS4TEju/11rt4KJPTMgbfmv4A==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "is-glob": "^4.0.3"
      },
      "engines": {
        "node": ">=10.13.0"
      }
    },
    "node_modules/globals": {
      "version": "14.0.0",
      "resolved": "https://registry.npmjs.org/globals/-/globals-14.0.0.tgz",
      "integrity": "sha512-oahGvuMGQlPw/ivIYBjVSrWAfWLBeku5tpPE2fOPLi+WHffIWbuh2tCjhyQhTBPMf5E9jDEH4FOmTYgYwbKwtQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=18"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/globalthis": {
      "version": "1.0.4",
      "resolved": "https://registry.npmjs.org/globalthis/-/globalthis-1.0.4.tgz",
      "integrity": "sha512-DpLKbNU4WylpxJykQujfCcwYWiV/Jhm50Goo0wrVILAv5jOr9d+H+UR3PhSCD2rCCEIg0uc+G+muBTwD54JhDQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "define-properties": "^1.2.1",
        "gopd": "^1.0.1"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/gopd": {
      "version": "1.2.0",
      "resolved": "https://registry.npmjs.org/gopd/-/gopd-1.2.0.tgz",
      "integrity": "sha512-ZUKRh6/kUFoAiTAtTYPZJ3hw9wNxx+BIBOijnlG9PnrJsCcSjs1wyyD6vJpaYtgnzDrKYRSqf3OO6Rfa93xsRg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/graceful-fs": {
      "version": "4.2.11",
      "resolved": "https://registry.npmjs.org/graceful-fs/-/graceful-fs-4.2.11.tgz",
      "integrity": "sha512-RbJ5/jmFcNNCcDV5o9eTnBLJ/HszWV0P73bc+Ff4nS/rJj+YaS6IGyiOL0VoBYX+l1Wrl3k63h/KrH+nhJ0XvQ==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/graphemer": {
      "version": "1.4.0",
      "resolved": "https://registry.npmjs.org/graphemer/-/graphemer-1.4.0.tgz",
      "integrity": "sha512-EtKwoO6kxCL9WO5xipiHTZlSzBm7WLT627TqC/uVRd0HKmq8NXyebnNYxDoBi7wt8eTWrUrKXCOVaFq9x1kgag==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/has-bigints": {
      "version": "1.1.0",
      "resolved": "https://registry.npmjs.org/has-bigints/-/has-bigints-1.1.0.tgz",
      "integrity": "sha512-R3pbpkcIqv2Pm3dUwgjclDRVmWpTJW2DcMzcIhEXEx1oh/CEMObMm3KLmRJOdvhM7o4uQBnwr8pzRK2sJWIqfg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/has-flag": {
      "version": "4.0.0",
      "resolved": "https://registry.npmjs.org/has-flag/-/has-flag-4.0.0.tgz",
      "integrity": "sha512-EykJT/Q1KjTWctppgIAgfSO0tKVuZUjhgMr17kqTumMl6Afv3EISleU7qZUzoXDFTAHTDC4NOoG/ZxU3EvlMPQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/has-property-descriptors": {
      "version": "1.0.2",
      "resolved": "https://registry.npmjs.org/has-property-descriptors/-/has-property-descriptors-1.0.2.tgz",
      "integrity": "sha512-55JNKuIW+vq4Ke1BjOTjM2YctQIvCT7GFzHwmfZPGo5wnrgkid0YQtnAleFSqumZm4az3n2BS+erby5ipJdgrg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "es-define-property": "^1.0.0"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/has-proto": {
      "version": "1.2.0",
      "resolved": "https://registry.npmjs.org/has-proto/-/has-proto-1.2.0.tgz",
      "integrity": "sha512-KIL7eQPfHQRC8+XluaIw7BHUwwqL19bQn4hzNgdr+1wXoU0KKj6rufu47lhY7KbJR2C6T6+PfyN0Ea7wkSS+qQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "dunder-proto": "^1.0.0"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/has-symbols": {
      "version": "1.1.0",
      "resolved": "https://registry.npmjs.org/has-symbols/-/has-symbols-1.1.0.tgz",
      "integrity": "sha512-1cDNdwJ2Jaohmb3sg4OmKaMBwuC48sYni5HUw2DvsC8LjGTLK9h+eb1X6RyuOHe4hT0ULCW68iomhjUoKUqlPQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/has-tostringtag": {
      "version": "1.0.2",
      "resolved": "https://registry.npmjs.org/has-tostringtag/-/has-tostringtag-1.0.2.tgz",
      "integrity": "sha512-NqADB8VjPFLM2V0VvHUewwwsw0ZWBaIdgo+ieHtK3hasLz4qeCRjYcqfB6AQrBggRKppKF8L52/VqdVsO47Dlw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "has-symbols": "^1.0.3"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/hasown": {
      "version": "2.0.2",
      "resolved": "https://registry.npmjs.org/hasown/-/hasown-2.0.2.tgz",
      "integrity": "sha512-0hJU9SCPvmMzIBdZFqNPXWa6dqh7WdH0cII9y+CyS8rG3nL48Bclra9HmKhVVUHyPWNH5Y7xDwAB7bfgSjkUMQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "function-bind": "^1.1.2"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/hermes-estree": {
      "version": "0.25.1",
      "resolved": "https://registry.npmjs.org/hermes-estree/-/hermes-estree-0.25.1.tgz",
      "integrity": "sha512-0wUoCcLp+5Ev5pDW2OriHC2MJCbwLwuRx+gAqMTOkGKJJiBCLjtrvy4PWUGn6MIVefecRpzoOZ/UV6iGdOr+Cw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/hermes-parser": {
      "version": "0.25.1",
      "resolved": "https://registry.npmjs.org/hermes-parser/-/hermes-parser-0.25.1.tgz",
      "integrity": "sha512-6pEjquH3rqaI6cYAXYPcz9MS4rY6R4ngRgrgfDshRptUZIc3lw0MCIJIGDj9++mfySOuPTHB4nrSW99BCvOPIA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "hermes-estree": "0.25.1"
      }
    },
    "node_modules/ignore": {
      "version": "5.3.2",
      "resolved": "https://registry.npmjs.org/ignore/-/ignore-5.3.2.tgz",
      "integrity": "sha512-hsBTNUqQTDwkWtcdYI2i06Y/nUBEsNEDJKjWdigLvegy8kDuJAS8uRlpkkcQpyEXL0Z/pjDy5HBmMjRCJ2gq+g==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 4"
      }
    },
    "node_modules/import-fresh": {
      "version": "3.3.1",
      "resolved": "https://registry.npmjs.org/import-fresh/-/import-fresh-3.3.1.tgz",
      "integrity": "sha512-TR3KfrTZTYLPB6jUjfx6MF9WcWrHL9su5TObK4ZkYgBdWKPOFoSoQIdEuTuR82pmtxH2spWG9h6etwfr1pLBqQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "parent-module": "^1.0.0",
        "resolve-from": "^4.0.0"
      },
      "engines": {
        "node": ">=6"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/imurmurhash": {
      "version": "0.1.4",
      "resolved": "https://registry.npmjs.org/imurmurhash/-/imurmurhash-0.1.4.tgz",
      "integrity": "sha512-JmXMZ6wuvDmLiHEml9ykzqO6lwFbof0GG4IkcGaENdCRDDmMVnny7s5HsIgHCbaq0w2MyPhDqkhTUgS2LU2PHA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.8.19"
      }
    },
    "node_modules/internal-slot": {
      "version": "1.1.0",
      "resolved": "https://registry.npmjs.org/internal-slot/-/internal-slot-1.1.0.tgz",
      "integrity": "sha512-4gd7VpWNQNB4UKKCFFVcp1AVv+FMOgs9NKzjHKusc8jTMhd5eL1NqQqOpE0KzMds804/yHlglp3uxgluOqAPLw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "es-errors": "^1.3.0",
        "hasown": "^2.0.2",
        "side-channel": "^1.1.0"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/is-array-buffer": {
      "version": "3.0.5",
      "resolved": "https://registry.npmjs.org/is-array-buffer/-/is-array-buffer-3.0.5.tgz",
      "integrity": "sha512-DDfANUiiG2wC1qawP66qlTugJeL5HyzMpfr8lLK+jMQirGzNod0B12cFB/9q838Ru27sBwfw78/rdoU7RERz6A==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.8",
        "call-bound": "^1.0.3",
        "get-intrinsic": "^1.2.6"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-async-function": {
      "version": "2.1.1",
      "resolved": "https://registry.npmjs.org/is-async-function/-/is-async-function-2.1.1.tgz",
      "integrity": "sha512-9dgM/cZBnNvjzaMYHVoxxfPj2QXt22Ev7SuuPrs+xav0ukGB0S6d4ydZdEiM48kLx5kDV+QBPrpVnFyefL8kkQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "async-function": "^1.0.0",
        "call-bound": "^1.0.3",
        "get-proto": "^1.0.1",
        "has-tostringtag": "^1.0.2",
        "safe-regex-test": "^1.1.0"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-bigint": {
      "version": "1.1.0",
      "resolved": "https://registry.npmjs.org/is-bigint/-/is-bigint-1.1.0.tgz",
      "integrity": "sha512-n4ZT37wG78iz03xPRKJrHTdZbe3IicyucEtdRsV5yglwc3GyUfbAfpSeD0FJ41NbUNSt5wbhqfp1fS+BgnvDFQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "has-bigints": "^1.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-boolean-object": {
      "version": "1.2.2",
      "resolved": "https://registry.npmjs.org/is-boolean-object/-/is-boolean-object-1.2.2.tgz",
      "integrity": "sha512-wa56o2/ElJMYqjCjGkXri7it5FbebW5usLw/nPmCMs5DeZ7eziSYZhSmPRn0txqeW4LnAmQQU7FgqLpsEFKM4A==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.3",
        "has-tostringtag": "^1.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-bun-module": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/is-bun-module/-/is-bun-module-2.0.0.tgz",
      "integrity": "sha512-gNCGbnnnnFAUGKeZ9PdbyeGYJqewpmc2aKHUEMO5nQPWU9lOmv7jcmQIv+qHD8fXW6W7qfuCwX4rY9LNRjXrkQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "semver": "^7.7.1"
      }
    },
    "node_modules/is-bun-module/node_modules/semver": {
      "version": "7.7.3",
      "resolved": "https://registry.npmjs.org/semver/-/semver-7.7.3.tgz",
      "integrity": "sha512-SdsKMrI9TdgjdweUSR9MweHA4EJ8YxHn8DFaDisvhVlUOe4BF1tLD7GAj0lIqWVl+dPb/rExr0Btby5loQm20Q==",
      "dev": true,
      "license": "ISC",
      "bin": {
        "semver": "bin/semver.js"
      },
      "engines": {
        "node": ">=10"
      }
    },
    "node_modules/is-callable": {
      "version": "1.2.7",
      "resolved": "https://registry.npmjs.org/is-callable/-/is-callable-1.2.7.tgz",
      "integrity": "sha512-1BC0BVFhS/p0qtw6enp8e+8OD0UrK0oFLztSjNzhcKA3WDuJxxAPXzPuPtKkjEY9UUoEWlX/8fgKeu2S8i9JTA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-core-module": {
      "version": "2.16.1",
      "resolved": "https://registry.npmjs.org/is-core-module/-/is-core-module-2.16.1.tgz",
      "integrity": "sha512-UfoeMA6fIJ8wTYFEUjelnaGI67v6+N7qXJEvQuIGa99l4xsCruSYOVSQ0uPANn4dAzm8lkYPaKLrrijLq7x23w==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "hasown": "^2.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-data-view": {
      "version": "1.0.2",
      "resolved": "https://registry.npmjs.org/is-data-view/-/is-data-view-1.0.2.tgz",
      "integrity": "sha512-RKtWF8pGmS87i2D6gqQu/l7EYRlVdfzemCJN/P3UOs//x1QE7mfhvzHIApBTRf7axvT6DMGwSwBXYCT0nfB9xw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.2",
        "get-intrinsic": "^1.2.6",
        "is-typed-array": "^1.1.13"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-date-object": {
      "version": "1.1.0",
      "resolved": "https://registry.npmjs.org/is-date-object/-/is-date-object-1.1.0.tgz",
      "integrity": "sha512-PwwhEakHVKTdRNVOw+/Gyh0+MzlCl4R6qKvkhuvLtPMggI1WAHt9sOwZxQLSGpUaDnrdyDsomoRgNnCfKNSXXg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.2",
        "has-tostringtag": "^1.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-extglob": {
      "version": "2.1.1",
      "resolved": "https://registry.npmjs.org/is-extglob/-/is-extglob-2.1.1.tgz",
      "integrity": "sha512-SbKbANkN603Vi4jEZv49LeVJMn4yGwsbzZworEoyEiutsN3nJYdbO36zfhGJ6QEDpOZIFkDtnq5JRxmvl3jsoQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/is-finalizationregistry": {
      "version": "1.1.1",
      "resolved": "https://registry.npmjs.org/is-finalizationregistry/-/is-finalizationregistry-1.1.1.tgz",
      "integrity": "sha512-1pC6N8qWJbWoPtEjgcL2xyhQOP491EQjeUo3qTKcmV8YSDDJrOepfG8pcC7h/QgnQHYSv0mJ3Z/ZWxmatVrysg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.3"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-generator-function": {
      "version": "1.1.2",
      "resolved": "https://registry.npmjs.org/is-generator-function/-/is-generator-function-1.1.2.tgz",
      "integrity": "sha512-upqt1SkGkODW9tsGNG5mtXTXtECizwtS2kA161M+gJPc1xdb/Ax629af6YrTwcOeQHbewrPNlE5Dx7kzvXTizA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.4",
        "generator-function": "^2.0.0",
        "get-proto": "^1.0.1",
        "has-tostringtag": "^1.0.2",
        "safe-regex-test": "^1.1.0"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-glob": {
      "version": "4.0.3",
      "resolved": "https://registry.npmjs.org/is-glob/-/is-glob-4.0.3.tgz",
      "integrity": "sha512-xelSayHH36ZgE7ZWhli7pW34hNbNl8Ojv5KVmkJD4hBdD3th8Tfk9vYasLM+mXWOZhFkgZfxhLSnrwRr4elSSg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "is-extglob": "^2.1.1"
      },
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/is-map": {
      "version": "2.0.3",
      "resolved": "https://registry.npmjs.org/is-map/-/is-map-2.0.3.tgz",
      "integrity": "sha512-1Qed0/Hr2m+YqxnM09CjA2d/i6YZNfF6R2oRAOj36eUdS6qIV/huPJNSEpKbupewFs+ZsJlxsjjPbc0/afW6Lw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-negative-zero": {
      "version": "2.0.3",
      "resolved": "https://registry.npmjs.org/is-negative-zero/-/is-negative-zero-2.0.3.tgz",
      "integrity": "sha512-5KoIu2Ngpyek75jXodFvnafB6DJgr3u8uuK0LEZJjrU19DrMD3EVERaR8sjz8CCGgpZvxPl9SuE1GMVPFHx1mw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-number": {
      "version": "7.0.0",
      "resolved": "https://registry.npmjs.org/is-number/-/is-number-7.0.0.tgz",
      "integrity": "sha512-41Cifkg6e8TylSpdtTpeLVMqvSBEVzTttHvERD741+pnZ8ANv0004MRL43QKPDlK9cGvNp6NZWZUBlbGXYxxng==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.12.0"
      }
    },
    "node_modules/is-number-object": {
      "version": "1.1.1",
      "resolved": "https://registry.npmjs.org/is-number-object/-/is-number-object-1.1.1.tgz",
      "integrity": "sha512-lZhclumE1G6VYD8VHe35wFaIif+CTy5SJIi5+3y4psDgWu4wPDoBhF8NxUOinEc7pHgiTsT6MaBb92rKhhD+Xw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.3",
        "has-tostringtag": "^1.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-regex": {
      "version": "1.2.1",
      "resolved": "https://registry.npmjs.org/is-regex/-/is-regex-1.2.1.tgz",
      "integrity": "sha512-MjYsKHO5O7mCsmRGxWcLWheFqN9DJ/2TmngvjKXihe6efViPqc274+Fx/4fYj/r03+ESvBdTXK0V6tA3rgez1g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.2",
        "gopd": "^1.2.0",
        "has-tostringtag": "^1.0.2",
        "hasown": "^2.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-set": {
      "version": "2.0.3",
      "resolved": "https://registry.npmjs.org/is-set/-/is-set-2.0.3.tgz",
      "integrity": "sha512-iPAjerrse27/ygGLxw+EBR9agv9Y6uLeYVJMu+QNCoouJ1/1ri0mGrcWpfCqFZuzzx3WjtwxG098X+n4OuRkPg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-shared-array-buffer": {
      "version": "1.0.4",
      "resolved": "https://registry.npmjs.org/is-shared-array-buffer/-/is-shared-array-buffer-1.0.4.tgz",
      "integrity": "sha512-ISWac8drv4ZGfwKl5slpHG9OwPNty4jOWPRIhBpxOoD+hqITiwuipOQ2bNthAzwA3B4fIjO4Nln74N0S9byq8A==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.3"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-string": {
      "version": "1.1.1",
      "resolved": "https://registry.npmjs.org/is-string/-/is-string-1.1.1.tgz",
      "integrity": "sha512-BtEeSsoaQjlSPBemMQIrY1MY0uM6vnS1g5fmufYOtnxLGUZM2178PKbhsk7Ffv58IX+ZtcvoGwccYsh0PglkAA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.3",
        "has-tostringtag": "^1.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-symbol": {
      "version": "1.1.1",
      "resolved": "https://registry.npmjs.org/is-symbol/-/is-symbol-1.1.1.tgz",
      "integrity": "sha512-9gGx6GTtCQM73BgmHQXfDmLtfjjTUDSyoxTCbp5WtoixAhfgsDirWIcVQ/IHpvI5Vgd5i/J5F7B9cN/WlVbC/w==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.2",
        "has-symbols": "^1.1.0",
        "safe-regex-test": "^1.1.0"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-typed-array": {
      "version": "1.1.15",
      "resolved": "https://registry.npmjs.org/is-typed-array/-/is-typed-array-1.1.15.tgz",
      "integrity": "sha512-p3EcsicXjit7SaskXHs1hA91QxgTw46Fv6EFKKGS5DRFLD8yKnohjF3hxoju94b/OcMZoQukzpPpBE9uLVKzgQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "which-typed-array": "^1.1.16"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-weakmap": {
      "version": "2.0.2",
      "resolved": "https://registry.npmjs.org/is-weakmap/-/is-weakmap-2.0.2.tgz",
      "integrity": "sha512-K5pXYOm9wqY1RgjpL3YTkF39tni1XajUIkawTLUo9EZEVUFga5gSQJF8nNS7ZwJQ02y+1YCNYcMh+HIf1ZqE+w==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-weakref": {
      "version": "1.1.1",
      "resolved": "https://registry.npmjs.org/is-weakref/-/is-weakref-1.1.1.tgz",
      "integrity": "sha512-6i9mGWSlqzNMEqpCp93KwRS1uUOodk2OJ6b+sq7ZPDSy2WuI5NFIxp/254TytR8ftefexkWn5xNiHUNpPOfSew==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.3"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-weakset": {
      "version": "2.0.4",
      "resolved": "https://registry.npmjs.org/is-weakset/-/is-weakset-2.0.4.tgz",
      "integrity": "sha512-mfcwb6IzQyOKTs84CQMrOwW4gQcaTOAWJ0zzJCl2WSPDrWk/OzDaImWFH3djXhb24g4eudZfLRozAvPGw4d9hQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.3",
        "get-intrinsic": "^1.2.6"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/isarray": {
      "version": "2.0.5",
      "resolved": "https://registry.npmjs.org/isarray/-/isarray-2.0.5.tgz",
      "integrity": "sha512-xHjhDr3cNBK0BzdUJSPXZntQUx/mwMS5Rw4A7lPJ90XGAO6ISP/ePDNuo0vhqOZU+UD5JoodwCAAoZQd3FeAKw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/isexe": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/isexe/-/isexe-2.0.0.tgz",
      "integrity": "sha512-RHxMLp9lnKHGHRng9QFhRCMbYAcVpn69smSGcq3f36xjgVVWThj4qqLbTLlq7Ssj8B+fIQ1EuCEGI2lKsyQeIw==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/iterator.prototype": {
      "version": "1.1.5",
      "resolved": "https://registry.npmjs.org/iterator.prototype/-/iterator.prototype-1.1.5.tgz",
      "integrity": "sha512-H0dkQoCa3b2VEeKQBOxFph+JAbcrQdE7KC0UkqwpLmv2EC4P41QXP+rqo9wYodACiG5/WM5s9oDApTU8utwj9g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "define-data-property": "^1.1.4",
        "es-object-atoms": "^1.0.0",
        "get-intrinsic": "^1.2.6",
        "get-proto": "^1.0.0",
        "has-symbols": "^1.1.0",
        "set-function-name": "^2.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/jiti": {
      "version": "2.6.1",
      "resolved": "https://registry.npmjs.org/jiti/-/jiti-2.6.1.tgz",
      "integrity": "sha512-ekilCSN1jwRvIbgeg/57YFh8qQDNbwDb9xT/qu2DAHbFFZUicIl4ygVaAvzveMhMVr3LnpSKTNnwt8PoOfmKhQ==",
      "dev": true,
      "license": "MIT",
      "bin": {
        "jiti": "lib/jiti-cli.mjs"
      }
    },
    "node_modules/jose": {
      "version": "6.1.3",
      "resolved": "https://registry.npmjs.org/jose/-/jose-6.1.3.tgz",
      "integrity": "sha512-0TpaTfihd4QMNwrz/ob2Bp7X04yuxJkjRGi4aKmOqwhov54i6u79oCv7T+C7lo70MKH6BesI3vscD1yb/yzKXQ==",
      "license": "MIT",
      "funding": {
        "url": "https://github.com/sponsors/panva"
      }
    },
    "node_modules/js-tokens": {
      "version": "4.0.0",
      "resolved": "https://registry.npmjs.org/js-tokens/-/js-tokens-4.0.0.tgz",
      "integrity": "sha512-RdJUflcE3cUzKiMqQgsCu06FPu9UdIJO0beYbPhHN4k6apgJtifcoCtT9bcxOpYBtpD2kCM6Sbzg4CausW/PKQ==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/js-yaml": {
      "version": "4.1.1",
      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-4.1.1.tgz",
      "integrity": "sha512-qQKT4zQxXl8lLwBtHMWwaTcGfFOZviOJet3Oy/xmGk2gZH677CJM9EvtfdSkgWcATZhj/55JZ0rmy3myCT5lsA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "argparse": "^2.0.1"
      },
      "bin": {
        "js-yaml": "bin/js-yaml.js"
      }
    },
    "node_modules/jsesc": {
      "version": "3.1.0",
      "resolved": "https://registry.npmjs.org/jsesc/-/jsesc-3.1.0.tgz",
      "integrity": "sha512-/sM3dO2FOzXjKQhJuo0Q173wf2KOo8t4I8vHy6lF9poUp7bKT0/NHE8fPX23PwfhnykfqnC2xRxOnVw5XuGIaA==",
      "dev": true,
      "license": "MIT",
      "bin": {
        "jsesc": "bin/jsesc"
      },
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/json-buffer": {
      "version": "3.0.1",
      "resolved": "https://registry.npmjs.org/json-buffer/-/json-buffer-3.0.1.tgz",
      "integrity": "sha512-4bV5BfR2mqfQTJm+V5tPPdf+ZpuhiIvTuAB5g8kcrXOZpTT/QwwVRWBywX1ozr6lEuPdbHxwaJlm9G6mI2sfSQ==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/json-schema-traverse": {
      "version": "0.4.1",
      "resolved": "https://registry.npmjs.org/json-schema-traverse/-/json-schema-traverse-0.4.1.tgz",
      "integrity": "sha512-xbbCH5dCYU5T8LcEhhuh7HJ88HXuW3qsI3Y0zOZFKfZEHcpWiHU/Jxzk629Brsab/mMiHQti9wMP+845RPe3Vg==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/json-stable-stringify-without-jsonify": {
      "version": "1.0.1",
      "resolved": "https://registry.npmjs.org/json-stable-stringify-without-jsonify/-/json-stable-stringify-without-jsonify-1.0.1.tgz",
      "integrity": "sha512-Bdboy+l7tA3OGW6FjyFHWkP5LuByj1Tk33Ljyq0axyzdk9//JSi2u3fP1QSmd1KNwq6VOKYGlAu87CisVir6Pw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/json5": {
      "version": "2.2.3",
      "resolved": "https://registry.npmjs.org/json5/-/json5-2.2.3.tgz",
      "integrity": "sha512-XmOWe7eyHYH14cLdVPoyg+GOH3rYX++KpzrylJwSW98t3Nk+U8XOl8FWKOgwtzdb8lXGf6zYwDUzeHMWfxasyg==",
      "dev": true,
      "license": "MIT",
      "bin": {
        "json5": "lib/cli.js"
      },
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/jsx-ast-utils": {
      "version": "3.3.5",
      "resolved": "https://registry.npmjs.org/jsx-ast-utils/-/jsx-ast-utils-3.3.5.tgz",
      "integrity": "sha512-ZZow9HBI5O6EPgSJLUb8n2NKgmVWTwCvHGwFuJlMjvLFqlGG6pjirPhtdsseaLZjSibD8eegzmYpUZwoIlj2cQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "array-includes": "^3.1.6",
        "array.prototype.flat": "^1.3.1",
        "object.assign": "^4.1.4",
        "object.values": "^1.1.6"
      },
      "engines": {
        "node": ">=4.0"
      }
    },
    "node_modules/keyv": {
      "version": "4.5.4",
      "resolved": "https://registry.npmjs.org/keyv/-/keyv-4.5.4.tgz",
      "integrity": "sha512-oxVHkHR/EJf2CNXnWxRLW6mg7JyCCUcG0DtEGmL2ctUo1PNTin1PUil+r/+4r5MpVgC/fn1kjsx7mjSujKqIpw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "json-buffer": "3.0.1"
      }
    },
    "node_modules/language-subtag-registry": {
      "version": "0.3.23",
      "resolved": "https://registry.npmjs.org/language-subtag-registry/-/language-subtag-registry-0.3.23.tgz",
      "integrity": "sha512-0K65Lea881pHotoGEa5gDlMxt3pctLi2RplBb7Ezh4rRdLEOtgi7n4EwK9lamnUCkKBqaeKRVebTq6BAxSkpXQ==",
      "dev": true,
      "license": "CC0-1.0"
    },
    "node_modules/language-tags": {
      "version": "1.0.9",
      "resolved": "https://registry.npmjs.org/language-tags/-/language-tags-1.0.9.tgz",
      "integrity": "sha512-MbjN408fEndfiQXbFQ1vnd+1NoLDsnQW41410oQBXiyXDMYH5z505juWa4KUE1LqxRC7DgOgZDbKLxHIwm27hA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "language-subtag-registry": "^0.3.20"
      },
      "engines": {
        "node": ">=0.10"
      }
    },
    "node_modules/levn": {
      "version": "0.4.1",
      "resolved": "https://registry.npmjs.org/levn/-/levn-0.4.1.tgz",
      "integrity": "sha512-+bT2uH4E5LGE7h/n3evcS/sQlJXCpIp6ym8OWJ5eV6+67Dsql/LaaT7qJBAt2rzfoa/5QBGBhxDix1dMt2kQKQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "prelude-ls": "^1.2.1",
        "type-check": "~0.4.0"
      },
      "engines": {
        "node": ">= 0.8.0"
      }
    },
    "node_modules/lightningcss": {
      "version": "1.30.2",
      "resolved": "https://registry.npmjs.org/lightningcss/-/lightningcss-1.30.2.tgz",
      "integrity": "sha512-utfs7Pr5uJyyvDETitgsaqSyjCb2qNRAtuqUeWIAKztsOYdcACf2KtARYXg2pSvhkt+9NfoaNY7fxjl6nuMjIQ==",
      "dev": true,
      "license": "MPL-2.0",
      "dependencies": {
        "detect-libc": "^2.0.3"
      },
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      },
      "optionalDependencies": {
        "lightningcss-android-arm64": "1.30.2",
        "lightningcss-darwin-arm64": "1.30.2",
        "lightningcss-darwin-x64": "1.30.2",
        "lightningcss-freebsd-x64": "1.30.2",
        "lightningcss-linux-arm-gnueabihf": "1.30.2",
        "lightningcss-linux-arm64-gnu": "1.30.2",
        "lightningcss-linux-arm64-musl": "1.30.2",
        "lightningcss-linux-x64-gnu": "1.30.2",
        "lightningcss-linux-x64-musl": "1.30.2",
        "lightningcss-win32-arm64-msvc": "1.30.2",
        "lightningcss-win32-x64-msvc": "1.30.2"
      }
    },
    "node_modules/lightningcss-android-arm64": {
      "version": "1.30.2",
      "resolved": "https://registry.npmjs.org/lightningcss-android-arm64/-/lightningcss-android-arm64-1.30.2.tgz",
      "integrity": "sha512-BH9sEdOCahSgmkVhBLeU7Hc9DWeZ1Eb6wNS6Da8igvUwAe0sqROHddIlvU06q3WyXVEOYDZ6ykBZQnjTbmo4+A==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MPL-2.0",
      "optional": true,
      "os": [
        "android"
      ],
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      }
    },
    "node_modules/lightningcss-darwin-arm64": {
      "version": "1.30.2",
      "resolved": "https://registry.npmjs.org/lightningcss-darwin-arm64/-/lightningcss-darwin-arm64-1.30.2.tgz",
      "integrity": "sha512-ylTcDJBN3Hp21TdhRT5zBOIi73P6/W0qwvlFEk22fkdXchtNTOU4Qc37SkzV+EKYxLouZ6M4LG9NfZ1qkhhBWA==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MPL-2.0",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      }
    },
    "node_modules/lightningcss-darwin-x64": {
      "version": "1.30.2",
      "resolved": "https://registry.npmjs.org/lightningcss-darwin-x64/-/lightningcss-darwin-x64-1.30.2.tgz",
      "integrity": "sha512-oBZgKchomuDYxr7ilwLcyms6BCyLn0z8J0+ZZmfpjwg9fRVZIR5/GMXd7r9RH94iDhld3UmSjBM6nXWM2TfZTQ==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MPL-2.0",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      }
    },
    "node_modules/lightningcss-freebsd-x64": {
      "version": "1.30.2",
      "resolved": "https://registry.npmjs.org/lightningcss-freebsd-x64/-/lightningcss-freebsd-x64-1.30.2.tgz",
      "integrity": "sha512-c2bH6xTrf4BDpK8MoGG4Bd6zAMZDAXS569UxCAGcA7IKbHNMlhGQ89eRmvpIUGfKWNVdbhSbkQaWhEoMGmGslA==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MPL-2.0",
      "optional": true,
      "os": [
        "freebsd"
      ],
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      }
    },
    "node_modules/lightningcss-linux-arm-gnueabihf": {
      "version": "1.30.2",
      "resolved": "https://registry.npmjs.org/lightningcss-linux-arm-gnueabihf/-/lightningcss-linux-arm-gnueabihf-1.30.2.tgz",
      "integrity": "sha512-eVdpxh4wYcm0PofJIZVuYuLiqBIakQ9uFZmipf6LF/HRj5Bgm0eb3qL/mr1smyXIS1twwOxNWndd8z0E374hiA==",
      "cpu": [
        "arm"
      ],
      "dev": true,
      "license": "MPL-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      }
    },
    "node_modules/lightningcss-linux-arm64-gnu": {
      "version": "1.30.2",
      "resolved": "https://registry.npmjs.org/lightningcss-linux-arm64-gnu/-/lightningcss-linux-arm64-gnu-1.30.2.tgz",
      "integrity": "sha512-UK65WJAbwIJbiBFXpxrbTNArtfuznvxAJw4Q2ZGlU8kPeDIWEX1dg3rn2veBVUylA2Ezg89ktszWbaQnxD/e3A==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MPL-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      }
    },
    "node_modules/lightningcss-linux-arm64-musl": {
      "version": "1.30.2",
      "resolved": "https://registry.npmjs.org/lightningcss-linux-arm64-musl/-/lightningcss-linux-arm64-musl-1.30.2.tgz",
      "integrity": "sha512-5Vh9dGeblpTxWHpOx8iauV02popZDsCYMPIgiuw97OJ5uaDsL86cnqSFs5LZkG3ghHoX5isLgWzMs+eD1YzrnA==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MPL-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      }
    },
    "node_modules/lightningcss-linux-x64-gnu": {
      "version": "1.30.2",
      "resolved": "https://registry.npmjs.org/lightningcss-linux-x64-gnu/-/lightningcss-linux-x64-gnu-1.30.2.tgz",
      "integrity": "sha512-Cfd46gdmj1vQ+lR6VRTTadNHu6ALuw2pKR9lYq4FnhvgBc4zWY1EtZcAc6EffShbb1MFrIPfLDXD6Xprbnni4w==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MPL-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      }
    },
    "node_modules/lightningcss-linux-x64-musl": {
      "version": "1.30.2",
      "resolved": "https://registry.npmjs.org/lightningcss-linux-x64-musl/-/lightningcss-linux-x64-musl-1.30.2.tgz",
      "integrity": "sha512-XJaLUUFXb6/QG2lGIW6aIk6jKdtjtcffUT0NKvIqhSBY3hh9Ch+1LCeH80dR9q9LBjG3ewbDjnumefsLsP6aiA==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MPL-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      }
    },
    "node_modules/lightningcss-win32-arm64-msvc": {
      "version": "1.30.2",
      "resolved": "https://registry.npmjs.org/lightningcss-win32-arm64-msvc/-/lightningcss-win32-arm64-msvc-1.30.2.tgz",
      "integrity": "sha512-FZn+vaj7zLv//D/192WFFVA0RgHawIcHqLX9xuWiQt7P0PtdFEVaxgF9rjM/IRYHQXNnk61/H/gb2Ei+kUQ4xQ==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MPL-2.0",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      }
    },
    "node_modules/lightningcss-win32-x64-msvc": {
      "version": "1.30.2",
      "resolved": "https://registry.npmjs.org/lightningcss-win32-x64-msvc/-/lightningcss-win32-x64-msvc-1.30.2.tgz",
      "integrity": "sha512-5g1yc73p+iAkid5phb4oVFMB45417DkRevRbt/El/gKXJk4jid+vPFF/AXbxn05Aky8PapwzZrdJShv5C0avjw==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MPL-2.0",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      }
    },
    "node_modules/locate-path": {
      "version": "6.0.0",
      "resolved": "https://registry.npmjs.org/locate-path/-/locate-path-6.0.0.tgz",
      "integrity": "sha512-iPZK6eYjbxRu3uB4/WZ3EsEIMJFMqAoopl3R+zuq0UjcAm/MO6KCweDgPfP3elTztoKP3KtnVHxTn2NHBSDVUw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "p-locate": "^5.0.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/lodash.merge": {
      "version": "4.6.2",
      "resolved": "https://registry.npmjs.org/lodash.merge/-/lodash.merge-4.6.2.tgz",
      "integrity": "sha512-0KpjqXRVvrYyCsX1swR/XTK0va6VQkQM6MNo7PqW77ByjAhoARA8EfrP1N4+KlKj8YS0ZUCtRT/YUuhyYDujIQ==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/loose-envify": {
      "version": "1.4.0",
      "resolved": "https://registry.npmjs.org/loose-envify/-/loose-envify-1.4.0.tgz",
      "integrity": "sha512-lyuxPGr/Wfhrlem2CL/UcnUc1zcqKAImBDzukY7Y5F/yQiNdko6+fRLevlw1HgMySw7f611UIY408EtxRSoK3Q==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "js-tokens": "^3.0.0 || ^4.0.0"
      },
      "bin": {
        "loose-envify": "cli.js"
      }
    },
    "node_modules/lru-cache": {
      "version": "5.1.1",
      "resolved": "https://registry.npmjs.org/lru-cache/-/lru-cache-5.1.1.tgz",
      "integrity": "sha512-KpNARQA3Iwv+jTA0utUVVbrh+Jlrr1Fv0e56GGzAFOXN7dk/FviaDW8LHmK52DlcH4WP2n6gI8vN1aesBFgo9w==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "yallist": "^3.0.2"
      }
    },
    "node_modules/magic-string": {
      "version": "0.30.21",
      "resolved": "https://registry.npmjs.org/magic-string/-/magic-string-0.30.21.tgz",
      "integrity": "sha512-vd2F4YUyEXKGcLHoq+TEyCjxueSeHnFxyyjNp80yg0XV4vUhnDer/lvvlqM/arB5bXQN5K2/3oinyCRyx8T2CQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jridgewell/sourcemap-codec": "^1.5.5"
      }
    },
    "node_modules/math-intrinsics": {
      "version": "1.1.0",
      "resolved": "https://registry.npmjs.org/math-intrinsics/-/math-intrinsics-1.1.0.tgz",
      "integrity": "sha512-/IXtbwEk5HTPyEwyKX6hGkYXxM9nbj64B+ilVJnC/R6B0pH5G4V3b0pVbL7DBj4tkhBAppbQUlf6F6Xl9LHu1g==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/merge2": {
      "version": "1.4.1",
      "resolved": "https://registry.npmjs.org/merge2/-/merge2-1.4.1.tgz",
      "integrity": "sha512-8q7VEgMJW4J8tcfVPy8g09NcQwZdbwFEqhe/WZkoIzjn/3TGDwtOCYtXGxA3O8tPzpczCCDgv+P2P5y00ZJOOg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/micromatch": {
      "version": "4.0.8",
      "resolved": "https://registry.npmjs.org/micromatch/-/micromatch-4.0.8.tgz",
      "integrity": "sha512-PXwfBhYu0hBCPw8Dn0E+WDYb7af3dSLVWKi3HGv84IdF4TyFoC0ysxFd0Goxw7nSv4T/PzEJQxsYsEiFCKo2BA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "braces": "^3.0.3",
        "picomatch": "^2.3.1"
      },
      "engines": {
        "node": ">=8.6"
      }
    },
    "node_modules/minimatch": {
      "version": "3.1.2",
      "resolved": "https://registry.npmjs.org/minimatch/-/minimatch-3.1.2.tgz",
      "integrity": "sha512-J7p63hRiAjw1NDEww1W7i37+ByIrOWO5XQQAzZ3VOcL0PNybwpfmV/N05zFAzwQ9USyEcX6t3UO+K5aqBQOIHw==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "brace-expansion": "^1.1.7"
      },
      "engines": {
        "node": "*"
      }
    },
    "node_modules/minimist": {
      "version": "1.2.8",
      "resolved": "https://registry.npmjs.org/minimist/-/minimist-1.2.8.tgz",
      "integrity": "sha512-2yyAR8qBkN3YuheJanUpWC5U3bb5osDywNB8RzDVlDwDHbocAJveqqj1u8+SVD7jkWT4yvsHCpWqqWqAxb0zCA==",
      "dev": true,
      "license": "MIT",
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/ms": {
      "version": "2.1.3",
      "resolved": "https://registry.npmjs.org/ms/-/ms-2.1.3.tgz",
      "integrity": "sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/nanoid": {
      "version": "3.3.11",
      "resolved": "https://registry.npmjs.org/nanoid/-/nanoid-3.3.11.tgz",
      "integrity": "sha512-N8SpfPUnUp1bK+PMYW8qSWdl9U+wwNWI4QKxOYDy9JAro3WMX7p2OeVRF9v+347pnakNevPmiHhNmZ2HbFA76w==",
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "bin": {
        "nanoid": "bin/nanoid.cjs"
      },
      "engines": {
        "node": "^10 || ^12 || ^13.7 || ^14 || >=15.0.1"
      }
    },
    "node_modules/napi-postinstall": {
      "version": "0.3.4",
      "resolved": "https://registry.npmjs.org/napi-postinstall/-/napi-postinstall-0.3.4.tgz",
      "integrity": "sha512-PHI5f1O0EP5xJ9gQmFGMS6IZcrVvTjpXjz7Na41gTE7eE2hK11lg04CECCYEEjdc17EV4DO+fkGEtt7TpTaTiQ==",
      "dev": true,
      "license": "MIT",
      "bin": {
        "napi-postinstall": "lib/cli.js"
      },
      "engines": {
        "node": "^12.20.0 || ^14.18.0 || >=16.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/napi-postinstall"
      }
    },
    "node_modules/natural-compare": {
      "version": "1.4.0",
      "resolved": "https://registry.npmjs.org/natural-compare/-/natural-compare-1.4.0.tgz",
      "integrity": "sha512-OWND8ei3VtNC9h7V60qff3SVobHr996CTwgxubgyQYEpg290h9J0buyECNNJexkFm5sOajh5G116RYA1c8ZMSw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/next": {
      "version": "16.0.10",
      "resolved": "https://registry.npmjs.org/next/-/next-16.0.10.tgz",
      "integrity": "sha512-RtWh5PUgI+vxlV3HdR+IfWA1UUHu0+Ram/JBO4vWB54cVPentCD0e+lxyAYEsDTqGGMg7qpjhKh6dc6aW7W/sA==",
      "license": "MIT",
      "dependencies": {
        "@next/env": "16.0.10",
        "@swc/helpers": "0.5.15",
        "caniuse-lite": "^1.0.30001579",
        "postcss": "8.4.31",
        "styled-jsx": "5.1.6"
      },
      "bin": {
        "next": "dist/bin/next"
      },
      "engines": {
        "node": ">=20.9.0"
      },
      "optionalDependencies": {
        "@next/swc-darwin-arm64": "16.0.10",
        "@next/swc-darwin-x64": "16.0.10",
        "@next/swc-linux-arm64-gnu": "16.0.10",
        "@next/swc-linux-arm64-musl": "16.0.10",
        "@next/swc-linux-x64-gnu": "16.0.10",
        "@next/swc-linux-x64-musl": "16.0.10",
        "@next/swc-win32-arm64-msvc": "16.0.10",
        "@next/swc-win32-x64-msvc": "16.0.10",
        "sharp": "^0.34.4"
      },
      "peerDependencies": {
        "@opentelemetry/api": "^1.1.0",
        "@playwright/test": "^1.51.1",
        "babel-plugin-react-compiler": "*",
        "react": "^18.2.0 || 19.0.0-rc-de68d2f4-20241204 || ^19.0.0",
        "react-dom": "^18.2.0 || 19.0.0-rc-de68d2f4-20241204 || ^19.0.0",
        "sass": "^1.3.0"
      },
      "peerDependenciesMeta": {
        "@opentelemetry/api": {
          "optional": true
        },
        "@playwright/test": {
          "optional": true
        },
        "babel-plugin-react-compiler": {
          "optional": true
        },
        "sass": {
          "optional": true
        }
      }
    },
    "node_modules/next-auth": {
      "version": "5.0.0-beta.30",
      "resolved": "https://registry.npmjs.org/next-auth/-/next-auth-5.0.0-beta.30.tgz",
      "integrity": "sha512-+c51gquM3F6nMVmoAusRJ7RIoY0K4Ts9HCCwyy/BRoe4mp3msZpOzYMyb5LAYc1wSo74PMQkGDcaghIO7W6Xjg==",
      "license": "ISC",
      "dependencies": {
        "@auth/core": "0.41.0"
      },
      "peerDependencies": {
        "@simplewebauthn/browser": "^9.0.1",
        "@simplewebauthn/server": "^9.0.2",
        "next": "^14.0.0-0 || ^15.0.0 || ^16.0.0",
        "nodemailer": "^7.0.7",
        "react": "^18.2.0 || ^19.0.0"
      },
      "peerDependenciesMeta": {
        "@simplewebauthn/browser": {
          "optional": true
        },
        "@simplewebauthn/server": {
          "optional": true
        },
        "nodemailer": {
          "optional": true
        }
      }
    },
    "node_modules/next/node_modules/postcss": {
      "version": "8.4.31",
      "resolved": "https://registry.npmjs.org/postcss/-/postcss-8.4.31.tgz",
      "integrity": "sha512-PS08Iboia9mts/2ygV3eLpY5ghnUcfLV/EXTOW1E2qYxJKGGBUtNjN76FYHnMs36RmARn41bC0AZmn+rR0OVpQ==",
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/postcss/"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/postcss"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "nanoid": "^3.3.6",
        "picocolors": "^1.0.0",
        "source-map-js": "^1.0.2"
      },
      "engines": {
        "node": "^10 || ^12 || >=14"
      }
    },
    "node_modules/node-releases": {
      "version": "2.0.27",
      "resolved": "https://registry.npmjs.org/node-releases/-/node-releases-2.0.27.tgz",
      "integrity": "sha512-nmh3lCkYZ3grZvqcCH+fjmQ7X+H0OeZgP40OierEaAptX4XofMh5kwNbWh7lBduUzCcV/8kZ+NDLCwm2iorIlA==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/oauth4webapi": {
      "version": "3.8.3",
      "resolved": "https://registry.npmjs.org/oauth4webapi/-/oauth4webapi-3.8.3.tgz",
      "integrity": "sha512-pQ5BsX3QRTgnt5HxgHwgunIRaDXBdkT23tf8dfzmtTIL2LTpdmxgbpbBm0VgFWAIDlezQvQCTgnVIUmHupXHxw==",
      "license": "MIT",
      "funding": {
        "url": "https://github.com/sponsors/panva"
      }
    },
    "node_modules/object-assign": {
      "version": "4.1.1",
      "resolved": "https://registry.npmjs.org/object-assign/-/object-assign-4.1.1.tgz",
      "integrity": "sha512-rJgTQnkUnH1sFw8yT6VSU3zD3sWmu6sZhIseY8VX+GRu3P6F7Fu+JNDoXfklElbLJSnc3FUQHVe4cU5hj+BcUg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/object-inspect": {
      "version": "1.13.4",
      "resolved": "https://registry.npmjs.org/object-inspect/-/object-inspect-1.13.4.tgz",
      "integrity": "sha512-W67iLl4J2EXEGTbfeHCffrjDfitvLANg0UlX3wFUUSTx92KXRFegMHUVgSqE+wvhAbi4WqjGg9czysTV2Epbew==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/object-keys": {
      "version": "1.1.1",
      "resolved": "https://registry.npmjs.org/object-keys/-/object-keys-1.1.1.tgz",
      "integrity": "sha512-NuAESUOUMrlIXOfHKzD6bpPu3tYt3xvjNdRIQ+FeT0lNb4K8WR70CaDxhuNguS2XG+GjkyMwOzsN5ZktImfhLA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/object.assign": {
      "version": "4.1.7",
      "resolved": "https://registry.npmjs.org/object.assign/-/object.assign-4.1.7.tgz",
      "integrity": "sha512-nK28WOo+QIjBkDduTINE4JkF/UJJKyf2EJxvJKfblDpyg0Q+pkOHNTL0Qwy6NP6FhE/EnzV73BxxqcJaXY9anw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.8",
        "call-bound": "^1.0.3",
        "define-properties": "^1.2.1",
        "es-object-atoms": "^1.0.0",
        "has-symbols": "^1.1.0",
        "object-keys": "^1.1.1"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/object.entries": {
      "version": "1.1.9",
      "resolved": "https://registry.npmjs.org/object.entries/-/object.entries-1.1.9.tgz",
      "integrity": "sha512-8u/hfXFRBD1O0hPUjioLhoWFHRmt6tKA4/vZPyckBr18l1KE9uHrFaFaUi8MDRTpi4uak2goyPTSNJLXX2k2Hw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.8",
        "call-bound": "^1.0.4",
        "define-properties": "^1.2.1",
        "es-object-atoms": "^1.1.1"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/object.fromentries": {
      "version": "2.0.8",
      "resolved": "https://registry.npmjs.org/object.fromentries/-/object.fromentries-2.0.8.tgz",
      "integrity": "sha512-k6E21FzySsSK5a21KRADBd/NGneRegFO5pLHfdQLpRDETUNJueLXs3WCzyQ3tFRDYgbq3KHGXfTbi2bs8WQ6rQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.7",
        "define-properties": "^1.2.1",
        "es-abstract": "^1.23.2",
        "es-object-atoms": "^1.0.0"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/object.groupby": {
      "version": "1.0.3",
      "resolved": "https://registry.npmjs.org/object.groupby/-/object.groupby-1.0.3.tgz",
      "integrity": "sha512-+Lhy3TQTuzXI5hevh8sBGqbmurHbbIjAi0Z4S63nthVLmLxfbj4T54a4CfZrXIrt9iP4mVAPYMo/v99taj3wjQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.7",
        "define-properties": "^1.2.1",
        "es-abstract": "^1.23.2"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/object.values": {
      "version": "1.2.1",
      "resolved": "https://registry.npmjs.org/object.values/-/object.values-1.2.1.tgz",
      "integrity": "sha512-gXah6aZrcUxjWg2zR2MwouP2eHlCBzdV4pygudehaKXSGW4v2AsRQUK+lwwXhii6KFZcunEnmSUoYp5CXibxtA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.8",
        "call-bound": "^1.0.3",
        "define-properties": "^1.2.1",
        "es-object-atoms": "^1.0.0"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/optionator": {
      "version": "0.9.4",
      "resolved": "https://registry.npmjs.org/optionator/-/optionator-0.9.4.tgz",
      "integrity": "sha512-6IpQ7mKUxRcZNLIObR0hz7lxsapSSIYNZJwXPGeF0mTVqGKFIXj1DQcMoT22S3ROcLyY/rz0PWaWZ9ayWmad9g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "deep-is": "^0.1.3",
        "fast-levenshtein": "^2.0.6",
        "levn": "^0.4.1",
        "prelude-ls": "^1.2.1",
        "type-check": "^0.4.0",
        "word-wrap": "^1.2.5"
      },
      "engines": {
        "node": ">= 0.8.0"
      }
    },
    "node_modules/own-keys": {
      "version": "1.0.1",
      "resolved": "https://registry.npmjs.org/own-keys/-/own-keys-1.0.1.tgz",
      "integrity": "sha512-qFOyK5PjiWZd+QQIh+1jhdb9LpxTF0qs7Pm8o5QHYZ0M3vKqSqzsZaEB6oWlxZ+q2sJBMI/Ktgd2N5ZwQoRHfg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "get-intrinsic": "^1.2.6",
        "object-keys": "^1.1.1",
        "safe-push-apply": "^1.0.0"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/p-limit": {
      "version": "3.1.0",
      "resolved": "https://registry.npmjs.org/p-limit/-/p-limit-3.1.0.tgz",
      "integrity": "sha512-TYOanM3wGwNGsZN2cVTYPArw454xnXj5qmWF1bEoAc4+cU/ol7GVh7odevjp1FNHduHc3KZMcFduxU5Xc6uJRQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "yocto-queue": "^0.1.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/p-locate": {
      "version": "5.0.0",
      "resolved": "https://registry.npmjs.org/p-locate/-/p-locate-5.0.0.tgz",
      "integrity": "sha512-LaNjtRWUBY++zB5nE/NwcaoMylSPk+S+ZHNB1TzdbMJMny6dynpAGt7X/tl/QYq3TIeE6nxHppbo2LGymrG5Pw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "p-limit": "^3.0.2"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/parent-module": {
      "version": "1.0.1",
      "resolved": "https://registry.npmjs.org/parent-module/-/parent-module-1.0.1.tgz",
      "integrity": "sha512-GQ2EWRpQV8/o+Aw8YqtfZZPfNRWZYkbidE9k5rpl/hC3vtHHBfGm2Ifi6qWV+coDGkrUKZAxE3Lot5kcsRlh+g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "callsites": "^3.0.0"
      },
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/path-exists": {
      "version": "4.0.0",
      "resolved": "https://registry.npmjs.org/path-exists/-/path-exists-4.0.0.tgz",
      "integrity": "sha512-ak9Qy5Q7jYb2Wwcey5Fpvg2KoAc/ZIhLSLOSBmRmygPsGwkVVt0fZa0qrtMz+m6tJTAHfZQ8FnmB4MG4LWy7/w==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/path-key": {
      "version": "3.1.1",
      "resolved": "https://registry.npmjs.org/path-key/-/path-key-3.1.1.tgz",
      "integrity": "sha512-ojmeN0qd+y0jszEtoY48r0Peq5dwMEkIlCOu6Q5f41lfkswXuKtYrhgoTpLnyIcHm24Uhqx+5Tqm2InSwLhE6Q==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/path-parse": {
      "version": "1.0.7",
      "resolved": "https://registry.npmjs.org/path-parse/-/path-parse-1.0.7.tgz",
      "integrity": "sha512-LDJzPVEEEPR+y48z93A0Ed0yXb8pAByGWo/k5YYdYgpY2/2EsOsksJrq7lOHxryrVOn1ejG6oAp8ahvOIQD8sw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/picocolors": {
      "version": "1.1.1",
      "resolved": "https://registry.npmjs.org/picocolors/-/picocolors-1.1.1.tgz",
      "integrity": "sha512-xceH2snhtb5M9liqDsmEw56le376mTZkEX/jEb/RxNFyegNul7eNslCXP9FDj/Lcu0X8KEyMceP2ntpaHrDEVA==",
      "license": "ISC"
    },
    "node_modules/picomatch": {
      "version": "2.3.1",
      "resolved": "https://registry.npmjs.org/picomatch/-/picomatch-2.3.1.tgz",
      "integrity": "sha512-JU3teHTNjmE2VCGFzuY8EXzCDVwEqB2a8fsIvwaStHhAWJEeVd1o1QD80CU6+ZdEXXSLbSsuLwJjkCBWqRQUVA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8.6"
      },
      "funding": {
        "url": "https://github.com/sponsors/jonschlinkert"
      }
    },
    "node_modules/possible-typed-array-names": {
      "version": "1.1.0",
      "resolved": "https://registry.npmjs.org/possible-typed-array-names/-/possible-typed-array-names-1.1.0.tgz",
      "integrity": "sha512-/+5VFTchJDoVj3bhoqi6UeymcD00DAwb1nJwamzPvHEszJ4FpF6SNNbUbOS8yI56qHzdV8eK0qEfOSiodkTdxg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/postcss": {
      "version": "8.5.6",
      "resolved": "https://registry.npmjs.org/postcss/-/postcss-8.5.6.tgz",
      "integrity": "sha512-3Ybi1tAuwAP9s0r1UQ2J4n5Y0G05bJkpUIO0/bI9MhwmD70S5aTWbXGBwxHrelT+XM1k6dM0pk+SwNkpTRN7Pg==",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/postcss/"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/postcss"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "nanoid": "^3.3.11",
        "picocolors": "^1.1.1",
        "source-map-js": "^1.2.1"
      },
      "engines": {
        "node": "^10 || ^12 || >=14"
      }
    },
    "node_modules/preact": {
      "version": "10.24.3",
      "resolved": "https://registry.npmjs.org/preact/-/preact-10.24.3.tgz",
      "integrity": "sha512-Z2dPnBnMUfyQfSQ+GBdsGa16hz35YmLmtTLhM169uW944hYL6xzTYkJjC07j+Wosz733pMWx0fgON3JNw1jJQA==",
      "license": "MIT",
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/preact"
      }
    },
    "node_modules/preact-render-to-string": {
      "version": "6.5.11",
      "resolved": "https://registry.npmjs.org/preact-render-to-string/-/preact-render-to-string-6.5.11.tgz",
      "integrity": "sha512-ubnauqoGczeGISiOh6RjX0/cdaF8v/oDXIjO85XALCQjwQP+SB4RDXXtvZ6yTYSjG+PC1QRP2AhPgCEsM2EvUw==",
      "license": "MIT",
      "peerDependencies": {
        "preact": ">=10"
      }
    },
    "node_modules/prelude-ls": {
      "version": "1.2.1",
      "resolved": "https://registry.npmjs.org/prelude-ls/-/prelude-ls-1.2.1.tgz",
      "integrity": "sha512-vkcDPrRZo1QZLbn5RLGPpg/WmIQ65qoWWhcGKf/b5eplkkarX0m9z8ppCat4mlOqUsWpyNuYgO3VRyrYHSzX5g==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.8.0"
      }
    },
    "node_modules/prop-types": {
      "version": "15.8.1",
      "resolved": "https://registry.npmjs.org/prop-types/-/prop-types-15.8.1.tgz",
      "integrity": "sha512-oj87CgZICdulUohogVAR7AjlC0327U4el4L6eAvOqCeudMDVU0NThNaV+b9Df4dXgSP1gXMTnPdhfe/2qDH5cg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "loose-envify": "^1.4.0",
        "object-assign": "^4.1.1",
        "react-is": "^16.13.1"
      }
    },
    "node_modules/punycode": {
      "version": "2.3.1",
      "resolved": "https://registry.npmjs.org/punycode/-/punycode-2.3.1.tgz",
      "integrity": "sha512-vYt7UD1U9Wg6138shLtLOvdAu+8DsC/ilFtEVHcH+wydcSpNE20AfSOduf6MkRFahL5FY7X1oU7nKVZFtfq8Fg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/queue-microtask": {
      "version": "1.2.3",
      "resolved": "https://registry.npmjs.org/queue-microtask/-/queue-microtask-1.2.3.tgz",
      "integrity": "sha512-NuaNSa6flKT5JaSYQzJok04JzTL1CA6aGhv5rfLW3PgqA+M2ChpZQnAC8h8i4ZFkBS8X5RqkDBHA7r4hej3K9A==",
      "dev": true,
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "MIT"
    },
    "node_modules/react": {
      "version": "19.2.0",
      "resolved": "https://registry.npmjs.org/react/-/react-19.2.0.tgz",
      "integrity": "sha512-tmbWg6W31tQLeB5cdIBOicJDJRR2KzXsV7uSK9iNfLWQ5bIZfxuPEHp7M8wiHyHnn0DD1i7w3Zmin0FtkrwoCQ==",
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/react-dom": {
      "version": "19.2.0",
      "resolved": "https://registry.npmjs.org/react-dom/-/react-dom-19.2.0.tgz",
      "integrity": "sha512-UlbRu4cAiGaIewkPyiRGJk0imDN2T3JjieT6spoL2UeSf5od4n5LB/mQ4ejmxhCFT1tYe8IvaFulzynWovsEFQ==",
      "license": "MIT",
      "dependencies": {
        "scheduler": "^0.27.0"
      },
      "peerDependencies": {
        "react": "^19.2.0"
      }
    },
    "node_modules/react-is": {
      "version": "16.13.1",
      "resolved": "https://registry.npmjs.org/react-is/-/react-is-16.13.1.tgz",
      "integrity": "sha512-24e6ynE2H+OKt4kqsOvNd8kBpV65zoxbA4BVsEOB3ARVWQki/DHzaUoC5KuON/BiccDaCCTZBuOcfZs70kR8bQ==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/reflect.getprototypeof": {
      "version": "1.0.10",
      "resolved": "https://registry.npmjs.org/reflect.getprototypeof/-/reflect.getprototypeof-1.0.10.tgz",
      "integrity": "sha512-00o4I+DVrefhv+nX0ulyi3biSHCPDe+yLv5o/p6d/UVlirijB8E16FtfwSAi4g3tcqrQ4lRAqQSoFEZJehYEcw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.8",
        "define-properties": "^1.2.1",
        "es-abstract": "^1.23.9",
        "es-errors": "^1.3.0",
        "es-object-atoms": "^1.0.0",
        "get-intrinsic": "^1.2.7",
        "get-proto": "^1.0.1",
        "which-builtin-type": "^1.2.1"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/regexp.prototype.flags": {
      "version": "1.5.4",
      "resolved": "https://registry.npmjs.org/regexp.prototype.flags/-/regexp.prototype.flags-1.5.4.tgz",
      "integrity": "sha512-dYqgNSZbDwkaJ2ceRd9ojCGjBq+mOm9LmtXnAnEGyHhN/5R7iDW2TRw3h+o/jCFxus3P2LfWIIiwowAjANm7IA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.8",
        "define-properties": "^1.2.1",
        "es-errors": "^1.3.0",
        "get-proto": "^1.0.1",
        "gopd": "^1.2.0",
        "set-function-name": "^2.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/resolve": {
      "version": "1.22.11",
      "resolved": "https://registry.npmjs.org/resolve/-/resolve-1.22.11.tgz",
      "integrity": "sha512-RfqAvLnMl313r7c9oclB1HhUEAezcpLjz95wFH4LVuhk9JF/r22qmVP9AMmOU4vMX7Q8pN8jwNg/CSpdFnMjTQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "is-core-module": "^2.16.1",
        "path-parse": "^1.0.7",
        "supports-preserve-symlinks-flag": "^1.0.0"
      },
      "bin": {
        "resolve": "bin/resolve"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/resolve-from": {
      "version": "4.0.0",
      "resolved": "https://registry.npmjs.org/resolve-from/-/resolve-from-4.0.0.tgz",
      "integrity": "sha512-pb/MYmXstAkysRFx8piNI1tGFNQIFA3vkE3Gq4EuA1dF6gHp/+vgZqsCGJapvy8N3Q+4o7FwvquPJcnZ7RYy4g==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=4"
      }
    },
    "node_modules/resolve-pkg-maps": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/resolve-pkg-maps/-/resolve-pkg-maps-1.0.0.tgz",
      "integrity": "sha512-seS2Tj26TBVOC2NIc2rOe2y2ZO7efxITtLZcGSOnHHNOQ7CkiUBfw0Iw2ck6xkIhPwLhKNLS8BO+hEpngQlqzw==",
      "dev": true,
      "license": "MIT",
      "funding": {
        "url": "https://github.com/privatenumber/resolve-pkg-maps?sponsor=1"
      }
    },
    "node_modules/reusify": {
      "version": "1.1.0",
      "resolved": "https://registry.npmjs.org/reusify/-/reusify-1.1.0.tgz",
      "integrity": "sha512-g6QUff04oZpHs0eG5p83rFLhHeV00ug/Yf9nZM6fLeUrPguBTkTQOdpAWWspMh55TZfVQDPaN3NQJfbVRAxdIw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "iojs": ">=1.0.0",
        "node": ">=0.10.0"
      }
    },
    "node_modules/run-parallel": {
      "version": "1.2.0",
      "resolved": "https://registry.npmjs.org/run-parallel/-/run-parallel-1.2.0.tgz",
      "integrity": "sha512-5l4VyZR86LZ/lDxZTR6jqL8AFE2S0IFLMP26AbjsLVADxHdhB/c0GUsH+y39UfCi3dzz8OlQuPmnaJOMoDHQBA==",
      "dev": true,
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "queue-microtask": "^1.2.2"
      }
    },
    "node_modules/safe-array-concat": {
      "version": "1.1.3",
      "resolved": "https://registry.npmjs.org/safe-array-concat/-/safe-array-concat-1.1.3.tgz",
      "integrity": "sha512-AURm5f0jYEOydBj7VQlVvDrjeFgthDdEF5H1dP+6mNpoXOMo1quQqJ4wvJDyRZ9+pO3kGWoOdmV08cSv2aJV6Q==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.8",
        "call-bound": "^1.0.2",
        "get-intrinsic": "^1.2.6",
        "has-symbols": "^1.1.0",
        "isarray": "^2.0.5"
      },
      "engines": {
        "node": ">=0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/safe-push-apply": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/safe-push-apply/-/safe-push-apply-1.0.0.tgz",
      "integrity": "sha512-iKE9w/Z7xCzUMIZqdBsp6pEQvwuEebH4vdpjcDWnyzaI6yl6O9FHvVpmGelvEHNsoY6wGblkxR6Zty/h00WiSA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "es-errors": "^1.3.0",
        "isarray": "^2.0.5"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/safe-regex-test": {
      "version": "1.1.0",
      "resolved": "https://registry.npmjs.org/safe-regex-test/-/safe-regex-test-1.1.0.tgz",
      "integrity": "sha512-x/+Cz4YrimQxQccJf5mKEbIa1NzeCRNI5Ecl/ekmlYaampdNLPalVyIcCZNNH3MvmqBugV5TMYZXv0ljslUlaw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.2",
        "es-errors": "^1.3.0",
        "is-regex": "^1.2.1"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/scheduler": {
      "version": "0.27.0",
      "resolved": "https://registry.npmjs.org/scheduler/-/scheduler-0.27.0.tgz",
      "integrity": "sha512-eNv+WrVbKu1f3vbYJT/xtiF5syA5HPIMtf9IgY/nKg0sWqzAUEvqY/xm7OcZc/qafLx/iO9FgOmeSAp4v5ti/Q==",
      "license": "MIT"
    },
    "node_modules/semver": {
      "version": "6.3.1",
      "resolved": "https://registry.npmjs.org/semver/-/semver-6.3.1.tgz",
      "integrity": "sha512-BR7VvDCVHO+q2xBEWskxS6DJE1qRnb7DxzUrogb71CWoSficBxYsiAGd+Kl0mmq/MprG9yArRkyrQxTO6XjMzA==",
      "dev": true,
      "license": "ISC",
      "bin": {
        "semver": "bin/semver.js"
      }
    },
    "node_modules/set-function-length": {
      "version": "1.2.2",
      "resolved": "https://registry.npmjs.org/set-function-length/-/set-function-length-1.2.2.tgz",
      "integrity": "sha512-pgRc4hJ4/sNjWCSS9AmnS40x3bNMDTknHgL5UaMBTMyJnU90EgWh1Rz+MC9eFu4BuN/UwZjKQuY/1v3rM7HMfg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "define-data-property": "^1.1.4",
        "es-errors": "^1.3.0",
        "function-bind": "^1.1.2",
        "get-intrinsic": "^1.2.4",
        "gopd": "^1.0.1",
        "has-property-descriptors": "^1.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/set-function-name": {
      "version": "2.0.2",
      "resolved": "https://registry.npmjs.org/set-function-name/-/set-function-name-2.0.2.tgz",
      "integrity": "sha512-7PGFlmtwsEADb0WYyvCMa1t+yke6daIG4Wirafur5kcf+MhUnPms1UeR0CKQdTZD81yESwMHbtn+TR+dMviakQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "define-data-property": "^1.1.4",
        "es-errors": "^1.3.0",
        "functions-have-names": "^1.2.3",
        "has-property-descriptors": "^1.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/set-proto": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/set-proto/-/set-proto-1.0.0.tgz",
      "integrity": "sha512-RJRdvCo6IAnPdsvP/7m6bsQqNnn1FCBX5ZNtFL98MmFF/4xAIJTIg1YbHW5DC2W5SKZanrC6i4HsJqlajw/dZw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "dunder-proto": "^1.0.1",
        "es-errors": "^1.3.0",
        "es-object-atoms": "^1.0.0"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/sharp": {
      "version": "0.34.5",
      "resolved": "https://registry.npmjs.org/sharp/-/sharp-0.34.5.tgz",
      "integrity": "sha512-Ou9I5Ft9WNcCbXrU9cMgPBcCK8LiwLqcbywW3t4oDV37n1pzpuNLsYiAV8eODnjbtQlSDwZ2cUEeQz4E54Hltg==",
      "hasInstallScript": true,
      "license": "Apache-2.0",
      "optional": true,
      "dependencies": {
        "@img/colour": "^1.0.0",
        "detect-libc": "^2.1.2",
        "semver": "^7.7.3"
      },
      "engines": {
        "node": "^18.17.0 || ^20.3.0 || >=21.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-darwin-arm64": "0.34.5",
        "@img/sharp-darwin-x64": "0.34.5",
        "@img/sharp-libvips-darwin-arm64": "1.2.4",
        "@img/sharp-libvips-darwin-x64": "1.2.4",
        "@img/sharp-libvips-linux-arm": "1.2.4",
        "@img/sharp-libvips-linux-arm64": "1.2.4",
        "@img/sharp-libvips-linux-ppc64": "1.2.4",
        "@img/sharp-libvips-linux-riscv64": "1.2.4",
        "@img/sharp-libvips-linux-s390x": "1.2.4",
        "@img/sharp-libvips-linux-x64": "1.2.4",
        "@img/sharp-libvips-linuxmusl-arm64": "1.2.4",
        "@img/sharp-libvips-linuxmusl-x64": "1.2.4",
        "@img/sharp-linux-arm": "0.34.5",
        "@img/sharp-linux-arm64": "0.34.5",
        "@img/sharp-linux-ppc64": "0.34.5",
        "@img/sharp-linux-riscv64": "0.34.5",
        "@img/sharp-linux-s390x": "0.34.5",
        "@img/sharp-linux-x64": "0.34.5",
        "@img/sharp-linuxmusl-arm64": "0.34.5",
        "@img/sharp-linuxmusl-x64": "0.34.5",
        "@img/sharp-wasm32": "0.34.5",
        "@img/sharp-win32-arm64": "0.34.5",
        "@img/sharp-win32-ia32": "0.34.5",
        "@img/sharp-win32-x64": "0.34.5"
      }
    },
    "node_modules/sharp/node_modules/semver": {
      "version": "7.7.3",
      "resolved": "https://registry.npmjs.org/semver/-/semver-7.7.3.tgz",
      "integrity": "sha512-SdsKMrI9TdgjdweUSR9MweHA4EJ8YxHn8DFaDisvhVlUOe4BF1tLD7GAj0lIqWVl+dPb/rExr0Btby5loQm20Q==",
      "license": "ISC",
      "optional": true,
      "bin": {
        "semver": "bin/semver.js"
      },
      "engines": {
        "node": ">=10"
      }
    },
    "node_modules/shebang-command": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/shebang-command/-/shebang-command-2.0.0.tgz",
      "integrity": "sha512-kHxr2zZpYtdmrN1qDjrrX/Z1rR1kG8Dx+gkpK1G4eXmvXswmcE1hTWBWYUzlraYw1/yZp6YuDY77YtvbN0dmDA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "shebang-regex": "^3.0.0"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/shebang-regex": {
      "version": "3.0.0",
      "resolved": "https://registry.npmjs.org/shebang-regex/-/shebang-regex-3.0.0.tgz",
      "integrity": "sha512-7++dFhtcx3353uBaq8DDR4NuxBetBzC7ZQOhmTQInHEd6bSrXdiEyzCvG07Z44UYdLShWUyXt5M/yhz8ekcb1A==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/side-channel": {
      "version": "1.1.0",
      "resolved": "https://registry.npmjs.org/side-channel/-/side-channel-1.1.0.tgz",
      "integrity": "sha512-ZX99e6tRweoUXqR+VBrslhda51Nh5MTQwou5tnUDgbtyM0dBgmhEDtWGP/xbKn6hqfPRHujUNwz5fy/wbbhnpw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "es-errors": "^1.3.0",
        "object-inspect": "^1.13.3",
        "side-channel-list": "^1.0.0",
        "side-channel-map": "^1.0.1",
        "side-channel-weakmap": "^1.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/side-channel-list": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/side-channel-list/-/side-channel-list-1.0.0.tgz",
      "integrity": "sha512-FCLHtRD/gnpCiCHEiJLOwdmFP+wzCmDEkc9y7NsYxeF4u7Btsn1ZuwgwJGxImImHicJArLP4R0yX4c2KCrMrTA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "es-errors": "^1.3.0",
        "object-inspect": "^1.13.3"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/side-channel-map": {
      "version": "1.0.1",
      "resolved": "https://registry.npmjs.org/side-channel-map/-/side-channel-map-1.0.1.tgz",
      "integrity": "sha512-VCjCNfgMsby3tTdo02nbjtM/ewra6jPHmpThenkTYh8pG9ucZ/1P8So4u4FGBek/BjpOVsDCMoLA/iuBKIFXRA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.2",
        "es-errors": "^1.3.0",
        "get-intrinsic": "^1.2.5",
        "object-inspect": "^1.13.3"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/side-channel-weakmap": {
      "version": "1.0.2",
      "resolved": "https://registry.npmjs.org/side-channel-weakmap/-/side-channel-weakmap-1.0.2.tgz",
      "integrity": "sha512-WPS/HvHQTYnHisLo9McqBHOJk2FkHO/tlpvldyrnem4aeQp4hai3gythswg6p01oSoTl58rcpiFAjF2br2Ak2A==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.2",
        "es-errors": "^1.3.0",
        "get-intrinsic": "^1.2.5",
        "object-inspect": "^1.13.3",
        "side-channel-map": "^1.0.1"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/source-map-js": {
      "version": "1.2.1",
      "resolved": "https://registry.npmjs.org/source-map-js/-/source-map-js-1.2.1.tgz",
      "integrity": "sha512-UXWMKhLOwVKb728IUtQPXxfYU+usdybtUrK/8uGE8CQMvrhOpwvzDBwj0QhSL7MQc7vIsISBG8VQ8+IDQxpfQA==",
      "license": "BSD-3-Clause",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/stable-hash": {
      "version": "0.0.5",
      "resolved": "https://registry.npmjs.org/stable-hash/-/stable-hash-0.0.5.tgz",
      "integrity": "sha512-+L3ccpzibovGXFK+Ap/f8LOS0ahMrHTf3xu7mMLSpEGU0EO9ucaysSylKo9eRDFNhWve/y275iPmIZ4z39a9iA==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/stop-iteration-iterator": {
      "version": "1.1.0",
      "resolved": "https://registry.npmjs.org/stop-iteration-iterator/-/stop-iteration-iterator-1.1.0.tgz",
      "integrity": "sha512-eLoXW/DHyl62zxY4SCaIgnRhuMr6ri4juEYARS8E6sCEqzKpOiE521Ucofdx+KnDZl5xmvGYaaKCk5FEOxJCoQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "es-errors": "^1.3.0",
        "internal-slot": "^1.1.0"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/string.prototype.includes": {
      "version": "2.0.1",
      "resolved": "https://registry.npmjs.org/string.prototype.includes/-/string.prototype.includes-2.0.1.tgz",
      "integrity": "sha512-o7+c9bW6zpAdJHTtujeePODAhkuicdAryFsfVKwA+wGw89wJ4GTY484WTucM9hLtDEOpOvI+aHnzqnC5lHp4Rg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.7",
        "define-properties": "^1.2.1",
        "es-abstract": "^1.23.3"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/string.prototype.matchall": {
      "version": "4.0.12",
      "resolved": "https://registry.npmjs.org/string.prototype.matchall/-/string.prototype.matchall-4.0.12.tgz",
      "integrity": "sha512-6CC9uyBL+/48dYizRf7H7VAYCMCNTBeM78x/VTUe9bFEaxBepPJDa1Ow99LqI/1yF7kuy7Q3cQsYMrcjGUcskA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.8",
        "call-bound": "^1.0.3",
        "define-properties": "^1.2.1",
        "es-abstract": "^1.23.6",
        "es-errors": "^1.3.0",
        "es-object-atoms": "^1.0.0",
        "get-intrinsic": "^1.2.6",
        "gopd": "^1.2.0",
        "has-symbols": "^1.1.0",
        "internal-slot": "^1.1.0",
        "regexp.prototype.flags": "^1.5.3",
        "set-function-name": "^2.0.2",
        "side-channel": "^1.1.0"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/string.prototype.repeat": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/string.prototype.repeat/-/string.prototype.repeat-1.0.0.tgz",
      "integrity": "sha512-0u/TldDbKD8bFCQ/4f5+mNRrXwZ8hg2w7ZR8wa16e8z9XpePWl3eGEcUD0OXpEH/VJH/2G3gjUtR3ZOiBe2S/w==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "define-properties": "^1.1.3",
        "es-abstract": "^1.17.5"
      }
    },
    "node_modules/string.prototype.trim": {
      "version": "1.2.10",
      "resolved": "https://registry.npmjs.org/string.prototype.trim/-/string.prototype.trim-1.2.10.tgz",
      "integrity": "sha512-Rs66F0P/1kedk5lyYyH9uBzuiI/kNRmwJAR9quK6VOtIpZ2G+hMZd+HQbbv25MgCA6gEffoMZYxlTod4WcdrKA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.8",
        "call-bound": "^1.0.2",
        "define-data-property": "^1.1.4",
        "define-properties": "^1.2.1",
        "es-abstract": "^1.23.5",
        "es-object-atoms": "^1.0.0",
        "has-property-descriptors": "^1.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/string.prototype.trimend": {
      "version": "1.0.9",
      "resolved": "https://registry.npmjs.org/string.prototype.trimend/-/string.prototype.trimend-1.0.9.tgz",
      "integrity": "sha512-G7Ok5C6E/j4SGfyLCloXTrngQIQU3PWtXGst3yM7Bea9FRURf1S42ZHlZZtsNque2FN2PoUhfZXYLNWwEr4dLQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.8",
        "call-bound": "^1.0.2",
        "define-properties": "^1.2.1",
        "es-object-atoms": "^1.0.0"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/string.prototype.trimstart": {
      "version": "1.0.8",
      "resolved": "https://registry.npmjs.org/string.prototype.trimstart/-/string.prototype.trimstart-1.0.8.tgz",
      "integrity": "sha512-UXSH262CSZY1tfu3G3Secr6uGLCFVPMhIqHjlgCUtCCcgihYc/xKs9djMTMUOb2j1mVSeU8EU6NWc/iQKU6Gfg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.7",
        "define-properties": "^1.2.1",
        "es-object-atoms": "^1.0.0"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/strip-bom": {
      "version": "3.0.0",
      "resolved": "https://registry.npmjs.org/strip-bom/-/strip-bom-3.0.0.tgz",
      "integrity": "sha512-vavAMRXOgBVNF6nyEEmL3DBK19iRpDcoIwW+swQ+CbGiu7lju6t+JklA1MHweoWtadgt4ISVUsXLyDq34ddcwA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=4"
      }
    },
    "node_modules/strip-json-comments": {
      "version": "3.1.1",
      "resolved": "https://registry.npmjs.org/strip-json-comments/-/strip-json-comments-3.1.1.tgz",
      "integrity": "sha512-6fPc+R4ihwqP6N/aIv2f1gMH8lOVtWQHoqC4yK6oSDVVocumAsfCqjkXnqiYMhmMwS/mEHLp7Vehlt3ql6lEig==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/styled-jsx": {
      "version": "5.1.6",
      "resolved": "https://registry.npmjs.org/styled-jsx/-/styled-jsx-5.1.6.tgz",
      "integrity": "sha512-qSVyDTeMotdvQYoHWLNGwRFJHC+i+ZvdBRYosOFgC+Wg1vx4frN2/RG/NA7SYqqvKNLf39P2LSRA2pu6n0XYZA==",
      "license": "MIT",
      "dependencies": {
        "client-only": "0.0.1"
      },
      "engines": {
        "node": ">= 12.0.0"
      },
      "peerDependencies": {
        "react": ">= 16.8.0 || 17.x.x || ^18.0.0-0 || ^19.0.0-0"
      },
      "peerDependenciesMeta": {
        "@babel/core": {
          "optional": true
        },
        "babel-plugin-macros": {
          "optional": true
        }
      }
    },
    "node_modules/supports-color": {
      "version": "7.2.0",
      "resolved": "https://registry.npmjs.org/supports-color/-/supports-color-7.2.0.tgz",
      "integrity": "sha512-qpCAvRl9stuOHveKsn7HncJRvv501qIacKzQlO/+Lwxc9+0q2wLyv4Dfvt80/DPn2pqOBsJdDiogXGR9+OvwRw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "has-flag": "^4.0.0"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/supports-preserve-symlinks-flag": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/supports-preserve-symlinks-flag/-/supports-preserve-symlinks-flag-1.0.0.tgz",
      "integrity": "sha512-ot0WnXS9fgdkgIcePe6RHNk1WA8+muPa6cSjeR3V8K27q9BB1rTE3R1p7Hv0z1ZyAc8s6Vvv8DIyWf681MAt0w==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/tailwindcss": {
      "version": "4.1.17",
      "resolved": "https://registry.npmjs.org/tailwindcss/-/tailwindcss-4.1.17.tgz",
      "integrity": "sha512-j9Ee2YjuQqYT9bbRTfTZht9W/ytp5H+jJpZKiYdP/bpnXARAuELt9ofP0lPnmHjbga7SNQIxdTAXCmtKVYjN+Q==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/tapable": {
      "version": "2.3.0",
      "resolved": "https://registry.npmjs.org/tapable/-/tapable-2.3.0.tgz",
      "integrity": "sha512-g9ljZiwki/LfxmQADO3dEY1CbpmXT5Hm2fJ+QaGKwSXUylMybePR7/67YW7jOrrvjEgL1Fmz5kzyAjWVWLlucg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/webpack"
      }
    },
    "node_modules/tinyglobby": {
      "version": "0.2.15",
      "resolved": "https://registry.npmjs.org/tinyglobby/-/tinyglobby-0.2.15.tgz",
      "integrity": "sha512-j2Zq4NyQYG5XMST4cbs02Ak8iJUdxRM0XI5QyxXuZOzKOINmWurp3smXu3y5wDcJrptwpSjgXHzIQxR0omXljQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "fdir": "^6.5.0",
        "picomatch": "^4.0.3"
      },
      "engines": {
        "node": ">=12.0.0"
      },
      "funding": {
        "url": "https://github.com/sponsors/SuperchupuDev"
      }
    },
    "node_modules/tinyglobby/node_modules/fdir": {
      "version": "6.5.0",
      "resolved": "https://registry.npmjs.org/fdir/-/fdir-6.5.0.tgz",
      "integrity": "sha512-tIbYtZbucOs0BRGqPJkshJUYdL+SDH7dVM8gjy+ERp3WAUjLEFJE+02kanyHtwjWOnwrKYBiwAmM0p4kLJAnXg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=12.0.0"
      },
      "peerDependencies": {
        "picomatch": "^3 || ^4"
      },
      "peerDependenciesMeta": {
        "picomatch": {
          "optional": true
        }
      }
    },
    "node_modules/tinyglobby/node_modules/picomatch": {
      "version": "4.0.3",
      "resolved": "https://registry.npmjs.org/picomatch/-/picomatch-4.0.3.tgz",
      "integrity": "sha512-5gTmgEY/sqK6gFXLIsQNH19lWb4ebPDLA4SdLP7dsWkIXHWlG66oPuVvXSGFPppYZz8ZDZq0dYYrbHfBCVUb1Q==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=12"
      },
      "funding": {
        "url": "https://github.com/sponsors/jonschlinkert"
      }
    },
    "node_modules/to-regex-range": {
      "version": "5.0.1",
      "resolved": "https://registry.npmjs.org/to-regex-range/-/to-regex-range-5.0.1.tgz",
      "integrity": "sha512-65P7iz6X5yEr1cwcgvQxbbIw7Uk3gOy5dIdtZ4rDveLqhrdJP+Li/Hx6tyK0NEb+2GCyneCMJiGqrADCSNk8sQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "is-number": "^7.0.0"
      },
      "engines": {
        "node": ">=8.0"
      }
    },
    "node_modules/ts-api-utils": {
      "version": "2.1.0",
      "resolved": "https://registry.npmjs.org/ts-api-utils/-/ts-api-utils-2.1.0.tgz",
      "integrity": "sha512-CUgTZL1irw8u29bzrOD/nH85jqyc74D6SshFgujOIA7osm2Rz7dYH77agkx7H4FBNxDq7Cjf+IjaX/8zwFW+ZQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=18.12"
      },
      "peerDependencies": {
        "typescript": ">=4.8.4"
      }
    },
    "node_modules/tsconfig-paths": {
      "version": "3.15.0",
      "resolved": "https://registry.npmjs.org/tsconfig-paths/-/tsconfig-paths-3.15.0.tgz",
      "integrity": "sha512-2Ac2RgzDe/cn48GvOe3M+o82pEFewD3UPbyoUHHdKasHwJKjds4fLXWf/Ux5kATBKN20oaFGu+jbElp1pos0mg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@types/json5": "^0.0.29",
        "json5": "^1.0.2",
        "minimist": "^1.2.6",
        "strip-bom": "^3.0.0"
      }
    },
    "node_modules/tsconfig-paths/node_modules/json5": {
      "version": "1.0.2",
      "resolved": "https://registry.npmjs.org/json5/-/json5-1.0.2.tgz",
      "integrity": "sha512-g1MWMLBiz8FKi1e4w0UyVL3w+iJceWAFBAaBnnGKOpNa5f8TLktkbre1+s6oICydWAm+HRUGTmI+//xv2hvXYA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "minimist": "^1.2.0"
      },
      "bin": {
        "json5": "lib/cli.js"
      }
    },
    "node_modules/tslib": {
      "version": "2.8.1",
      "resolved": "https://registry.npmjs.org/tslib/-/tslib-2.8.1.tgz",
      "integrity": "sha512-oJFu94HQb+KVduSUQL7wnpmqnfmLsOA/nAh6b6EH0wCEoK0/mPeXU6c3wKDV83MkOuHPRHtSXKKU99IBazS/2w==",
      "license": "0BSD"
    },
    "node_modules/type-check": {
      "version": "0.4.0",
      "resolved": "https://registry.npmjs.org/type-check/-/type-check-0.4.0.tgz",
      "integrity": "sha512-XleUoc9uwGXqjWwXaUTZAmzMcFZ5858QA2vvx1Ur5xIcixXIP+8LnFDgRplU30us6teqdlskFfu+ae4K79Ooew==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "prelude-ls": "^1.2.1"
      },
      "engines": {
        "node": ">= 0.8.0"
      }
    },
    "node_modules/typed-array-buffer": {
      "version": "1.0.3",
      "resolved": "https://registry.npmjs.org/typed-array-buffer/-/typed-array-buffer-1.0.3.tgz",
      "integrity": "sha512-nAYYwfY3qnzX30IkA6AQZjVbtK6duGontcQm1WSG1MD94YLqK0515GNApXkoxKOWMusVssAHWLh9SeaoefYFGw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.3",
        "es-errors": "^1.3.0",
        "is-typed-array": "^1.1.14"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/typed-array-byte-length": {
      "version": "1.0.3",
      "resolved": "https://registry.npmjs.org/typed-array-byte-length/-/typed-array-byte-length-1.0.3.tgz",
      "integrity": "sha512-BaXgOuIxz8n8pIq3e7Atg/7s+DpiYrxn4vdot3w9KbnBhcRQq6o3xemQdIfynqSeXeDrF32x+WvfzmOjPiY9lg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.8",
        "for-each": "^0.3.3",
        "gopd": "^1.2.0",
        "has-proto": "^1.2.0",
        "is-typed-array": "^1.1.14"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/typed-array-byte-offset": {
      "version": "1.0.4",
      "resolved": "https://registry.npmjs.org/typed-array-byte-offset/-/typed-array-byte-offset-1.0.4.tgz",
      "integrity": "sha512-bTlAFB/FBYMcuX81gbL4OcpH5PmlFHqlCCpAl8AlEzMz5k53oNDvN8p1PNOWLEmI2x4orp3raOFB51tv9X+MFQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "available-typed-arrays": "^1.0.7",
        "call-bind": "^1.0.8",
        "for-each": "^0.3.3",
        "gopd": "^1.2.0",
        "has-proto": "^1.2.0",
        "is-typed-array": "^1.1.15",
        "reflect.getprototypeof": "^1.0.9"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/typed-array-length": {
      "version": "1.0.7",
      "resolved": "https://registry.npmjs.org/typed-array-length/-/typed-array-length-1.0.7.tgz",
      "integrity": "sha512-3KS2b+kL7fsuk/eJZ7EQdnEmQoaho/r6KUef7hxvltNA5DR8NAUM+8wJMbJyZ4G9/7i3v5zPBIMN5aybAh2/Jg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.7",
        "for-each": "^0.3.3",
        "gopd": "^1.0.1",
        "is-typed-array": "^1.1.13",
        "possible-typed-array-names": "^1.0.0",
        "reflect.getprototypeof": "^1.0.6"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/typescript": {
      "version": "5.9.3",
      "resolved": "https://registry.npmjs.org/typescript/-/typescript-5.9.3.tgz",
      "integrity": "sha512-jl1vZzPDinLr9eUt3J/t7V6FgNEw9QjvBPdysz9KfQDD41fQrC2Y4vKQdiaUpFT4bXlb1RHhLpp8wtm6M5TgSw==",
      "dev": true,
      "license": "Apache-2.0",
      "bin": {
        "tsc": "bin/tsc",
        "tsserver": "bin/tsserver"
      },
      "engines": {
        "node": ">=14.17"
      }
    },
    "node_modules/typescript-eslint": {
      "version": "8.47.0",
      "resolved": "https://registry.npmjs.org/typescript-eslint/-/typescript-eslint-8.47.0.tgz",
      "integrity": "sha512-Lwe8i2XQ3WoMjua/r1PHrCTpkubPYJCAfOurtn+mtTzqB6jNd+14n9UN1bJ4s3F49x9ixAm0FLflB/JzQ57M8Q==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@typescript-eslint/eslint-plugin": "8.47.0",
        "@typescript-eslint/parser": "8.47.0",
        "@typescript-eslint/typescript-estree": "8.47.0",
        "@typescript-eslint/utils": "8.47.0"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/typescript-eslint"
      },
      "peerDependencies": {
        "eslint": "^8.57.0 || ^9.0.0",
        "typescript": ">=4.8.4 <6.0.0"
      }
    },
    "node_modules/unbox-primitive": {
      "version": "1.1.0",
      "resolved": "https://registry.npmjs.org/unbox-primitive/-/unbox-primitive-1.1.0.tgz",
      "integrity": "sha512-nWJ91DjeOkej/TA8pXQ3myruKpKEYgqvpw9lz4OPHj/NWFNluYrjbz9j01CJ8yKQd2g4jFoOkINCTW2I5LEEyw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.3",
        "has-bigints": "^1.0.2",
        "has-symbols": "^1.1.0",
        "which-boxed-primitive": "^1.1.1"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/undici-types": {
      "version": "6.21.0",
      "resolved": "https://registry.npmjs.org/undici-types/-/undici-types-6.21.0.tgz",
      "integrity": "sha512-iwDZqg0QAGrg9Rav5H4n0M64c3mkR59cJ6wQp+7C4nI0gsmExaedaYLNO44eT4AtBBwjbTiGPMlt2Md0T9H9JQ==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/unrs-resolver": {
      "version": "1.11.1",
      "resolved": "https://registry.npmjs.org/unrs-resolver/-/unrs-resolver-1.11.1.tgz",
      "integrity": "sha512-bSjt9pjaEBnNiGgc9rUiHGKv5l4/TGzDmYw3RhnkJGtLhbnnA/5qJj7x3dNDCRx/PJxu774LlH8lCOlB4hEfKg==",
      "dev": true,
      "hasInstallScript": true,
      "license": "MIT",
      "dependencies": {
        "napi-postinstall": "^0.3.0"
      },
      "funding": {
        "url": "https://opencollective.com/unrs-resolver"
      },
      "optionalDependencies": {
        "@unrs/resolver-binding-android-arm-eabi": "1.11.1",
        "@unrs/resolver-binding-android-arm64": "1.11.1",
        "@unrs/resolver-binding-darwin-arm64": "1.11.1",
        "@unrs/resolver-binding-darwin-x64": "1.11.1",
        "@unrs/resolver-binding-freebsd-x64": "1.11.1",
        "@unrs/resolver-binding-linux-arm-gnueabihf": "1.11.1",
        "@unrs/resolver-binding-linux-arm-musleabihf": "1.11.1",
        "@unrs/resolver-binding-linux-arm64-gnu": "1.11.1",
        "@unrs/resolver-binding-linux-arm64-musl": "1.11.1",
        "@unrs/resolver-binding-linux-ppc64-gnu": "1.11.1",
        "@unrs/resolver-binding-linux-riscv64-gnu": "1.11.1",
        "@unrs/resolver-binding-linux-riscv64-musl": "1.11.1",
        "@unrs/resolver-binding-linux-s390x-gnu": "1.11.1",
        "@unrs/resolver-binding-linux-x64-gnu": "1.11.1",
        "@unrs/resolver-binding-linux-x64-musl": "1.11.1",
        "@unrs/resolver-binding-wasm32-wasi": "1.11.1",
        "@unrs/resolver-binding-win32-arm64-msvc": "1.11.1",
        "@unrs/resolver-binding-win32-ia32-msvc": "1.11.1",
        "@unrs/resolver-binding-win32-x64-msvc": "1.11.1"
      }
    },
    "node_modules/update-browserslist-db": {
      "version": "1.1.4",
      "resolved": "https://registry.npmjs.org/update-browserslist-db/-/update-browserslist-db-1.1.4.tgz",
      "integrity": "sha512-q0SPT4xyU84saUX+tomz1WLkxUbuaJnR1xWt17M7fJtEJigJeWUNGUqrauFXsHnqev9y9JTRGwk13tFBuKby4A==",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/browserslist"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/browserslist"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "escalade": "^3.2.0",
        "picocolors": "^1.1.1"
      },
      "bin": {
        "update-browserslist-db": "cli.js"
      },
      "peerDependencies": {
        "browserslist": ">= 4.21.0"
      }
    },
    "node_modules/uri-js": {
      "version": "4.4.1",
      "resolved": "https://registry.npmjs.org/uri-js/-/uri-js-4.4.1.tgz",
      "integrity": "sha512-7rKUyy33Q1yc98pQ1DAmLtwX109F7TIfWlW1Ydo8Wl1ii1SeHieeh0HHfPeL2fMXK6z0s8ecKs9frCuLJvndBg==",
      "dev": true,
      "license": "BSD-2-Clause",
      "dependencies": {
        "punycode": "^2.1.0"
      }
    },
    "node_modules/which": {
      "version": "2.0.2",
      "resolved": "https://registry.npmjs.org/which/-/which-2.0.2.tgz",
      "integrity": "sha512-BLI3Tl1TW3Pvl70l3yq3Y64i+awpwXqsGBYWkkqMtnbXgrMD+yj7rhW0kuEDxzJaYXGjEW5ogapKNMEKNMjibA==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "isexe": "^2.0.0"
      },
      "bin": {
        "node-which": "bin/node-which"
      },
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/which-boxed-primitive": {
      "version": "1.1.1",
      "resolved": "https://registry.npmjs.org/which-boxed-primitive/-/which-boxed-primitive-1.1.1.tgz",
      "integrity": "sha512-TbX3mj8n0odCBFVlY8AxkqcHASw3L60jIuF8jFP78az3C2YhmGvqbHBpAjTRH2/xqYunrJ9g1jSyjCjpoWzIAA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "is-bigint": "^1.1.0",
        "is-boolean-object": "^1.2.1",
        "is-number-object": "^1.1.1",
        "is-string": "^1.1.1",
        "is-symbol": "^1.1.1"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/which-builtin-type": {
      "version": "1.2.1",
      "resolved": "https://registry.npmjs.org/which-builtin-type/-/which-builtin-type-1.2.1.tgz",
      "integrity": "sha512-6iBczoX+kDQ7a3+YJBnh3T+KZRxM/iYNPXicqk66/Qfm1b93iu+yOImkg0zHbj5LNOcNv1TEADiZ0xa34B4q6Q==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.2",
        "function.prototype.name": "^1.1.6",
        "has-tostringtag": "^1.0.2",
        "is-async-function": "^2.0.0",
        "is-date-object": "^1.1.0",
        "is-finalizationregistry": "^1.1.0",
        "is-generator-function": "^1.0.10",
        "is-regex": "^1.2.1",
        "is-weakref": "^1.0.2",
        "isarray": "^2.0.5",
        "which-boxed-primitive": "^1.1.0",
        "which-collection": "^1.0.2",
        "which-typed-array": "^1.1.16"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/which-collection": {
      "version": "1.0.2",
      "resolved": "https://registry.npmjs.org/which-collection/-/which-collection-1.0.2.tgz",
      "integrity": "sha512-K4jVyjnBdgvc86Y6BkaLZEN933SwYOuBFkdmBu9ZfkcAbdVbpITnDmjvZ/aQjRXQrv5EPkTnD1s39GiiqbngCw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "is-map": "^2.0.3",
        "is-set": "^2.0.3",
        "is-weakmap": "^2.0.2",
        "is-weakset": "^2.0.3"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/which-typed-array": {
      "version": "1.1.19",
      "resolved": "https://registry.npmjs.org/which-typed-array/-/which-typed-array-1.1.19.tgz",
      "integrity": "sha512-rEvr90Bck4WZt9HHFC4DJMsjvu7x+r6bImz0/BrbWb7A2djJ8hnZMrWnHo9F8ssv0OMErasDhftrfROTyqSDrw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "available-typed-arrays": "^1.0.7",
        "call-bind": "^1.0.8",
        "call-bound": "^1.0.4",
        "for-each": "^0.3.5",
        "get-proto": "^1.0.1",
        "gopd": "^1.2.0",
        "has-tostringtag": "^1.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/word-wrap": {
      "version": "1.2.5",
      "resolved": "https://registry.npmjs.org/word-wrap/-/word-wrap-1.2.5.tgz",
      "integrity": "sha512-BN22B5eaMMI9UMtjrGd5g5eCYPpCPDUy0FJXbYsaT5zYxjFOckS53SQDE3pWkVoWpHXVb3BrYcEN4Twa55B5cA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/yallist": {
      "version": "3.1.1",
      "resolved": "https://registry.npmjs.org/yallist/-/yallist-3.1.1.tgz",
      "integrity": "sha512-a4UGQaWPH59mOXUYnAG2ewncQS4i4F43Tv3JoAM+s2VDAmS9NsK8GpDMLrCHPksFT7h3K6TOoUNn2pb7RoXx4g==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/yocto-queue": {
      "version": "0.1.0",
      "resolved": "https://registry.npmjs.org/yocto-queue/-/yocto-queue-0.1.0.tgz",
      "integrity": "sha512-rVksvsnNCdJ/ohGc6xgPwyN8eheCxsiLM8mxuE/t/mOVqJewPuO1miLpTHQiRgTKCLexL4MeAFVagts7HmNZ2Q==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/zod": {
      "version": "4.1.13",
      "resolved": "https://registry.npmjs.org/zod/-/zod-4.1.13.tgz",
      "integrity": "sha512-AvvthqfqrAhNH9dnfmrfKzX5upOdjUVJYFqNSlkmGf64gRaTzlPwz99IHYnVs28qYAybvAlBV+H7pn0saFY4Ig==",
      "dev": true,
      "license": "MIT",
      "funding": {
        "url": "https://github.com/sponsors/colinhacks"
      }
    },
    "node_modules/zod-validation-error": {
      "version": "4.0.2",
      "resolved": "https://registry.npmjs.org/zod-validation-error/-/zod-validation-error-4.0.2.tgz",
      "integrity": "sha512-Q6/nZLe6jxuU80qb/4uJ4t5v2VEZ44lzQjPDhYJNztRQ4wyWc6VF3D3Kb/fAuPetZQnhS3hnajCf9CsWesghLQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=18.0.0"
      },
      "peerDependencies": {
        "zod": "^3.25.0 || ^4.0.0"
      }
    }
  }
}

```

### package.json
```json
{
  "name": "expatise",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "@fortawesome/fontawesome-svg-core": "^7.1.0",
    "@fortawesome/free-brands-svg-icons": "^7.1.0",
    "@fortawesome/free-solid-svg-icons": "^7.1.0",
    "@fortawesome/react-fontawesome": "^3.1.1",
    "next": "^16.0.8",
    "next-auth": "^5.0.0-beta.30",
    "react": "19.2.0",
    "react-dom": "19.2.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "baseline-browser-mapping": "^2.9.5",
    "eslint": "^9",
    "eslint-config-next": "16.0.3",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}

```

### proxy.ts
```tsx
// middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { isBypassPath } from './lib/middleware/paths';
import { applyOnboardingGate } from './lib/middleware/onboarding';
import { applyAuthGate } from './lib/middleware/auth';

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isBypassPath(pathname)) return NextResponse.next();

  const onboardingRes = applyOnboardingGate(req);
  if (onboardingRes) return onboardingRes;

  const authRes = applyAuthGate(req);
  if (authRes) return authRes;

  return NextResponse.next();
}

export const config = {
  // Run for all pages except Next internals, static assets, and API routes
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images|api).*)'],
};

```

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts",
    "**/*.mts"
  ],
  "exclude": ["node_modules"]
}

```

