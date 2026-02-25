"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isOnboarded } from "@/lib/onboarding/markOnboarded.client";

// routes you DON'T want to gate
const BYPASS = new Set([
  "/onboarding",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/account-deletion",        // your store compliance page
  "/account-security",
]);

export default function OnboardingGate() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    if (BYPASS.has(pathname)) return;

    // If you have other public pages, add them to BYPASS
    if (!isOnboarded()) {
      router.replace("/onboarding");
    }
  }, [pathname, router]);

  return null;
}