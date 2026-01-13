// lib/flags/public.ts
export type PublicFlags = {
  enablePayments: boolean;
  enablePremiumGates: boolean;
};

function readBool(name: string, fallback: boolean) {
  const v = process.env[name];
  if (v == null) return fallback;
  const s = String(v).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(s)) return true;
  if (["0", "false", "no", "off"].includes(s)) return false;
  return fallback;
}

export const PUBLIC_FLAGS: PublicFlags = {
  // must be NEXT_PUBLIC_* to be available in client components
  enablePayments: readBool("NEXT_PUBLIC_ENABLE_PAYMENTS", false),
  enablePremiumGates: readBool("NEXT_PUBLIC_ENABLE_PREMIUM_GATES", true),
};
