// app/(premium)/real-test/results/page.tsx
'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function RedirectInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const qs = sp.toString();

  useEffect(() => {
    router.replace(`/test/real/results${qs ? `?${qs}` : ''}`);
  }, [router, qs]);

  return null;
}

export default function RealTestResultsAlias() {
  return (
    <Suspense fallback={null}>
      <RedirectInner />
    </Suspense>
  );
}

