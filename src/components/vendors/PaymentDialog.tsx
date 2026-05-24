import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatINR } from "@/lib/studio-data";

type Method = "bank_transfer" | "cheque" | "cash" | "upi";

export function PaymentDialog({
  invoiceId, total, alreadyPaid, onClose,
}: { invoiceId: string; total: number; alreadyPaid: number; onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const outstanding = Math.max(0, total - alreadyPaid);
  const [mode, setMode] = useState<"full" | "partial">("full");
  const [amount, setAmount] = useState<string>(String(outstanding));
  const [method, setMethod] = useState<Method>("bank_transfer");
  const [paidOn, setPaidOn] = useState<string>(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not logged in");
      const amt = mode === "full" ? outstanding : Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("Enter a valid amount");
      if (amt > outstanding + 0.01) throw new Error(`Amount exceeds outstanding ${formatINR(outstanding)}`);
      const { error } = await supabase.from("vendor_invoice_payments").insert({
        user_id: user.id,
        invoice_id: invoiceId,
        amount: amt, paid_on: paidOn, method,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor_invoices"] });
      qc.invalidateQueries({ queryKey: ["vendor_invoice_payments", invoiceId] });
      qc.invalidateQueries({ queryKey: ["finance", "vendor_invoices"] });
      qc.invalidateQueries({ queryKey: ["vendor-performance"] });
      toast.success("Payment recorded");
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card rounded-[16px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-display text-xl">Record Payment</h3>
          <button onClick={onClose} className="h-9 w-9 rounded-[10px] hover:bg-muted flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-6 space-y-3">
          <div className="rounded-[8px] bg-muted/40 p-3 text-xs flex justify-between">
            <span className="text-muted-foreground">Outstanding</span>
            <span className="font-mono">{formatINR(outstanding)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => { setMode("full"); setAmount(String(outstanding)); }}
              className={`h-10 rounded-[8px] border text-sm font-medium ${mode === "full" ? "bg-foreground text-background border-foreground" : "border-border hover:bg-muted"}`}>Full Payment</button>
            <button onClick={() => setMode("partial")}
              className={`h-10 rounded-[8px] border text-sm font-medium ${mode === "partial" ? "bg-foreground text-background border-foreground" : "border-border hover:bg-muted"}`}>Partial</button>
          </div>
          {mode === "partial" && (
            <Fld label="Amount (₹)"><input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              className="w-full h-10 px-3 rounded-[8px] bg-card border border-border text-sm font-mono" /></Fld>
          )}
          <Fld label="Method">
            <select value={method} onChange={(e) => setMethod(e.target.value as Method)} className="w-full h-10 px-3 rounded-[8px] bg-card border border-border text-sm">
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cheque">Cheque</option>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
            </select>
          </Fld>
          <Fld label="Paid On"><input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className="w-full h-10 px-3 rounded-[8px] bg-card border border-border text-sm" /></Fld>
          <Fld label="Reference (optional)"><input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / cheque no." className="w-full h-10 px-3 rounded-[8px] bg-card border border-border text-sm" /></Fld>
          <Fld label="Notes (optional)"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-[8px] bg-card border border-border text-sm" /></Fld>
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="h-10 px-4 rounded-[6px] border border-border text-sm">Cancel</button>
          <button onClick={() => save.mutate()} disabled={save.isPending}
            className="h-10 px-5 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium inline-flex items-center gap-2 disabled:opacity-60">
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save Payment
          </button>
        </div>
      </div>
    </div>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>{children}</label>;
}
