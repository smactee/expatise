import { NextResponse } from "next/server";
import { getUserByEmail } from "../../../../lib/user-store";
import { createResetOtp } from "../../../../lib/password-reset-store";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();

  // MVP: 항상 200 OK로 응답(계정 존재 유무 노출 방지)
  const user = getUserByEmail(email);

  // local 계정(비번 있는 계정)만 OTP 발급
  if (!user || !user.passwordHash) {
    return NextResponse.json({
      ok: true,
      mode: "social",
      message:
        "This email is linked to a social sign-in. Please sign in with Google/Apple/WeChat.",
    });
  }

  const otp = createResetOtp(email);
  console.log(`[DEV OTP] ${email}: ${otp}`);

  return NextResponse.json({ ok: true, mode: "local" });
}
