import { createFileRoute } from "@tanstack/react-router";
import { Download, Plus, Send, FileDown, Check, Pencil, TrendingUp, Loader2, CreditCard } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { formatINR, monthlyRevenue } from "@/lib/studio-data";
import { openModal } from "@/lib/app-bus";
import { toast } from "sonner";
import { FreshnessTag, freshnessLevel } from "@/components/FreshnessTag";
import { createInvoiceOrder } from "@/lib/razorpay.functions";
import { payInvoice } from "@/lib/razorpay-checkout";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({ meta: [{ title: "Finance — PMStudio" }, { name: "description", content: "Invoices, payments, receivables and cashflow for your studio." }] }),
  component: FinancePage,
});

const statusTone: Record<string, { bg: string; color: string; label: string }> = {
  paid: { bg: "rgba(122,158,138,0.18)", color: "#7a9e8a", label: "Paid" },
  overdue: { bg: "rgba(196,104,90,0.18)", color: "#c4685a", label: "Overdue" },
  sent: { bg: "rgba(212,136,42,0.18)", color: "#d4882a", label: "Sent" },
  draft: { bg: "rgba(107,95,88,0.12)", color: "#6b5f58", label: "Draft" },
};

function FinancePage() {
  const qc = useQueryClient();
  const maxRev = Math.max(...monthlyRevenue.map((m) => m.value));
  const createOrder = useServerFn(createInvoiceOrder);
  const [payingId, setPayingId] = useState<string | null>(null);

  const { data: invoices = [], isLoading: invLoading } = useQuery({
    queryKey: ["finance", "invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, projects(name), clients(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: requests = [], isLoading: reqLoading } = useQuery({
    queryKey: ["finance", "payment_requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_requests")
        .select("*, vendors(name), projects(name)")
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const collected = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0);
  const pending = invoices.filter((i) => i.status === "sent" || i.status === "overdue").reduce((s, i) => s + Number(i.amount), 0);
  const overdueCount = invoices.filter((i) => i.status === "overdue").length;

  const setInvoiceStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "draft" | "sent" | "paid" | "overdue" }) => {
      const { error } = await supabase.from("invoices").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance", "invoices"] }),
  });

  const setRequestStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "pending" | "approved" | "held" | "paid" }) => {
      const { error } = await supabase.from("payment_requests").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance", "payment_requests"] }),
  });

  return (
    <AppShell>
      <main className="px-4 md:px-8 py-8 md:py-10 max-w-[1400px] w-full pb-24 md:pb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-3">Studio</div>
            <h1 className="font-display text-4xl md:text-5xl">Finance</h1>
            <p className="text-muted-foreground mt-2">Every rupee in motion this month</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => toast.success("Report downloaded")} className="h-10 px-4 inline-flex items-center gap-2 rounded-[6px] border border-border bg-card text-sm font-medium hover:bg-muted">
              <Download className="h-4 w-4" /> Download Report
            </button>
          </div>
        </div>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <SummaryCard label="Collected" value={formatINR(collected)} tone="#7a9e8a" />
          <SummaryCard label="Pending Collection" value={formatINR(pending)} tone="#d4882a" trend={overdueCount > 0 ? `${overdueCount} overdue` : undefined} />
          <SummaryCard label="Total Invoices" value={String(invoices.length)} tone="#3d3530" />
          <SummaryCard label="Payment Requests" value={String(requests.length)} tone="#7a9e8a" />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-[1.85fr_1fr] gap-6">
          <div className="space-y-6">
            <section className="rounded-[16px] bg-card border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <h2 className="font-display text-xl">Invoices</h2>
                <button onClick={() => openModal("new-invoice")} className="h-9 px-3 inline-flex items-center gap-1.5 rounded-[6px] bg-primary text-primary-foreground text-xs font-medium hover:brightness-95">
                  <Plus className="h-3.5 w-3.5" /> New Invoice
                </button>
              </div>
              <div className="overflow-x-auto">
                {invLoading ? (
                  <div className="p-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : invoices.length === 0 ? (
                  <div className="p-10 text-center text-sm text-muted-foreground">No invoices yet.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      <tr>{["#","Project","Milestone","Amount","Due","Status","Actions"].map((h) => <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {invoices.map((inv) => {
                        const t = statusTone[inv.status] ?? statusTone.draft;
                        const projectName = (inv as { projects?: { name?: string } | null }).projects?.name ?? "—";
                        const clientName = (inv as { clients?: { name?: string } | null }).clients?.name ?? "";
                        return (
                          <tr key={inv.id} className="hover:bg-muted/40">
                            <td className="px-4 py-3 font-mono text-xs">{inv.number ?? inv.id.slice(0, 6)}</td>
                            <td className="px-4 py-3"><div className="font-medium">{projectName}</div><div className="text-[11px] text-muted-foreground">{clientName}</div></td>
                            <td className="px-4 py-3 text-muted-foreground">{inv.milestone ?? "—"}</td>
                            <td className="px-4 py-3 font-mono tabular-nums">{formatINR(Number(inv.amount))}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{inv.due_at ?? "—"}</td>
                            <td className="px-4 py-3"><span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-[6px] mr-1" style={{ background: t.bg, color: t.color }}>{t.label}</span><FreshnessTag updatedAt={inv.updated_at} showLabel={false} /></td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1">
                                <IconBtn icon={Send} onClick={() => {
                                  if (freshnessLevel(inv.updated_at) === "red") {
                                    toast.error("Data is stale. Refresh before sharing with client.");
                                    return;
                                  }
                                  setInvoiceStatus.mutate({ id: inv.id, status: "sent" }); toast.success("Invoice sent");
                                }} />
                                <IconBtn icon={FileDown} onClick={() => toast.success("PDF downloaded")} />
                                <IconBtn icon={Check} onClick={() => { setInvoiceStatus.mutate({ id: inv.id, status: "paid" }); toast.success("Marked paid"); }} />
                                <IconBtn icon={Pencil} onClick={() => openModal("new-invoice")} />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            <section className="rounded-[16px] bg-card border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="px-6 py-4 border-b border-border">
                <h2 className="font-display text-xl">Contractor Payment Requests</h2>
              </div>
              {reqLoading ? (
                <div className="p-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : requests.length === 0 ? (
                <div className="p-10 text-center text-sm text-muted-foreground">No payment requests.</div>
              ) : (
                <div className="divide-y divide-border">
                  {requests.map((r) => {
                    const vendorName = (r as { vendors?: { name?: string } | null }).vendors?.name ?? "Vendor";
                    const projectName = (r as { projects?: { name?: string } | null }).projects?.name ?? "—";
                    const isApproved = r.status === "approved" || r.status === "paid";
                    return (
                      <div key={r.id} className="px-6 py-4 flex flex-wrap items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{vendorName}</div>
                          <div className="text-xs text-muted-foreground">{r.scope ?? "—"} · {projectName}</div>
                          <div className="text-[11px] text-muted-foreground font-mono mt-0.5">Submitted {new Date(r.submitted_at).toLocaleDateString()}</div>
                        </div>
                        <div className="font-display text-2xl tabular-nums">{formatINR(Number(r.amount))}</div>
                        {isApproved ? (
                          <span className="text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-[6px]" style={{ background: "rgba(122,158,138,0.18)", color: "#7a9e8a" }}>{r.status}</span>
                        ) : (
                          <div className="flex gap-2">
                            <button onClick={() => { setRequestStatus.mutate({ id: r.id, status: "approved" }); toast.success("Payment approved"); }} className="h-9 px-4 rounded-[6px] bg-[#7a9e8a] text-white text-xs font-medium hover:brightness-110">Approve</button>
                            <button onClick={() => { setRequestStatus.mutate({ id: r.id, status: "held" }); toast("Held for review"); }} className="h-9 px-4 rounded-[6px] border border-border text-xs font-medium hover:bg-muted">Hold</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-[16px] bg-card border border-border p-6" style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-lg">Revenue</h3>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1"><TrendingUp className="h-3 w-3" /> 6 months</span>
              </div>
              <div className="flex items-end gap-2 h-32">
                {monthlyRevenue.map((m) => (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5">
                    <div className="w-full rounded-t-[6px] transition-all"
                         style={{ height: `${(m.value / maxRev) * 100}%`, background: m.highlight ? "#c17f5a" : "#e8d9c9" }} />
                    <span className={`text-[10px] font-mono ${m.highlight ? "text-foreground font-medium" : "text-muted-foreground"}`}>{m.month}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[16px] bg-card border border-border p-6" style={{ boxShadow: "var(--shadow-card)" }}>
              <h3 className="font-display text-lg mb-1">Accounts Receivable</h3>
              <div className="font-display text-3xl tabular-nums mb-4">{formatINR(pending)}</div>
              <div className="text-xs text-muted-foreground">{overdueCount > 0 ? `${overdueCount} overdue invoice${overdueCount === 1 ? "" : "s"}` : "All invoices on schedule."}</div>
            </section>
          </div>
        </div>
      </main>
    </AppShell>
  );
}

function SummaryCard({ label, value, tone, trend }: { label: string; value: string; tone: string; trend?: string }) {
  return (
    <div className="rounded-[16px] bg-card border border-border p-5" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="font-display text-3xl mt-1 tabular-nums" style={{ color: tone }}>{value}</div>
      {trend && <div className="text-[11px] font-mono mt-1.5" style={{ color: tone }}>{trend}</div>}
    </div>
  );
}

function IconBtn({ icon: Icon, onClick }: { icon: React.ComponentType<{ className?: string }>; onClick: () => void }) {
  return <button onClick={onClick} className="h-8 w-8 rounded-[6px] border border-border flex items-center justify-center hover:bg-muted"><Icon className="h-3.5 w-3.5" /></button>;
}
