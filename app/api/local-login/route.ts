import { NextResponse } from "next/server";
import { checkUserPassword } from "@/lib/user-store"; // if you don't use @, switch to relative

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");

  // Always keep response generic (no account enumeration)
  if (!email || !password) {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const ok = checkUserPassword(email, password);
  return NextResponse.json({ ok }, { status: 200 });
}
