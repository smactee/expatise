"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function AllTestResultsAliasInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const q = searchParams.toString();
    router.replace(`/test/real/results${q ? `?${q}` : ""}`);
  }, [router, searchParams]);

  return null;
}

export default function AllTestResultsAlias() {
  return (
    <Suspense fallback={null}>
      <AllTestResultsAliasInner />
    </Suspense>
  );
}
