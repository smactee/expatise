/* app/account-deletion/page.tsx */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Account & Data Deletion · Expatise",
  description:
    "How to request deletion of your Expatise account and associated data (in-app or by email).",
};

const APP_NAME = "Expatise";

// ✅ Replace this with your real support email (must be actively monitored).
const SUPPORT_EMAIL = "maverixnmatrix@gmail.com";

// ✅ Pick a timeframe you can truly honor.
// If you’re not sure, “30 days” is common. Adjust as needed.
const PROCESSING_TIME_DAYS = 30;

export default function AccountDeletionPage() {
  const subject = "Account deletion request";
  const bodyLines = [
    `Hello ${APP_NAME} Support,`,
    "",
    "Please delete my account and associated data.",
    "",
    "Account details (so you can locate me):",
    "- Sign-in email (or provider, e.g., Google/Apple):",
    "- Username / display name (if applicable):",
    "",
    "Thank you.",
  ];
  const mailtoHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(bodyLines.join("\n"))}`;

  const styles: Record<string, React.CSSProperties> = {
    main: {
      maxWidth: 820,
      margin: "0 auto",
      padding: "28px 18px",
      lineHeight: 1.65,
    },
    card: {
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 14,
      padding: 16,
      marginTop: 14,
      background: "rgba(0,0,0,0.12)",
    },
    h1: { fontSize: 28, fontWeight: 800, marginBottom: 10 },
    h2: { fontSize: 18, fontWeight: 750, marginTop: 18, marginBottom: 8 },
    p: { opacity: 0.9, marginTop: 8 },
    small: { opacity: 0.75, marginTop: 10 },
    ul: { marginTop: 8, paddingLeft: 18, opacity: 0.9 },
    code: {
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: 13,
      padding: "2px 6px",
      borderRadius: 6,
      background: "rgba(255,255,255,0.08)",
    },
    a: { textDecoration: "underline" },
  };

  return (
    <main style={styles.main}>
      <h1 style={styles.h1}>Account &amp; Data Deletion</h1>

      <p style={styles.p}>
        This page explains how to request deletion of your <b>{APP_NAME}</b>{" "}
        account and associated data.
      </p>

      <div style={styles.card}>
        <p style={{ ...styles.p, marginTop: 0 }}>
          <b>Quick options:</b>
        </p>
        <ul style={{ ...styles.ul, marginBottom: 0 }}>
          <li>
            <a style={styles.a} href="#in-app">
              Option A — Delete inside the app
            </a>
          </li>
          <li>
            <a style={styles.a} href="#email">
              Option B — Request deletion by email
            </a>
          </li>
        </ul>
      </div>

      <h2 id="in-app" style={styles.h2}>
        Option A — In-app deletion
      </h2>
      <p style={styles.p}>
        If you can access the app, go to <b>Profile → Delete Account</b> and
        follow the steps shown on screen.
      </p>

      <h2 id="email" style={styles.h2}>
        Option B — Request deletion by email (if you can’t access the app)
      </h2>
      <p style={styles.p}>
        Email us at{" "}
        <a style={styles.a} href={mailtoHref}>
          {SUPPORT_EMAIL}
        </a>{" "}
        with the subject <span style={styles.code}>{subject}</span>.
      </p>

      <p style={styles.p}>Please include:</p>
      <ul style={styles.ul}>
        <li>The email you used to sign in (or the provider, e.g., Google/Apple)</li>
        <li>Any helpful identifier (username/display name) if applicable</li>
        <li>A clear statement: “Please delete my account and associated data.”</li>
      </ul>

      <p style={styles.small}>
        To protect your account, we may ask you to verify ownership before
        processing the deletion request.
      </p>

      <h2 style={styles.h2}>Processing time</h2>
      <p style={styles.p}>
        After verification (if needed), we typically complete deletion requests
        within <b>{PROCESSING_TIME_DAYS} days</b>.
      </p>

      <h2 style={styles.h2}>What we delete</h2>
      <ul style={styles.ul}>
        <li>Your account record (authentication/profile)</li>
        <li>Data associated with your account stored on our servers</li>
      </ul>

      <p style={styles.small}>
        If your app has specific data types (posts, chat messages, listings,
        saved items, logs), list them here for extra clarity.
      </p>

      <h2 style={styles.h2}>What we may retain</h2>
      <ul style={styles.ul}>
        <li>Limited information if required by law, compliance, or dispute handling</li>
        <li>Security/fraud-prevention records where applicable</li>
      </ul>

      <p style={styles.small}>
        Backups may retain data for a limited period before being overwritten.
        When possible, retained data is restricted and minimized.
      </p>

      <h2 style={styles.h2}>Need help?</h2>
      <p style={styles.p}>
        If you can’t access the email you signed up with, contact{" "}
        <a style={styles.a} href={`mailto:${SUPPORT_EMAIL}`}>
          {SUPPORT_EMAIL}
        </a>{" "}
        and explain your situation. We’ll tell you what we can do safely.
      </p>

      <p style={styles.small}>Last updated: 2026-03-01</p>
    </main>
  );
}