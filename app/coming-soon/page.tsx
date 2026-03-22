"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import BackButton from "@/components/BackButton";
import styles from "./coming-soon.module.css";
import { useT } from "@/lib/i18n/useT";

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
  const { t } = useT();
  const rawFeature = searchParams.get("feature");
  const decodedFeature = rawFeature ? decodeURIComponent(rawFeature) : t("comingSoon.defaultFeature");
  const feature =
    rawFeature === t("comingSoon.notificationsKey")
      ? t("comingSoon.featureNames.notifications")
      : decodedFeature;
  const backHref = safeReturnTo(searchParams.get("returnTo"));
  const detailText =
    rawFeature === t("comingSoon.notificationsKey")
      ? t("comingSoon.notificationsDetail")
      : t("comingSoon.genericDetail", { feature });

  return (
    <main className={styles.page}>
      <BackButton variant="fixed" fallbackHref={backHref} />

      <div className={styles.content}>
        <h1 className={styles.title}>{t("comingSoon.title")}</h1>
        <p className={styles.text}>{detailText}</p>
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
