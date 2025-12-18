import { NextResponse } from "next/server";
import { createUser } from "../../../lib/user-store";
import { isValidEmail, normalizeEmail } from "../../../lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const email = normalizeEmail(body?.email);
  const password = String(body?.password || "");
  const confirmPassword = String(body?.confirmPassword || "");

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ ok: false, message: "Please enter a valid email address." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ ok: false, message: "Password must be at least 8 characters." }, { status: 400 });
  }
  if (password !== confirmPassword) {
    return NextResponse.json({ ok: false, message: "Passwords do not match." }, { status: 400 });
  }

  const result = createUser(email, password);
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
