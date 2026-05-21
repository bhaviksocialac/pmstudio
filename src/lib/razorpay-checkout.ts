// Client-side Razorpay Checkout helper
import { verifyPayment } from "./razorpay.functions";

declare global {
  interface Window {
    Razorpay?: new (options: RzpOptions) => { open: () => void; on: (e: string, cb: (r: unknown) => void) => void };
  }
}

interface RzpOptions {
  key: string;
  amount?: number;
  currency?: string;
  order_id?: string;
  subscription_id?: string;
  name: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  handler?: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
    razorpay_subscription_id?: string;
  }) => void;
  modal?: { ondismiss?: () => void };
}

let scriptPromise: Promise<void> | null = null;
function loadCheckout(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Razorpay"));
    document.body.appendChild(s);
  });
  return scriptPromise;
}

export async function payInvoice(opts: {
  keyId: string;
  orderId: string;
  amount: number;
  invoiceNumber: string;
  onSuccess?: () => void;
}) {
  await loadCheckout();
  const rzp = new window.Razorpay!({
    key: opts.keyId,
    amount: opts.amount,
    currency: "INR",
    order_id: opts.orderId,
    name: "PMStudio",
    description: `Invoice ${opts.invoiceNumber}`,
    theme: { color: "#c17f5a" },
    handler: async (resp) => {
      await verifyPayment({
        data: {
          razorpay_order_id: resp.razorpay_order_id,
          razorpay_payment_id: resp.razorpay_payment_id,
          razorpay_signature: resp.razorpay_signature,
          kind: "invoice",
        },
      });
      opts.onSuccess?.();
    },
  });
  rzp.open();
}

export async function payAddon(opts: {
  keyId: string;
  orderId: string;
  amount: number;
  label: string;
  onSuccess?: () => void;
}) {
  await loadCheckout();
  const rzp = new window.Razorpay!({
    key: opts.keyId,
    amount: opts.amount,
    currency: "INR",
    order_id: opts.orderId,
    name: "PMStudio",
    description: opts.label,
    theme: { color: "#c17f5a" },
    handler: async (resp) => {
      await verifyPayment({
        data: {
          razorpay_order_id: resp.razorpay_order_id,
          razorpay_payment_id: resp.razorpay_payment_id,
          razorpay_signature: resp.razorpay_signature,
          kind: "addon",
        },
      });
      opts.onSuccess?.();
    },
  });
  rzp.open();
}

export async function startSubscription(opts: {
  keyId: string;
  subscriptionId: string;
  planLabel: string;
  onSuccess?: () => void;
}) {
  await loadCheckout();
  const rzp = new window.Razorpay!({
    key: opts.keyId,
    subscription_id: opts.subscriptionId,
    name: "PMStudio",
    description: opts.planLabel,
    theme: { color: "#c17f5a" },
    handler: () => {
      // Subscription confirmation is finalized via webhook
      opts.onSuccess?.();
    },
  });
  rzp.open();
}
