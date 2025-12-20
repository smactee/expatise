import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { AUTH_COOKIE, cookieOptions, isValidEmail } from '../../../../lib/auth';
import { checkUserPassword, updateUserEmail } from '../../../../lib/user-store';

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const oldEmail = cookieStore.get(AUTH_COOKIE)?.value;

  if (!oldEmail) {
    return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const newEmail = (body?.newEmail as string | undefined)?.trim();
  const password = body?.password as string | undefined;

  if (!newEmail || !password) {
    return NextResponse.json({ error: 'Missing fields.' }, { status: 400 });
  }

  if (!isValidEmail(newEmail)) {
    return NextResponse.json({ error: 'Invalid email format.' }, { status: 400 });
  }

  const ok = await checkUserPassword(oldEmail, password);
  if (!ok) {
    return NextResponse.json({ error: 'Password is incorrect.' }, { status: 400 });
  }

  const moved = await updateUserEmail(oldEmail, newEmail);
  if (!moved.ok) {
    if (moved.reason === 'exists') {
      return NextResponse.json({ error: 'That email is already in use.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
  }

  // update auth cookie to new email
  cookieStore.set(AUTH_COOKIE, newEmail.toLowerCase(), cookieOptions());

  return NextResponse.json({ ok: true });
}
