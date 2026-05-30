// Shared plan catalog — used by landing page, Settings/BillingPanel, and Razorpay backend.

export type PlanKey = "freelancer" | "starter" | "pro" | "design_house";
export type BillingCycle = "monthly" | "yearly";

export interface PlanFeatureRow {
  label: string;
  // Per-plan value: string (e.g. "1 project"), true (included), false (not included)
  values: Record<PlanKey, string | boolean>;
}

export interface PlanDef {
  key: PlanKey;
  name: string;
  tagline: string;
  monthly: number; // INR
  yearly: number | null; // INR (null = no yearly option)
  cta: string;
  highlight?: boolean;
}

export const PLANS: PlanDef[] = [
  {
    key: "freelancer",
    name: "Freelancer",
    tagline: "Just starting out",
    monthly: 299,
    yearly: null,
    cta: "Start Freelancer",
  },
  {
    key: "starter",
    name: "Studio Starter",
    tagline: "Running first projects",
    monthly: 1999,
    yearly: 19999,
    cta: "Start Starter",
  },
  {
    key: "pro",
    name: "Studio Pro",
    tagline: "Serious studio with a team",
    monthly: 4999,
    yearly: 49999,
    cta: "Start Studio Pro",
    highlight: true,
  },
  {
    key: "design_house",
    name: "Design House",
    tagline: "Established studio",
    monthly: 7999,
    yearly: 79999,
    cta: "Start Design House",
  },
];

// Features in IDENTICAL ORDER across all cards so rows align visually.
export const FEATURE_ROWS: PlanFeatureRow[] = [
  { label: "Active projects",   values: { freelancer: "1",  starter: "3",  pro: "6",  design_house: "10" } },
  { label: "Team members",      values: { freelancer: "0",  starter: "1",  pro: "5",  design_house: "9"  } },
  { label: "Client portal",     values: { freelancer: "Watermarked", starter: "Branded", pro: "Branded", design_house: "White label" } },
  { label: "Basic phase tracking",      values: { freelancer: true,  starter: true,  pro: true,  design_house: true  } },
  { label: "Photo upload",              values: { freelancer: true,  starter: true,  pro: true,  design_house: true  } },
  { label: "AI task intelligence",      values: { freelancer: false, starter: true,  pro: true,  design_house: true  } },
  { label: "Vendor invoice reading",    values: { freelancer: false, starter: true,  pro: true,  design_house: true  } },
  { label: "Milestone invoicing",       values: { freelancer: false, starter: true,  pro: true,  design_house: true  } },
  { label: "Document management",       values: { freelancer: false, starter: true,  pro: true,  design_house: true  } },
  { label: "Finance dashboard",         values: { freelancer: false, starter: true,  pro: true,  design_house: true  } },
  { label: "Snag management",           values: { freelancer: false, starter: false, pro: true,  design_house: true  } },
  { label: "Attendance tracking",       values: { freelancer: false, starter: false, pro: true,  design_house: true  } },
  { label: "AI morning briefing",       values: { freelancer: false, starter: false, pro: true,  design_house: true  } },
  { label: "Delay attribution",         values: { freelancer: false, starter: false, pro: true,  design_house: true  } },
  { label: "Multi-quotation compare",   values: { freelancer: false, starter: false, pro: true,  design_house: true  } },
  { label: "White label domain",        values: { freelancer: false, starter: false, pro: false, design_house: true  } },
  { label: "Early access to new features", values: { freelancer: false, starter: false, pro: false, design_house: true } },
];

export const ADDONS = [
  { key: "extra_project",    label: "Extra project slot",     price: 499,  unit: "/month",   recurring: true  },
  { key: "extra_member",     label: "Extra team member",      price: 299,  unit: "/month",   recurring: true  },
  { key: "legal_templates",  label: "Legal contract templates", price: 2999, unit: "one time", recurring: false },
  { key: "portfolio_site",   label: "Portfolio website",      price: 999,  unit: "/month",   recurring: true  },
] as const;

export function priceFor(plan: PlanDef, cycle: BillingCycle): number | null {
  if (cycle === "yearly") return plan.yearly;
  return plan.monthly;
}

export function formatINR(n: number): string {
  return "₹" + n.toLocaleString("en-IN");
}
