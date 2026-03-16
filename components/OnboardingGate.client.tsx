"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isOnboarded } from "@/lib/onboarding/markOnboarded.client";

const BYPASS = new Set([
  "/onboarding",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/privacy",
  "/terms",
  "/account-deletion",
  "/account-security",
]);

const BYPASS_PREFIXES = ["/auth", "/help", "/support", "/legal"];

function isBypassed(pathname: string) {
  if (BYPASS.has(pathname)) return true;

  return BYPASS_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export default function OnboardingGate() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    if (isBypassed(pathname)) return;
    if (!isOnboarded()) {
      router.replace("/onboarding");
    }
  }, [pathname, router]);

  return null;
}
