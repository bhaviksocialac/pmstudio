import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/studio-data";
import { PaymentDialog } from "./PaymentDialog";

const STATUS_TONE: Record<string, { bg: string; color: string; label: string }> = {
  unpaid: { bg: "rgba(196,104,90,0.18)", color: "#c4685a", label: "Unpaid" },
  partial: { bg: "rgba(212,136,42,0.18)", color: "#d4882a", label: "Partial" },
  paid: { bg: "rgba(122,158,138,0.18)", color: "#7a9e8a", label: "Paid" },
};

type Invoice = {
  id: string; invoice_number: string | null; invoice_date: string | null; due_date: string | null;
  total_amount: number; amount_paid: number; status: string; pdf_url: string | null;
};

export function VendorInvoiceList({ projectId, vendorId }: { projectId: string; vendorId: string }) {
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: invoices = [] } = useQuery({
    queryKey: ["vendor_invoices", projectId, vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_invoices")
        .select("id,invoice_number,invoice_date,due_date,total_amount,amount_paid,status,pdf_url")
        .eq("project_id", projectId).eq("vendor_id", vendorId)
        .order("invoice_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Invoice[];
    },
  });

  const invoiced = invoices.reduce((s, i) => s + Number(i.total_amount), 0);
  const paid = invoices.reduce((s, i) => s + Number(i.amount_paid), 0);
  const outstanding = Math.max(0, invoiced - paid);

  if (invoices.length === 0) return <div className="text-[11px] text-muted-foreground italic">No invoices yet.</div>;

  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Invoices</div>
      <div className="rounded-[8px] border border-border divide-y divide-border bg-background">
        {invoices.map((inv) => {
          const t = STATUS_TONE[inv.status] ?? STATUS_TONE.unpaid;
          const isOpen = expanded === inv.id;
          return (
            <div key={inv.id}>
              <div className="px-3 py-2 flex items-center gap-2 text-xs">
                <button onClick={() => setExpanded(isOpen ? null : inv.id)} className="text-muted-foreground">
                  {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </button>
                <span className="font-mono flex-1 truncate">{inv.invoice_number || inv.id.slice(0, 6)}</span>
                <span className="text-muted-foreground font-mono">{inv.invoice_date ?? "—"}</span>
                <span className="font-mono tabular-nums">{formatINR(Number(inv.total_amount))}</span>
                <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-[4px]" style={{ background: t.bg, color: t.color }}>{t.label}</span>
                {inv.status !== "paid" && (
                  <button onClick={() => setPaying(inv)} className="h-7 px-2 rounded-[6px] bg-primary text-primary-foreground text-[10px] font-medium">Mark Paid</button>
                )}
                {inv.pdf_url && (
                  <a href={inv.pdf_url} target="_blank" rel="noreferrer" className="h-7 w-7 inline-flex items-center justify-center rounded-[6px] border border-border hover:bg-muted">
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              {isOpen && <PaymentHistory invoiceId={inv.id} total={Number(inv.total_amount)} paid={Number(inv.amount_paid)} />}
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between text-[11px] pt-1">
        <span className="text-muted-foreground">Invoiced <span className="font-mono text-foreground">{formatINR(invoiced)}</span></span>
        <span className="text-muted-foreground">Paid <span className="font-mono text-[#7a9e8a]">{formatINR(paid)}</span></span>
        <span className="text-muted-foreground">Outstanding <span className="font-mono text-[#c4685a]">{formatINR(outstanding)}</span></span>
      </div>
      {paying && <PaymentDialog invoiceId={paying.id} total={Number(paying.total_amount)} alreadyPaid={Number(paying.amount_paid)} onClose={() => setPaying(null)} />}
    </div>
  );
}

function PaymentHistory({ invoiceId, total, paid }: { invoiceId: string; total: number; paid: number }) {
  const { data: pays = [] } = useQuery({
    queryKey: ["vendor_invoice_payments", invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase.from("vendor_invoice_payments")
        .select("id,amount,paid_on,method,reference").eq("invoice_id", invoiceId)
        .order("paid_on", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const balance = Math.max(0, total - paid);
  return (
    <div className="px-8 py-2 bg-muted/30 text-[11px] space-y-1">
      <div className="flex justify-between text-muted-foreground">
        <span>Payment history</span>
        <span>Balance <span className="font-mono text-[#c4685a]">{formatINR(balance)}</span></span>
      </div>
      {pays.length === 0 ? (
        <div className="italic text-muted-foreground">No payments yet.</div>
      ) : (
        pays.map((p) => (
          <div key={p.id} className="flex items-center justify-between font-mono">
            <span>{p.paid_on}</span>
            <span className="text-muted-foreground">{p.method.replace("_", " ")}</span>
            <span>{p.reference ?? ""}</span>
            <span>{formatINR(Number(p.amount))}</span>
          </div>
        ))
      )}
    </div>
  );
}
