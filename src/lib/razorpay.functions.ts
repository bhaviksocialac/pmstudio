import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RZP_BASE = "https://api.razorpay.com/v1";

function rzpAuthHeader() {
  const id = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!id || !secret) throw new Error("Razorpay keys not configured");
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

async function rzpFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${RZP_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: rzpAuthHeader(),
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Razorpay ${path} failed [${res.status}]: ${JSON.stringify(data)}`);
  return data;
}

// ============ PLAN definitions ============
const PLANS = {
  solo: { amountPaise: 199900, label: "Solo Plan" },
  studio: { amountPaise: 499900, label: "Studio Plan" },
} as const;
type PlanKey = keyof typeof PLANS;

async function ensurePlan(plan: PlanKey): Promise<string> {
  // Create plan on-the-fly (idempotent enough for test mode; cache id in env for live)
  const envKey = plan === "solo" ? process.env.RAZORPAY_PLAN_ID_SOLO : process.env.RAZORPAY_PLAN_ID_STUDIO;
  if (envKey) return envKey;
  const p = PLANS[plan];
  const created = await rzpFetch("/plans", {
    method: "POST",
    body: JSON.stringify({
      period: "monthly",
      interval: 1,
      item: { name: p.label, amount: p.amountPaise, currency: "INR" },
    }),
  });
  return created.id as string;
}

// ============ 1. SUBSCRIPTIONS ============
export const createSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ plan: z.enum(["solo", "studio"]) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const planId = await ensurePlan(data.plan);
    const sub = await rzpFetch("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        plan_id: planId,
        total_count: 12,
        customer_notify: 1,
        notes: { user_id: userId, plan: data.plan },
      }),
    });
    const { error } = await supabase.from("subscriptions").insert({
      user_id: userId,
      plan: data.plan,
      razorpay_subscription_id: sub.id,
      razorpay_plan_id: planId,
      status: sub.status ?? "created",
      short_url: sub.short_url ?? null,
    });
    if (error) throw new Error(error.message);
    return {
      subscriptionId: sub.id as string,
      shortUrl: sub.short_url as string | undefined,
      keyId: process.env.RAZORPAY_KEY_ID!,
    };
  });

// ============ 2. INVOICE PAY-NOW ORDER ============
export const createInvoiceOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ invoiceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: inv, error } = await supabase
      .from("invoices")
      .select("id, amount, number, status")
      .eq("id", data.invoiceId)
      .eq("user_id", userId)
      .single();
    if (error || !inv) throw new Error("Invoice not found");
    if (inv.status === "paid") throw new Error("Invoice already paid");

    const amountPaise = Math.round(Number(inv.amount) * 100);
    const order = await rzpFetch("/orders", {
      method: "POST",
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt: `inv_${inv.id.slice(0, 30)}`,
        notes: { invoice_id: inv.id, user_id: userId, kind: "invoice" },
      }),
    });
    await supabase.from("invoices").update({ razorpay_order_id: order.id }).eq("id", inv.id);
    return {
      orderId: order.id as string,
      amount: amountPaise,
      keyId: process.env.RAZORPAY_KEY_ID!,
      invoiceNumber: inv.number ?? inv.id.slice(0, 6),
    };
  });

// ============ 3. ONE-TIME ADD-ON ORDER ============
const ADDONS = {
  legal_templates: { amountPaise: 299900, label: "Legal Templates Pack" },
} as const;
type AddonKey = keyof typeof ADDONS;

export const createAddonOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ item: z.enum(["legal_templates"]) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const addon = ADDONS[data.item as AddonKey];
    const order = await rzpFetch("/orders", {
      method: "POST",
      body: JSON.stringify({
        amount: addon.amountPaise,
        currency: "INR",
        receipt: `addon_${data.item}_${Date.now()}`,
        notes: { user_id: userId, kind: "addon", item: data.item },
      }),
    });
    const { error } = await supabase.from("one_time_payments").insert({
      user_id: userId,
      item_key: data.item,
      label: addon.label,
      amount: addon.amountPaise / 100,
      razorpay_order_id: order.id,
      status: "created",
    });
    if (error) throw new Error(error.message);
    return {
      orderId: order.id as string,
      amount: addon.amountPaise,
      keyId: process.env.RAZORPAY_KEY_ID!,
      label: addon.label,
    };
  });

// ============ VERIFY PAYMENT (client-side handler callback) ============
export const verifyPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      razorpay_order_id: z.string(),
      razorpay_payment_id: z.string(),
      razorpay_signature: z.string(),
      kind: z.enum(["invoice", "addon"]),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const secret = process.env.RAZORPAY_KEY_SECRET!;
    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${data.razorpay_order_id}|${data.razorpay_payment_id}`)
      .digest("hex");
    if (expected !== data.razorpay_signature) {
      throw new Error("Invalid signature");
    }
    const { supabase, userId } = context;
    const nowIso = new Date().toISOString();
    if (data.kind === "invoice") {
      const { error } = await supabase
        .from("invoices")
        .update({
          status: "paid",
          razorpay_payment_id: data.razorpay_payment_id,
          paid_at: nowIso,
        })
        .eq("razorpay_order_id", data.razorpay_order_id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("one_time_payments")
        .update({
          status: "paid",
          razorpay_payment_id: data.razorpay_payment_id,
          paid_at: nowIso,
        })
        .eq("razorpay_order_id", data.razorpay_order_id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
