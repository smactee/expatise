export type PlanId = "lifetime" | "month1" | "month3";

export type Plan = {
  id: PlanId;           // IMPORTANT: real id
  title: string;        // shown on Premium pills
  checkoutTitle: string; // shown on Checkout page header
  sub: string;
  price: string;
};

export const PLANS: Plan[] = [
  {
    id: "lifetime",
    title: "Life Time",
    checkoutTitle: "Life Time Plan",
    sub: "With Promo Code: ¥149",
    price: "¥199",
  },
  {
    id: "month1",
    title: "1 Month",
    checkoutTitle: "1 Month Plan",
    sub: "With Promo Code: ¥48",
    price: "¥69",
  },
  {
    id: "month3",
    title: "3 Month",
    checkoutTitle: "3 Month Plan",
    sub: "With Promo Code: ¥97",
    price: "¥139",
  },
];

// For fast lookup by id (used in Checkout)
export const PLAN_MAP: Record<PlanId, Plan> = PLANS.reduce((acc, p) => {
  acc[p.id] = p;
  return acc;
}, {} as Record<PlanId, Plan>);

export function toPlanId(v: string | null): PlanId {
  return v === "lifetime" || v === "month1" || v === "month3" ? v : "lifetime";
}
