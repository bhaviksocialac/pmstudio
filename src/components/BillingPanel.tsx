import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Check, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createSubscription, createAddonOrder } from "@/lib/razorpay.functions";
import { startSubscription, payAddon } from "@/lib/razorpay-checkout";
import { PLANS, FEATURE_ROWS, ADDONS, priceFor, formatINR, type BillingCycle, type PlanKey } from "@/lib/plans";

export function BillingPanel() {
  const qc = useQueryClient();
  const [loading, setLoading] = useState<string | null>(null);
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
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

  const handlePlan = async (plan: PlanKey) => {
    const planDef = PLANS.find((p) => p.key === plan)!;
    const effectiveCycle: BillingCycle = cycle === "yearly" && !planDef.yearly ? "monthly" : cycle;
    try {
      setLoading(plan);
      const res = await createSub({ data: { plan, cycle: effectiveCycle } });
      const amt = effectiveCycle === "yearly" ? planDef.yearly! : planDef.monthly;
      await startSubscription({
        keyId: res.keyId,
        subscriptionId: res.subscriptionId,
        planLabel: `${planDef.name} — ${formatINR(amt)}/${effectiveCycle === "yearly" ? "yr" : "mo"}`,
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

  const handleAddon = async (item: typeof ADDONS[number]["key"]) => {
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

  const renderValue = (v: string | boolean, highlight = false) => {
    if (v === true) return <Check className={`h-4 w-4 ${highlight ? "text-[#c17f5a]" : "text-[#7a9e8a]"}`} />;
    if (v === false) return <X className="h-4 w-4 text-muted-foreground/40" />;
    return <span className="text-sm">{v}</span>;
  };

  return (
    <div className="space-y-10">
      <section>
        <div className="flex items-end justify-between flex-wrap gap-4 mb-1">
          <div>
            <h2 className="font-display text-2xl">Subscription</h2>
            <p className="text-sm text-muted-foreground">Monthly or yearly billing via Razorpay</p>
          </div>
          <CycleToggle cycle={cycle} onChange={setCycle} />
        </div>

        <div className="mb-4 mt-4 rounded-[10px] border border-[#c17f5a]/30 bg-[#c17f5a]/8 px-4 py-3 text-sm text-[#5a4034]">
          <span className="font-medium">Early access</span> — first 3 months at 50% off. Limited to first 100 designers.
        </div>

        {sub && sub.status !== "created" && sub.status !== "cancelled" && (
          <div className="mb-4 rounded-[10px] border border-border bg-card p-4 text-sm">
            <span className="inline-flex items-center gap-1.5 text-[#7a9e8a] font-medium">
              <Check className="h-3.5 w-3.5" /> Active: {sub.plan} ({sub.status})
            </span>
          </div>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.map((p) => {
            const price = priceFor(p, cycle === "yearly" && !p.yearly ? "monthly" : cycle);
            const showCycle: BillingCycle = cycle === "yearly" && !p.yearly ? "monthly" : cycle;
            return (
              <div
                key={p.key}
                className={`relative rounded-[14px] border bg-card p-5 card-lift flex flex-col ${
                  p.highlight ? "border-[#c17f5a]/60 pulse-glow md:-translate-y-2" : "border-border"
                }`}
              >
                {p.highlight && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#c17f5a] text-white text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                    Most popular
                  </span>
                )}
                <div className="font-display text-xl">{p.name}</div>
                <div className="text-xs text-muted-foreground mb-3">{p.tagline}</div>
                <div className="font-display text-3xl tabular-nums">
                  {formatINR(price!)}
                  <span className="text-sm font-sans text-muted-foreground">/{showCycle === "yearly" ? "yr" : "mo"}</span>
                </div>
                <div className="text-xs text-muted-foreground min-h-[18px] mb-3">
                  {cycle === "yearly" && p.yearly ? "2 months free" : cycle === "yearly" && !p.yearly ? "Monthly only" : "\u00A0"}
                </div>
                <ul className="space-y-1.5 text-sm mb-4 flex-1">
                  {FEATURE_ROWS.map((row) => (
                    <li key={row.label} className="flex items-center gap-2 min-h-[22px]">
                      <span className="w-4 shrink-0 flex justify-center">{renderValue(row.values[p.key], p.highlight)}</span>
                      <span className="text-[13px] text-foreground/80">
                        <span className="text-muted-foreground">{row.label}:</span>{" "}
                        {typeof row.values[p.key] === "string" ? row.values[p.key] : ""}
                      </span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handlePlan(p.key)}
                  disabled={loading === p.key}
                  className="w-full h-10 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium btn-premium inline-flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading === p.key && <Loader2 className="h-4 w-4 animate-spin" />}
                  {p.cta}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl mb-1">Add-ons</h2>
        <p className="text-sm text-muted-foreground mb-4">Extend your plan</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {ADDONS.map((a) => {
            const owned = !a.recurring && addons.some((x) => x.item_key === a.key && x.status === "paid");
            return (
              <div key={a.key} className="rounded-[14px] border border-border bg-card p-5 card-lift" style={{ boxShadow: "var(--shadow-card)" }}>
                <div className="font-display text-lg flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-[#c17f5a]" /> {a.label}
                </div>
                <div className="font-mono text-sm mt-1">
                  {formatINR(a.price)}<span className="text-muted-foreground">{a.unit}</span>
                </div>
                <button
                  onClick={() => handleAddon(a.key)}
                  disabled={loading === a.key || owned}
                  className="mt-4 w-full h-10 rounded-[6px] border border-border text-sm font-medium hover:bg-muted inline-flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading === a.key && <Loader2 className="h-4 w-4 animate-spin" />}
                  {owned ? "Purchased" : a.recurring ? "Add" : "Buy Now"}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function CycleToggle({ cycle, onChange }: { cycle: BillingCycle; onChange: (c: BillingCycle) => void }) {
  return (
    <div className="relative inline-flex items-center bg-muted rounded-full p-1 text-sm">
      <span
        className="absolute top-1 bottom-1 rounded-full bg-card shadow-sm transition-all duration-300 ease-out"
        style={{ left: cycle === "monthly" ? 4 : "50%", width: "calc(50% - 4px)" }}
      />
      <button
        type="button"
        onClick={() => onChange("monthly")}
        className={`relative z-10 px-4 h-8 rounded-full transition-colors ${cycle === "monthly" ? "text-foreground" : "text-muted-foreground"}`}
      >
        Monthly
      </button>
      <button
        type="button"
        onClick={() => onChange("yearly")}
        className={`relative z-10 px-4 h-8 rounded-full transition-colors ${cycle === "yearly" ? "text-foreground" : "text-muted-foreground"}`}
      >
        Yearly <span className="text-[10px] text-[#c17f5a] ml-1">2 mo free</span>
      </button>
    </div>
  );
}
