import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createSubscription, createAddonOrder } from "@/lib/razorpay.functions";
import { startSubscription, payAddon } from "@/lib/razorpay-checkout";

const PLANS = [
  { key: "solo" as const, name: "Solo Plan", price: 1999, blurb: "For independent designers", features: ["Up to 5 active projects", "Client portal", "WhatsApp drafts"] },
  { key: "studio" as const, name: "Studio Plan", price: 4999, blurb: "For growing studios", features: ["Unlimited projects", "Team access", "Weekly AI summaries", "Priority support"] },
];

const ADDONS = [
  { key: "legal_templates" as const, label: "Legal Templates Pack", price: 2999, blurb: "Contracts, NDAs & client agreements" },
];

export function BillingPanel() {
  const qc = useQueryClient();
  const [loading, setLoading] = useState<string | null>(null);
  const createSub = useServerFn(createSubscription);
  const createAddon = useServerFn(createAddonOrder);

  const { data: sub } = useQuery({
    queryKey: ["subscription"],
    queryFn: async () => {
      const { data } = await supabase.from("subscriptions").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle();
      return data;
    },
  });

  const { data: addons = [] } = useQuery({
    queryKey: ["addons"],
    queryFn: async () => {
      const { data } = await supabase.from("one_time_payments").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const handlePlan = async (plan: "solo" | "studio") => {
    try {
      setLoading(plan);
      const res = await createSub({ data: { plan } });
      await startSubscription({
        keyId: res.keyId,
        subscriptionId: res.subscriptionId,
        planLabel: plan === "solo" ? "Solo Plan ₹1,999/mo" : "Studio Plan ₹4,999/mo",
        onSuccess: () => {
          toast.success("Subscription started");
          qc.invalidateQueries({ queryKey: ["subscription"] });
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(null);
    }
  };

  const handleAddon = async (item: "legal_templates") => {
    try {
      setLoading(item);
      const res = await createAddon({ data: { item } });
      await payAddon({
        keyId: res.keyId,
        orderId: res.orderId,
        amount: res.amount,
        label: res.label,
        onSuccess: () => {
          toast.success("Payment successful");
          qc.invalidateQueries({ queryKey: ["addons"] });
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-display text-2xl mb-1">Subscription</h2>
        <p className="text-sm text-muted-foreground mb-4">Monthly billing via Razorpay</p>
        {sub && sub.status !== "created" && sub.status !== "cancelled" && (
          <div className="mb-4 rounded-[10px] border border-border bg-card p-4 text-sm">
            <span className="inline-flex items-center gap-1.5 text-[#7a9e8a] font-medium">
              <Check className="h-3.5 w-3.5" /> Active: {sub.plan === "solo" ? "Solo" : "Studio"} Plan ({sub.status})
            </span>
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          {PLANS.map((p) => (
            <div key={p.key} className="rounded-[14px] border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="font-display text-xl">{p.name}</div>
              <div className="text-xs text-muted-foreground mb-3">{p.blurb}</div>
              <div className="font-display text-3xl tabular-nums mb-1">₹{p.price.toLocaleString("en-IN")}<span className="text-sm font-sans text-muted-foreground">/mo</span></div>
              <ul className="my-4 space-y-1.5 text-sm">
                {p.features.map((f) => <li key={f} className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-[#7a9e8a]" /> {f}</li>)}
              </ul>
              <button
                onClick={() => handlePlan(p.key)}
                disabled={loading === p.key}
                className="w-full h-10 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95 inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading === p.key && <Loader2 className="h-4 w-4 animate-spin" />}
                Subscribe
              </button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl mb-1">Add-ons</h2>
        <p className="text-sm text-muted-foreground mb-4">One-time purchases</p>
        <div className="grid sm:grid-cols-2 gap-4">
          {ADDONS.map((a) => {
            const owned = addons.some((x) => x.item_key === a.key && x.status === "paid");
            return (
              <div key={a.key} className="rounded-[14px] border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-card)" }}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-display text-lg flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-[#c17f5a]" /> {a.label}</div>
                    <div className="text-xs text-muted-foreground">{a.blurb}</div>
                  </div>
                  <div className="font-mono text-sm">₹{a.price.toLocaleString("en-IN")}</div>
                </div>
                <button
                  onClick={() => handleAddon(a.key)}
                  disabled={loading === a.key || owned}
                  className="mt-4 w-full h-10 rounded-[6px] border border-border text-sm font-medium hover:bg-muted inline-flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading === a.key && <Loader2 className="h-4 w-4 animate-spin" />}
                  {owned ? "Purchased" : "Buy Now"}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
