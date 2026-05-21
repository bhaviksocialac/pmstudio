import { createFileRoute } from "@tanstack/react-router";
import crypto from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/hooks/razorpay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (!secret) return new Response("Webhook secret not configured", { status: 500 });
        const signature = request.headers.get("x-razorpay-signature");
        const body = await request.text();
        const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
        if (!signature || expected !== signature) {
          return new Response("Invalid signature", { status: 401 });
        }
        const evt = JSON.parse(body);
        const eventType: string = evt.event;
        const nowIso = new Date().toISOString();

        try {
          if (eventType === "payment.captured" || eventType === "order.paid") {
            const payment = evt.payload?.payment?.entity;
            const orderId = payment?.order_id;
            if (orderId) {
              // Try invoice first
              const { data: inv } = await supabaseAdmin
                .from("invoices").select("id").eq("razorpay_order_id", orderId).maybeSingle();
              if (inv) {
                await supabaseAdmin.from("invoices").update({
                  status: "paid",
                  razorpay_payment_id: payment.id,
                  paid_at: nowIso,
                }).eq("id", inv.id);
              } else {
                await supabaseAdmin.from("one_time_payments").update({
                  status: "paid",
                  razorpay_payment_id: payment.id,
                  paid_at: nowIso,
                }).eq("razorpay_order_id", orderId);
              }
            }
          } else if (eventType?.startsWith("subscription.")) {
            const sub = evt.payload?.subscription?.entity;
            if (sub?.id) {
              await supabaseAdmin.from("subscriptions").update({
                status: sub.status,
                current_period_start: sub.current_start ? new Date(sub.current_start * 1000).toISOString() : null,
                current_period_end: sub.current_end ? new Date(sub.current_end * 1000).toISOString() : null,
              }).eq("razorpay_subscription_id", sub.id);
            }
          }
        } catch (e) {
          console.error("Razorpay webhook handler error:", e);
          return new Response("Handler error", { status: 500 });
        }
        return new Response("ok");
      },
    },
  },
});
