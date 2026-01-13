export type EntitlementSource =
  | "none"
  | "trial"
  | "subscription"
  | "lifetime"
  | "admin"
  | "dev";

export type Entitlements = {
  isPremium: boolean;
  source: EntitlementSource;
  expiresAt?: number; // unix ms
  updatedAt: number;  // unix ms
};

export const FREE_ENTITLEMENTS: Entitlements = {
  isPremium: false,
  source: "none",
  updatedAt: 0,
};

export function isExpired(e: Entitlements) {
  return typeof e.expiresAt === "number" && Date.now() > e.expiresAt;
}
