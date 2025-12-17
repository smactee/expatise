import { NextResponse } from "next/server";
import { verifyOtp, consumeOtp } from "@/lib/password-reset-store"; // adjust if no @
import { setUserPassword } from "@/lib/user-store";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const email = String(body?.email || "").trim().toLowerCase();
  const code = String(body?.code || "").trim();
  const newPassword = String(body?.newPassword || "");

  if (!email || !code || newPassword.length < 8) {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }

  const v = verifyOtp(email, code);
  if (!v.ok) {
    return NextResponse.json({ ok: false, message: "Code is invalid or expired." }, { status: 400 });
  }

  const updated = setUserPassword(email, newPassword);
  consumeOtp(email);

  if (!updated) {
    // still generic — but realistically this means user doesn’t exist in our DEV store
    return NextResponse.json({ ok: false, message: "Code is invalid or expired." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
