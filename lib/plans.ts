export type PlanId = "lifetime" | "month1" | "month3";

export type Plan = {
  id: PlanId;           // IMPORTANT: real id
  pillTitle: string;        // shown on Premium pills
  checkoutTitle: string; // shown on Checkout page header
  sub: string;
  price: string;
  promoPrice: string;
};

export const PLAN_MAP: Record<PlanId, Plan> = {
  lifetime: {
    id: "lifetime",
    pillTitle: "Life Time",
    checkoutTitle: "Life Time Plan",
    sub: "With Promo Code: ¥149",
    price: "¥199",
    promoPrice: "¥149",
  },
  month1: {
    id: "month1",
    pillTitle: "1 Month",
    checkoutTitle: "1 Month Plan",
    sub: "With Promo Code: ¥48",
    price: "¥69",
    promoPrice: "¥48",
  },
  month3: {
    id: "month3",
    pillTitle: "3 Month",
    checkoutTitle: "3 Month Plan",
    sub: "With Promo Code: ¥97",
    price: "¥139",
    promoPrice: "¥97",
  },
};

// For fast lookup by id (used in Checkout)
export const PLAN_LIST: Plan[] = [PLAN_MAP.lifetime, PLAN_MAP.month1, PLAN_MAP.month3];

export function toPlanId(v: string | null): PlanId {
  return v === "lifetime" || v === "month1" || v === "month3" ? v : "lifetime";
}
