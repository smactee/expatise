// app/terms/page.tsx
import LegalPageShell, { legalH2Style } from "@/components/LegalPageShell";
import { APP_NAME, DEVELOPER_ENTITY, CONTACT_EMAIL } from "@/lib/legal/constants";

export const metadata = {
  title: "Terms of Service · Expatise",
};

const EFFECTIVE_DATE = "2026-03-08";
const LAST_UPDATED = "2026-03-08";

export default function TermsPage() {
  return (
    <LegalPageShell
      title="Terms of Service"
      effectiveDate={EFFECTIVE_DATE}
      lastUpdated={LAST_UPDATED}
      footer={
        <section style={{ fontSize: 13, opacity: 0.75, lineHeight: 1.55 }}>
        <p style={{ marginTop: 0 }}>
          <b>Legal note.</b> This document is provided for general information and does not
          constitute legal advice.
        </p>
        <p style={{ marginTop: 10 }}>
          If any provision is unenforceable, the remaining provisions remain in effect.
        </p>
        <p style={{ marginTop: 10 }}>
          If translated versions exist, the English version controls in case of conflict.
        </p>
      </section>
      }
    >
      <p style={{ marginTop: 16 }}>
        These Terms of Service (“Terms”) govern your use of <b>{APP_NAME}</b>
        (the “App”), operated by <b>{DEVELOPER_ENTITY}</b> (“we”, “us”, “our”).
        By using the App, you agree to these Terms.
      </p>

      <h2 style={legalH2Style}>
        1) Eligibility and account
      </h2>
      <ul style={{ paddingLeft: 18 }}>
        <li>
          You may use the App as a guest or with an account (email/social sign-in).
        </li>
        <li>
          You are responsible for account activity and keeping login credentials secure.
        </li>
        <li>
          You must provide accurate information and keep your account details up to date.
        </li>
      </ul>

      <h2 style={legalH2Style}>
        2) What the App provides
      </h2>
      <p>
        {APP_NAME} provides study tools for driving-license exam preparation,
        including question practice, bookmarks, mistake review, progress tracking,
        statistics, and premium-only features.
      </p>

      <h2 style={legalH2Style}>
        3) Premium, billing, and subscriptions
      </h2>
      <ul style={{ paddingLeft: 18 }}>
        <li>
          Some features require an active Premium entitlement.
        </li>
        <li>
          Purchases are processed by third parties (such as Google Play / Apple and RevenueCat where enabled).
        </li>
        <li>
          Subscription renewals, cancellations, and refunds are governed by the store/payment platform terms.
        </li>
        <li>
          We may change premium features or pricing where legally permitted.
        </li>
      </ul>

      <h2 style={legalH2Style}>
        4) Acceptable use
      </h2>
      <p>You agree not to:</p>
      <ul style={{ paddingLeft: 18 }}>
        <li>Use the App for unlawful, abusive, or fraudulent activity.</li>
        <li>Attempt to reverse engineer, scrape, or disrupt the App or services.</li>
        <li>Bypass feature gates, payment logic, or security controls.</li>
        <li>Upload or transmit malicious code or harmful content.</li>
      </ul>

      <h2 style={legalH2Style}>
        5) AI coach and informational use
      </h2>
      <ul style={{ paddingLeft: 18 }}>
        <li>
          AI coaching output is generated automatically from your study data and may be inaccurate or incomplete.
        </li>
        <li>
          The App provides educational support only and is not legal, professional, or safety-critical advice.
        </li>
        <li>
          You are responsible for your own driving decisions and compliance with local laws.
        </li>
      </ul>

      <h2 style={legalH2Style}>
        6) Content and intellectual property
      </h2>
      <ul style={{ paddingLeft: 18 }}>
        <li>
          The App, branding, design, and software are owned by or licensed to us and protected by law.
        </li>
        <li>
          You receive a limited, revocable, non-exclusive right to use the App for personal, non-commercial use.
        </li>
        <li>
          You may not copy, resell, distribute, or create derivative works from the App except as allowed by law.
        </li>
      </ul>

      <h2 style={legalH2Style}>
        7) Availability and changes
      </h2>
      <ul style={{ paddingLeft: 18 }}>
        <li>
          We may modify, suspend, or discontinue parts of the App at any time.
        </li>
        <li>
          We do not guarantee uninterrupted availability, sync, or error-free operation.
        </li>
      </ul>

      <h2 style={legalH2Style}>
        8) Termination
      </h2>
      <p>
        We may suspend or terminate access if you violate these Terms or abuse the service.
        You may stop using the App at any time and may request account deletion via the
        in-app and outside-the-app deletion paths described in our Privacy Policy.
      </p>

      <h2 style={legalH2Style}>
        9) Disclaimers and limitation of liability
      </h2>
      <p>
        The App is provided “as is” and “as available” to the maximum extent allowed by law.
        We disclaim implied warranties (including merchantability, fitness for a particular
        purpose, and non-infringement). To the maximum extent allowed by law, we are not liable
        for indirect, incidental, special, consequential, or punitive damages, or for loss of
        data, revenue, or profits.
      </p>

      <h2 style={legalH2Style}>
        10) Governing law
      </h2>
      <p>
        These Terms are governed by applicable laws of the jurisdiction where
        <b> {DEVELOPER_ENTITY} </b>
        is established, unless mandatory local consumer law requires otherwise.
      </p>

      <h2 style={legalH2Style}>
        11) Changes to these Terms
      </h2>
      <p>
        We may update these Terms from time to time. Continued use of the App after
        updates means you accept the revised Terms.
      </p>

      <h2 style={legalH2Style}>
        12) Contact
      </h2>
      <p>
        Questions about these Terms: <b>{CONTACT_EMAIL}</b>
      </p>
    </LegalPageShell>
  );
}
