'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import CSRBoundary from '@/components/CSRBoundary';

function safeDecode(v: string) {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

function isSafeInternalPath(p: string) {
  return typeof p === 'string' && p.startsWith('/') && !p.startsWith('//');
}

function Inner({ fallbackHref = '/' }: { fallbackHref?: string }) {
  const sp = useSearchParams();

  // 1) Prefer explicit returnTo in URL
  const param = sp.get('returnTo') ?? '';
  let candidate = param ? safeDecode(param) : '';

  // 2) If missing, use recent sessionStorage fallback (valid for 10 minutes)
  if (!candidate) {
    try {
      const ts = Number(sessionStorage.getItem('expatise:returnTo:ts') ?? 0);
      const saved = sessionStorage.getItem('expatise:returnTo') ?? '';
      const fresh = ts > 0 && Date.now() - ts < 10 * 60 * 1000;
      if (fresh) candidate = saved;
    } catch {
      // ignore
    }
  }

  const href = isSafeInternalPath(candidate) ? candidate : fallbackHref;

  return <Link href={href}>← Back</Link>;
}

export default function BackLink() {
  return (
    <CSRBoundary>
      <Inner />
    </CSRBoundary>
  );
}