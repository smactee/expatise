/*app/account-deletion/page.tsx*/

export default function AccountDeletionPage() {
  // ✅ This page is your "web link resource" for Google Play.
  // Replace the email below with your real support email.
  const SUPPORT_EMAIL = "support@expatise.com";

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "28px 18px", lineHeight: 1.55 }}>
      <h1 style={{ fontSize: 26, marginBottom: 10 }}>Account & Data Deletion</h1>

      <p style={{ opacity: 0.85 }}>
        If you created an Expatise account and want it deleted, use one of the options below.
      </p>

      <h2 style={{ fontSize: 18, marginTop: 18 }}>Option A — In-app deletion</h2>
      <p>
        If you can still access the app: go to <b>Profile → Delete Account</b> and follow the steps.
      </p>

      <h2 style={{ fontSize: 18, marginTop: 18 }}>Option B — Web request</h2>
      <p>
        If you can’t access the app, email us at{" "}
        <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Account deletion request")}`}>
          {SUPPORT_EMAIL}
        </a>{" "}
        with:
      </p>
      <ul>
        <li>The email you used to sign in (or the provider, e.g. Google)</li>
        <li>“Please delete my Expatise account and associated data.”</li>
      </ul>

      <h2 style={{ fontSize: 18, marginTop: 18 }}>What we delete</h2>
      <ul>
        <li>Your Supabase Auth account</li>
        <li>Your saved attempts and time logs stored on our servers</li>
      </ul>

      <p style={{ marginTop: 14, opacity: 0.75 }}>
        Note: We may retain limited data if legally required (fraud prevention, compliance), if applicable.
      </p>
    </main>
  );
}