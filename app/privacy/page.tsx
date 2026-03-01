// app/privacy/page.tsx
import Link from "next/link";

export const metadata = {
  title: "Privacy Policy · Expatise",
};

// ✅ Edit these before publishing:
const APP_NAME = "Expatise";
const DEVELOPER_ENTITY = "[Maverix n Matrix]"; // must match Play listing name
const CONTACT_EMAIL = "maverixnmatrix@gmail.com";

// Outside-the-app deletion page (Play wants this for apps with accounts)
const ACCOUNT_DELETION_URL = "/account-deletion";

const EFFECTIVE_DATE = "2026-03-01";
const LAST_UPDATED = "2026-03-01";

export default function PrivacyPolicyPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "24px 16px 60px",
        maxWidth: 920,
        margin: "0 auto",
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif",
        lineHeight: 1.6,
      }}
    >
      <header style={{ marginBottom: 18 }}>
        <Link href="/profile" style={{ textDecoration: "none" }}>
          ← Back to Profile
        </Link>
      </header>

      <h1 style={{ fontSize: 30, fontWeight: 900, marginBottom: 6 }}>
        Privacy Policy
      </h1>

      <div style={{ opacity: 0.8, fontSize: 14 }}>
        <div>Effective date: {EFFECTIVE_DATE}</div>
        <div>Last updated: {LAST_UPDATED}</div>
      </div>

      <p style={{ marginTop: 16 }}>
        This Privacy Policy explains how <b>{APP_NAME}</b> (the “App”), operated
        by <b>{DEVELOPER_ENTITY}</b> (“we”, “us”), collects, uses, and shares
        information when you use the App.
      </p>

      <h2 style={{ marginTop: 28, fontSize: 18, fontWeight: 800 }}>
        1) Information we collect
      </h2>

      <ul style={{ paddingLeft: 18 }}>
        <li>
          <b>Account information</b>: email address and authentication details
          (for example, if you sign in using email or a third-party sign-in
          provider).
        </li>
        <li>
          <b>Profile information you provide</b>: optional display name and
          avatar image (if you choose to set them).
        </li>
        <li>
          <b>Study &amp; progress data</b>: your practice attempts, test results,
          timestamps, and study time/activity (used for progress tracking and
          analytics inside the app).
        </li>
        <li>
          <b>AI coaching inputs/outputs (if you use the Coach feature)</b>: we
          process study metrics you submit to generate a coaching report. The
          coaching output is returned to you and may be cached on your device for
          convenience.
        </li>
        <li>
          <b>Subscriptions &amp; purchases (if you purchase Premium)</b>: purchase
          history / entitlement status needed to unlock premium features.
        </li>
        <li>
          <b>Device / usage data</b>: basic technical logs and request metadata
          (e.g., IP address, browser type, timestamps) used for security,
          reliability, and debugging.
        </li>
        <li>
          <b>Cookies, local storage, and offline caches</b>: we use cookies and
          local storage to keep you signed in, remember settings (like theme),
          store study state, and support offline-friendly functionality.
        </li>
      </ul>

      <h2 style={{ marginTop: 28, fontSize: 18, fontWeight: 800 }}>
        2) How we use information
      </h2>

      <ul style={{ paddingLeft: 18 }}>
        <li>To create and manage accounts and authenticate users.</li>
        <li>To save and sync study progress (where account sync is enabled).</li>
        <li>To provide practice tests, bookmarks, mistake review, and analytics.</li>
        <li>To provide AI coaching reports when you request them (Coach feature).</li>
        <li>To operate subscriptions/premium access if you purchase Premium.</li>
        <li>To maintain security, prevent abuse, and debug issues.</li>
        <li>To improve performance and user experience.</li>
      </ul>

      <h2 style={{ marginTop: 28, fontSize: 18, fontWeight: 800 }}>
        3) How we share information
      </h2>

      <p>
        We do not sell your personal information. We share information only as
        needed to operate the App, including with these service providers:
      </p>

      <ul style={{ paddingLeft: 18 }}>
        <li>
          <b>Supabase</b> — authentication and database storage (account and
          progress data).
        </li>
        <li>
          <b>OpenAI</b> — used only when you use AI coaching features to generate
          coaching output from the metrics you submit.
        </li>
        <li>
          <b>Hosting / infrastructure providers (e.g., Vercel)</b> — to host,
          deliver, and secure the App.
        </li>
        <li>
          <b>Google Play</b> — if you purchase subscriptions/products, Google Play
          processes the payment.
        </li>
        <li>
          <b>RevenueCat</b> — if enabled, used to manage subscriptions and verify
          entitlements. (If you use RevenueCat, Google expects you to disclose
          “Purchase history” in the Data Safety form.)
        </li>
      </ul>

      <p>
        We may also share information if required by law, to protect rights and
        safety, or in connection with a business transaction (e.g., merger or
        acquisition).
      </p>

      <h2 style={{ marginTop: 28, fontSize: 18, fontWeight: 800 }}>
        4) Data retention
      </h2>

      <p>
        We retain account and study/progress data for as long as your account is
        active or as needed to provide the App. We may retain certain data longer
        where required for legal, security, or operational purposes.
      </p>

      <h2 style={{ marginTop: 28, fontSize: 18, fontWeight: 800 }}>
        5) Security
      </h2>

      <p>
        We use reasonable safeguards designed to protect information. Data sent
        between your device and our services is typically encrypted in transit
        using HTTPS/TLS. (No system is 100% secure.)
      </p>

      <h2 style={{ marginTop: 28, fontSize: 18, fontWeight: 800 }}>
        6) Account deletion &amp; your choices
      </h2>

      <ul style={{ paddingLeft: 18 }}>
        <li>
          <b>In-app deletion</b>: You can initiate account deletion inside the
          App (Profile → Delete Account).
        </li>
        <li>
          <b>Outside-the-app deletion</b>: You can request account deletion using
          this page:{" "}
          <Link href={ACCOUNT_DELETION_URL}>{ACCOUNT_DELETION_URL}</Link>
        </li>
        <li>
          You can contact us at <b>{CONTACT_EMAIL}</b> to request access or
          deletion assistance.
        </li>
      </ul>

      <p style={{ marginTop: 10 }}>
        Google Play requires apps that support account creation to provide both
        an in-app deletion path and an outside-the-app deletion link.
      </p>

      <h2 style={{ marginTop: 28, fontSize: 18, fontWeight: 800 }}>
        7) Children’s privacy
      </h2>

      <p>
        The App is not intended for children under 13, and we do not knowingly
        collect personal information from children under 13.
      </p>

      <h2 style={{ marginTop: 28, fontSize: 18, fontWeight: 800 }}>
        8) International transfers
      </h2>

      <p>
        Depending on where our service providers operate, your information may be
        processed in countries other than where you live.
      </p>

      <h2 style={{ marginTop: 28, fontSize: 18, fontWeight: 800 }}>
        9) Changes to this policy
      </h2>

      <p>
        We may update this policy from time to time. We will post updates on this
        page and revise the “Last updated” date above.
      </p>

      <h2 style={{ marginTop: 28, fontSize: 18, fontWeight: 800 }}>
        10) Contact
      </h2>

      <p>
        If you have questions, contact us at: <b>{CONTACT_EMAIL}</b>
      </p>

      <hr style={{ margin: "28px 0" }} />

      <section style={{ fontSize: 13, opacity: 0.75, lineHeight: 1.55 }}>
  <p style={{ marginTop: 0 }}>
    <b>Legal notes.</b> This Privacy Policy is provided for general
    informational purposes and does not constitute legal advice. Your use of
    the App is also subject to any applicable laws and our Terms (if any).
  </p>

  <p style={{ marginTop: 10 }}>
    This policy applies only to <b>{APP_NAME}</b>. Third-party services we use
    (such as authentication, hosting, payments, or AI providers) may process
    data under their own privacy policies. We encourage you to review those
    policies where relevant.
  </p>

  <p style={{ marginTop: 10 }}>
    <b>Severability.</b> If any provision of this policy is found unenforceable,
    the remaining provisions will remain in effect.
  </p>

  <p style={{ marginTop: 10 }}>
    <b>Language.</b> If we provide translations, the English version controls in
    case of any conflict or inconsistency.
  </p>

  <p style={{ marginTop: 10 }}>
    Questions? Contact us at <b>{CONTACT_EMAIL}</b>.
  </p>
</section>
    </main>
  );
}