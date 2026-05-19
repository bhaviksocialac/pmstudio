import { createFileRoute } from "@tanstack/react-router";
import { Download, Plus, Send, FileDown, Check, Pencil, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { invoices, paymentRequests, monthlyRevenue, formatINR } from "@/lib/studio-data";
import { openModal } from "@/lib/app-bus";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({ meta: [{ title: "Finance — StudioOS" }, { name: "description", content: "Invoices, payments, receivables and cashflow for your studio." }] }),
  component: FinancePage,
});

const statusTone: Record<string, { bg: string; color: string; label: string }> = {
  paid: { bg: "rgba(122,158,138,0.18)", color: "#7a9e8a", label: "Paid" },
  overdue: { bg: "rgba(196,104,90,0.18)", color: "#c4685a", label: "Overdue" },
  sent: { bg: "rgba(212,136,42,0.18)", color: "#d4882a", label: "Sent" },
  draft: { bg: "rgba(107,95,88,0.12)", color: "#6b5f58", label: "Draft" },
};

function FinancePage() {
  const [approved, setApproved] = useState<string[]>([]);
  const maxRev = Math.max(...monthlyRevenue.map((m) => m.value));

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
            <select className="h-10 px-3 rounded-[10px] bg-card border border-border text-sm">
              <option>May 2026</option><option>April 2026</option><option>March 2026</option>
            </select>
            <button onClick={() => toast.success("Report downloaded")} className="h-10 px-4 inline-flex items-center gap-2 rounded-[6px] border border-border bg-card text-sm font-medium hover:bg-muted">
              <Download className="h-4 w-4" /> Download Report
            </button>
          </div>
        </div>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <SummaryCard label="Collected This Month" value="₹8,40,000" tone="#7a9e8a" trend="↑ 18%" />
          <SummaryCard label="Pending Collection" value="₹5,20,000" tone="#d4882a" trend="2 overdue" />
          <SummaryCard label="Total Expenses" value="₹4,30,000" tone="#3d3530" />
          <SummaryCard label="Net Profit" value="₹4,10,000" tone="#7a9e8a" trend="↑ 12%" />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-[1.85fr_1fr] gap-6">
          {/* Left column */}
          <div className="space-y-6">
            <section className="rounded-[16px] bg-card border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <h2 className="font-display text-xl">Invoices</h2>
                <button onClick={() => openModal("new-invoice")} className="h-9 px-3 inline-flex items-center gap-1.5 rounded-[6px] bg-primary text-primary-foreground text-xs font-medium hover:brightness-95">
                  <Plus className="h-3.5 w-3.5" /> New Invoice
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    <tr>{["#","Project","Milestone","Amount","Due","Status","Actions"].map((h) => <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {invoices.map((inv) => {
                      const t = statusTone[inv.status];
                      return (
                        <tr key={inv.no} className="hover:bg-muted/40">
                          <td className="px-4 py-3 font-mono text-xs">{inv.no}</td>
                          <td className="px-4 py-3"><div className="font-medium">{inv.project}</div><div className="text-[11px] text-muted-foreground">{inv.client}</div></td>
                          <td className="px-4 py-3 text-muted-foreground">{inv.milestone}</td>
                          <td className="px-4 py-3 font-mono tabular-nums">{formatINR(inv.amount)}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{inv.due}</td>
                          <td className="px-4 py-3"><span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-[6px]" style={{ background: t.bg, color: t.color }}>{t.label}</span></td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <IconBtn icon={Send} onClick={() => toast.success(`${inv.no} sent`)} />
                              <IconBtn icon={FileDown} onClick={() => toast.success("PDF downloaded")} />
                              <IconBtn icon={Check} onClick={() => toast.success(`${inv.no} marked paid`)} />
                              <IconBtn icon={Pencil} onClick={() => openModal("new-invoice")} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-[16px] bg-card border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="px-6 py-4 border-b border-border">
                <h2 className="font-display text-xl">Contractor Payment Requests</h2>
              </div>
              <div className="divide-y divide-border">
                {paymentRequests.map((r) => {
                  const isApproved = approved.includes(r.id);
                  return (
                    <div key={r.id} className="px-6 py-4 flex flex-wrap items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{r.vendor}</div>
                        <div className="text-xs text-muted-foreground">{r.scope} · {r.project}</div>
                        <div className="text-[11px] text-muted-foreground font-mono mt-0.5">Submitted {r.submitted}</div>
                      </div>
                      <div className="font-display text-2xl tabular-nums">{formatINR(r.amount)}</div>
                      {isApproved ? (
                        <span className="text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-[6px]" style={{ background: "rgba(122,158,138,0.18)", color: "#7a9e8a" }}>Payment Sent</span>
                      ) : (
                        <div className="flex gap-2">
                          <button onClick={() => { setApproved((a) => [...a, r.id]); toast.success("Payment approved"); }} className="h-9 px-4 rounded-[6px] bg-[#7a9e8a] text-white text-xs font-medium hover:brightness-110">Approve</button>
                          <button onClick={() => toast("Held for review")} className="h-9 px-4 rounded-[6px] border border-border text-xs font-medium hover:bg-muted">Hold</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Right column */}
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
              <div className="font-display text-3xl tabular-nums mb-4">₹5,20,000</div>
              <div className="space-y-2.5">
                {[{ l: "0–30 days", v: "₹3,20,000", c: "#7a9e8a", w: 62 },
                  { l: "30–60 days", v: "₹1,40,000", c: "#d4882a", w: 27 },
                  { l: "60+ days", v: "₹60,000", c: "#c4685a", w: 11 }].map((r) => (
                  <div key={r.l}>
                    <div className="flex justify-between text-xs mb-1"><span>{r.l}</span><span className="font-mono">{r.v}</span></div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full" style={{ width: `${r.w}%`, background: r.c }} /></div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[16px] bg-card border border-border p-6" style={{ boxShadow: "var(--shadow-card)" }}>
              <h3 className="font-display text-lg mb-1">Accounts Payable</h3>
              <div className="font-display text-3xl tabular-nums mb-4">₹1,23,000</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Suresh Electricals</span><span className="font-mono">₹78,000</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Ramesh Kumar</span><span className="font-mono">₹45,000</span></div>
              </div>
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
