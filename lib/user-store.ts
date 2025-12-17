import crypto from "crypto";

/**
 * DEV ONLY:
 * - This is an in-memory store (resets when server restarts)
 * - Replace with a real DB later (Postgres/Prisma/etc.)
 */

type UserRecord = {
  email: string;
  passwordHash: string; // "salt:hash"
};

const users = new Map<string, UserRecord>();

function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function userExists(email: string) {
  return users.has(email.toLowerCase());
}

export function setUserPassword(email: string, newPassword: string) {
  const key = email.toLowerCase();
  const u = users.get(key);
  if (!u) return false;
  users.set(key, { ...u, passwordHash: hashPassword(newPassword) });
  return true;
}

// Seed a demo user so you can test reset immediately
(function seed() {
  const email = "user@expatise.com";
  if (!users.has(email)) {
    users.set(email, { email, passwordHash: hashPassword("password123") });
  }
})();
