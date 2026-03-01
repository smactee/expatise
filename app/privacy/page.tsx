// app/privacy/page.tsx

export default function PrivacyPage() {
  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>
        Privacy Policy
      </h1>

      <p style={{ marginBottom: 12 }}>
        This Privacy Policy explains how Expatise collects, uses, and protects
        your information.
      </p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 24 }}>
        Information we collect
      </h2>
      <ul style={{ paddingLeft: 18, marginTop: 8 }}>
        <li>Account information you provide (e.g., email if you sign up).</li>
        <li>Basic app usage data to operate and improve the service.</li>
      </ul>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 24 }}>
        Contact
      </h2>
      <p style={{ marginTop: 8 }}>
        If you have questions, contact us at:{" "}
        <a href="mailto:support@expatise.app">support@expatise.app</a>
      </p>
    </main>
  );
}