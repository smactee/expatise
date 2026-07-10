"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PUBLIC_FLAGS } from "@/lib/flags/public";
import { useEntitlements } from "@/components/EntitlementsProvider.client";
import { useUsageCap } from "@/lib/freeAccess/useUsageCap";
import CSRBoundary from "@/components/CSRBoundary";

function currentPath(pathname: string, qs: string) {
  return qs ? `${pathname}?${qs}` : pathname;
}

// Independent doors: the question cap gates the question-VIEWING pages; the exam
// cap gates the test entry. Everything else premium keeps the combined behavior.
const QUESTION_CAP_PREFIXES = ["/all-questions", "/my-mistakes", "/bookmarks"];
const EXAM_CAP_PREFIXES = ["/all-test"];

function matchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function gateBlocked(
  pathname: string,
  caps: { isOverCap: boolean; isOverQuestionCap: boolean; isOverExamCap: boolean }
) {
  if (matchesPrefix(pathname, QUESTION_CAP_PREFIXES)) return caps.isOverQuestionCap;
  if (matchesPrefix(pathname, EXAM_CAP_PREFIXES)) return caps.isOverExamCap;
  return caps.isOverCap;
}

function Inner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const { isPremium, loading: entitlementsLoading } = useEntitlements();
  const { isOverCap, isOverQuestionCap, isOverExamCap } = useUsageCap();
  const blocked = gateBlocked(pathname, { isOverCap, isOverQuestionCap, isOverExamCap });

  const redirectedRef = useRef<string>("");
  const modalAllowedPathRef = useRef<string>("");
  const qs = sp.toString();
  const premiumModalRequested = sp.get("premiumModal") === "1";
  // eslint-disable-next-line react-hooks/refs
  const allowTriggeredRender = premiumModalRequested || modalAllowedPathRef.current === pathname;

  useEffect(() => {
    if (!premiumModalRequested) return;
    modalAllowedPathRef.current = pathname;
  }, [pathname, premiumModalRequested]);

  useEffect(() => {
    if (!PUBLIC_FLAGS.enablePremiumGates) return;
    if (entitlementsLoading) return;

    const key = `${pathname}?${qs}`;

    if (isPremium) return;
    if (!blocked) return;
    if (allowTriggeredRender) return;

    if (redirectedRef.current === key) return;
    redirectedRef.current = key;

    const next = encodeURIComponent(currentPath(pathname, qs));
    router.replace(`/premium?next=${next}`);
  }, [allowTriggeredRender, entitlementsLoading, isPremium, blocked, pathname, qs, router]);

  if (!PUBLIC_FLAGS.enablePremiumGates) return <>{children}</>;
  if (entitlementsLoading) return null;
  if (isPremium) return <>{children}</>;
  if (!blocked) return <>{children}</>;
  if (allowTriggeredRender) return <>{children}</>;

  return null;
}

export default function RequirePremium({ children }: { children: React.ReactNode }) {
  return (
    <CSRBoundary>
      <Inner>{children}</Inner>
    </CSRBoundary>
  );
}
