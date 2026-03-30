// lib/plans.ts
export type PlanId = "lifetime" | "monthly" | "three_month" | "six_month";

export type Plan = {
  id: PlanId;              // IMPORTANT: real id (matches RevenueCat product IDs)
  pillTitle: string;       // shown on Premium pills
  checkoutTitle: string;   // shown on Checkout page header
  sub: string;
  price: string;
  promoPrice: string;
};

export const PLAN_MAP: Record<PlanId, Plan> = {
  monthly: {
    id: "monthly",
    pillTitle: "1 Month",
    checkoutTitle: "1 Month Plan",
    sub: "",
    price: "$4.99",
    promoPrice: "",
  },
  three_month: {
    id: "three_month",
    pillTitle: "3 Months",
    checkoutTitle: "3 Month Plan",
    sub: "",
    price: "$8.99",
    promoPrice: "",
  },
  six_month: {
    id: "six_month",
    pillTitle: "6 Months",
    checkoutTitle: "6 Month Plan",
    sub: "", 
    price: "$16.99", 
    promoPrice: "",  
  },
     lifetime: {
    id: "lifetime",
    pillTitle: "Lifetime",
    checkoutTitle: "Lifetime Plan",
    sub: "",
    price: "$12.99",
    promoPrice: "",
  },
};

// For fast lookup by id (used in Checkout)
export const PLAN_LIST: Plan[] = [
  PLAN_MAP.monthly,
  PLAN_MAP.three_month,
  PLAN_MAP.six_month,
  PLAN_MAP.lifetime,
];

export function toPlanId(v: string | null): PlanId {
  return v === "lifetime" || v === "monthly" || v === "three_month" || v === "six_month"
    ? v
    : "lifetime";
}