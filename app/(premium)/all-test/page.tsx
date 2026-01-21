'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function RealTestAlias() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/test/real');
  }, [router]);
  return null;
}
