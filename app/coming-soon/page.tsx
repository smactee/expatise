// app/coming-soon/page.tsx
import BackButton from "@/components/BackButton";
import styles from "./coming-soon.module.css";
import Link from "next/link";

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
  <main className={styles.page}>
    <BackButton variant="fixed" fallbackHref={backHref} />

    <div className={styles.content}>
      <h1 className={styles.title}>Coming Soon</h1>
      <p className={styles.text}>{feature} is not ready yet.</p>
    </div>
  </main>
);

}
