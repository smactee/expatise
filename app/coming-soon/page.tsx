"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import BackButton from "@/components/BackButton";
import styles from "./coming-soon.module.css";

function safeReturnTo(raw: string | null) {
  if (!raw) return "/profile";

  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // ignore
  }

  if (decoded.startsWith("/")) return decoded;

  try {
    const u = new URL(decoded);
    const path = `${u.pathname}${u.search}${u.hash}`;
    return path.startsWith("/") ? path : "/profile";
  } catch {
    return "/profile";
  }
}

function ComingSoonInner() {
  const searchParams = useSearchParams();
  const rawFeature = searchParams.get("feature");
  const feature = rawFeature ? decodeURIComponent(rawFeature) : "This feature";
  const backHref = safeReturnTo(searchParams.get("returnTo"));

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

export default function ComingSoonPage() {
  return (
    <Suspense fallback={null}>
      <ComingSoonInner />
    </Suspense>
  );
}
