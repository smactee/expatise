import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { AUTH_COOKIE } from '../../../../lib/auth';
import { checkUserPassword, setUserPassword } from '../../../../lib/user-store';

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const email = cookieStore.get(AUTH_COOKIE)?.value;

  if (!email) {
    return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const currentPassword = body?.currentPassword as string | undefined;
  const newPassword = body?.newPassword as string | undefined;

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Missing fields.' }, { status: 400 });
  }

  const ok = await checkUserPassword(email, currentPassword);
  if (!ok) {
    return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 });
  }

  await setUserPassword(email, newPassword);
  return NextResponse.json({ ok: true });
}
