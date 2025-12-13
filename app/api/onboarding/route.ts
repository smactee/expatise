import { NextResponse } from 'next/server';
import { ONBOARDING_COOKIE } from '@/lib/middleware/paths';

export async function POST() {
  const res = NextResponse.json({ ok: true });

  res.cookies.set({
    name: ONBOARDING_COOKIE,
    value: '1',
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });

  return res;
}
