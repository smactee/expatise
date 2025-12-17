import { NextResponse } from "next/server";
import { createOtp } from "@/lib/password-reset-store"; // if you don’t use @, change to relative import
import { userExists } from "@/lib/user-store";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body?.email || "").trim().toLowerCase();

  // Always respond the same to avoid account enumeration. :contentReference[oaicite:3]{index=3}
  if (!email) return NextResponse.json({ ok: true });

  // Only generate OTP if user exists (but don’t reveal that to the client)
  if (userExists(email)) {
    const { code, expiresAt } = createOtp(email);

    // DEV ONLY: log OTP to your terminal (later replace with email provider)
    console.log(`[password-reset] OTP for ${email}: ${code} (expires ${new Date(expiresAt).toLocaleString()})`);
  }

  return NextResponse.json({ ok: true });
}
