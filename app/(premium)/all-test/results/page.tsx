// app/(premium)/real-test/results/page.tsx
'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

export default function RealTestResultsAlias() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    const qs = sp.toString();
    router.replace(`/test/real/results${qs ? `?${qs}` : ''}`);
  }, [router, sp]);

  return null;
}
