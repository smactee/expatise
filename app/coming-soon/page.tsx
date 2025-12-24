import Link from "next/link";

type Props = {
  searchParams?: { feature?: string };
};

export default function ComingSoonPage({ searchParams }: Props) {
  const feature = searchParams?.feature ? decodeURIComponent(searchParams.feature) : "This feature";

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Coming Soon</h1>
      <p style={{ marginTop: 12 }}>{feature} is not ready yet.</p>

      <div style={{ marginTop: 16 }}>
        <Link href="/">← Back to Home</Link>
      </div>
    </main>
  );
}
