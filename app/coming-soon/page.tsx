// app/coming-soon/page.tsx
import BackButton from "@/components/BackButton";

type Props = {
  searchParams?: { feature?: string; returnTo?: string };
};

function safeReturnTo(raw: string | undefined) {
  if (!raw) return "/profile";

  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // ignore
  }

  // ✅ If it's already a path, accept it
  if (decoded.startsWith("/")) return decoded;

  // ✅ If it's a full URL (http://localhost:3000/profile), strip to pathname safely
  try {
    const u = new URL(decoded);
    const path = `${u.pathname}${u.search}${u.hash}`;
    return path.startsWith("/") ? path : "/profile";
  } catch {
    return "/profile";
  }
}

export default function ComingSoonPage({ searchParams }: Props) {
  const feature = searchParams?.feature
    ? decodeURIComponent(searchParams.feature)
    : "This feature";

  const backHref = safeReturnTo(searchParams?.returnTo);

  return (
    <main style={{ padding: 24 }}>
      {/* ✅ top-left arrow uses fallbackHref so it NEVER dumps to Home */}
      <BackButton fallbackHref={backHref} />

      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Coming Soon</h1>
      <p style={{ marginTop: 12 }}>{feature} is not ready yet.</p>

      <div style={{ marginTop: 16 }}>
      </div>
    </main>
  );
}
