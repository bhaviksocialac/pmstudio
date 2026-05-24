import { useQuery } from "@tanstack/react-query";
import { Loader2, ExternalLink } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/studio-data";
import { PaymentDialog } from "./PaymentDialog";

type Row = {
  id: string; invoice_number: string | null; due_date: string | null;
  subtotal: number; gst_amount: number; total_amount: number; amount_paid: number; status: string;
  pdf_url: string | null;
  vendors: { name: string | null; company_name: string | null } | null;
  projects: { name: string | null } | null;
};

const TONE: Record<string, { bg: string; color: string; label: string }> = {
  unpaid: { bg: "rgba(196,104,90,0.18)", color: "#c4685a", label: "Unpaid" },
  partial: { bg: "rgba(212,136,42,0.18)", color: "#d4882a", label: "Partial" },
  paid: { bg: "rgba(122,158,138,0.18)", color: "#7a9e8a", label: "Paid" },
};

export function AccountsPayableSection() {
  const [paying, setPaying] = useState<Row | null>(null);
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["finance", "vendor_invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_invoices")
        .select("id,invoice_number,due_date,subtotal,gst_amount,total_amount,amount_paid,status,pdf_url,vendors(name,company_name),projects(name)")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = (r: Row) => r.status !== "paid" && r.due_date && r.due_date < today;
  const outstanding = rows.reduce((s, r) => s + Math.max(0, Number(r.total_amount) - Number(r.amount_paid)), 0);
  const overdueCount = rows.filter(isOverdue).length;

  return (
    <section className="rounded-[16px] bg-card border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl">Accounts Payable</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Vendor invoices across all projects</p>
        </div>
        <div className="flex gap-4 text-right">
          <div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Outstanding</div><div className="font-display text-2xl tabular-nums" style={{ color: "#c4685a" }}>{formatINR(outstanding)}</div></div>
          {overdueCount > 0 && <div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Overdue</div><div className="font-display text-2xl tabular-nums" style={{ color: "#c4685a" }}>{overdueCount}</div></div>}
        </div>
      </div>
      <div className="overflow-x-auto">
        {isLoading ? (
          <div className="p-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No vendor invoices yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <tr>{["Vendor","Project","Inv No","Amount","GST","Total","Due","Status",""].map((h) => <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => {
                const t = TONE[r.status] ?? TONE.unpaid;
                const overdue = isOverdue(r);
                return (
                  <tr key={r.id} className={`hover:bg-muted/40 ${overdue ? "bg-[#fff0ee]" : ""}`}>
                    <td className="px-4 py-3">{r.vendors?.company_name || r.vendors?.name || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.projects?.name ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.invoice_number ?? r.id.slice(0, 6)}</td>
                    <td className="px-4 py-3 font-mono tabular-nums">{formatINR(Number(r.subtotal))}</td>
                    <td className="px-4 py-3 font-mono tabular-nums">{formatINR(Number(r.gst_amount))}</td>
                    <td className="px-4 py-3 font-mono tabular-nums font-medium">{formatINR(Number(r.total_amount))}</td>
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: overdue ? "#c4685a" : undefined }}>{r.due_date ?? "—"}</td>
                    <td className="px-4 py-3"><span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-[6px]" style={{ background: overdue ? "rgba(196,104,90,0.25)" : t.bg, color: overdue ? "#c4685a" : t.color }}>{overdue ? "Overdue" : t.label}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {r.status !== "paid" && <button onClick={() => setPaying(r)} className="h-8 px-2.5 rounded-[6px] bg-primary text-primary-foreground text-[11px] font-medium">Mark Paid</button>}
                        {r.pdf_url && <a href={r.pdf_url} target="_blank" rel="noreferrer" className="h-8 w-8 inline-flex items-center justify-center rounded-[6px] border border-border hover:bg-muted"><ExternalLink className="h-3 w-3" /></a>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {paying && <PaymentDialog invoiceId={paying.id} total={Number(paying.total_amount)} alreadyPaid={Number(paying.amount_paid)} onClose={() => setPaying(null)} />}
    </section>
  );
}
