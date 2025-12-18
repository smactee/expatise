// app/api/session/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE } from "../../../lib/auth";

export async function GET() {
    const cookieStore = await cookies();
    const authed = Boolean(cookieStore.get(AUTH_COOKIE)?.value);
    return NextResponse.json({ authed });
}
