// lib/password-reset-store.ts
import crypto from "crypto";

type ResetRecord = {
  email: string;
  codeHash: string;
  expiresAt: number;
  attemptsLeft: number;
};

const resets = new Map<string, ResetRecord>();

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

function secret() {
  // use your existing AUTH_SECRET if set; in production you should set it
  return process.env.AUTH_SECRET || "dev-reset-secret";
}

function hashCode(email: string, code: string) {
  return crypto
    .createHash("sha256")
    .update(`${email.toLowerCase()}:${code}:${secret()}`)
    .digest("hex");
}

export function createOtp(email: string) {
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  const rec: ResetRecord = {
    email: email.toLowerCase(),
    codeHash: hashCode(email, code),
    expiresAt: Date.now() + OTP_TTL_MS,
    attemptsLeft: MAX_ATTEMPTS,
  };
  resets.set(email.toLowerCase(), rec);
  return { code, expiresAt: rec.expiresAt };
}

export function verifyOtp(email: string, code: string) {
  const key = email.toLowerCase();
  const rec = resets.get(key);
  if (!rec) return { ok: false as const, reason: "missing" as const };
  if (Date.now() > rec.expiresAt) {
    resets.delete(key);
    return { ok: false as const, reason: "expired" as const };
  }

  if (rec.attemptsLeft <= 0) {
    resets.delete(key);
    return { ok: false as const, reason: "locked" as const };
  }

  const incoming = hashCode(email, code);
  if (incoming !== rec.codeHash) {
    rec.attemptsLeft -= 1;
    resets.set(key, rec);
    return { ok: false as const, reason: "invalid" as const, attemptsLeft: rec.attemptsLeft };
  }

  return { ok: true as const };
}

export function consumeOtp(email: string) {
  resets.delete(email.toLowerCase());
}

// lib/password-reset-store.ts
// (기존 createOtp/verifyOtp/consumeOtp는 그대로 두고)

export function createResetOtp(email: string) {
  return createOtp(email).code;
}

export function verifyResetOtp(email: string, code: string) {
  return verifyOtp(email, code);
}

export function consumeResetOtp(email: string, code: string) {
  return consumeOtp(email);
}
