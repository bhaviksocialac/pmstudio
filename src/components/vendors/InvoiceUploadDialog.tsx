import { useState, useMemo, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, X, Sparkles, Upload, Plus, Trash2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { extractInvoiceFromDocument, type InvoiceExtract, type InvoiceLineExtract } from "@/lib/vendor-invoice-extract.functions";
import type { DbVendor } from "@/lib/db-types";

type Props = {
  projectId: string;
  vendor: DbVendor;
  onClose: () => void;
};

type Phase = "pick" | "uploading" | "review";

export function InvoiceUploadDialog({ projectId, vendor, onClose }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const extractFn = useServerFn(extractInvoiceFromDocument);
  const [phase, setPhase] = useState<Phase>("pick");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfPath, setPdfPath] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("");
  const [originalName, setOriginalName] = useState<string>("");
  const [form, setForm] = useState<InvoiceExtract | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [updateMaster, setUpdateMaster] = useState(false);

  const onFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) { toast.error("Max 10MB"); return; }
    if (!["application/pdf", "image/jpeg", "image/png", "image/jpg"].includes(file.type)) {
      toast.error("Only PDF, JPG, PNG"); return;
    }
    setPhase("uploading");
    setMimeType(file.type);
    setOriginalName(file.name);
    try {
      const ext = file.name.split(".").pop() ?? "pdf";
      const path = `invoices/${projectId}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("project-photos").upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (up.error) throw up.error;
      const { data: pub } = supabase.storage.from("project-photos").getPublicUrl(path);
      setPdfUrl(pub.publicUrl);
      setPdfPath(path);

      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = ""; for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      const res = await extractFn({ data: { fileName: file.name, mimeType: file.type, base64 } });
      if (!res.ok || !res.data) { toast.error(res.error || "AI couldn't read invoice"); setPhase("review"); setForm(emptyExtract()); return; }
      setForm(res.data);
      setMissing(res.missingFields ?? []);
      setPhase("review");
      toast.success("AI extracted invoice. Please review.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
      setPhase("pick");
    }
  };

  // Intelligence checks
  const alerts = useMemo(() => {
    if (!form) return [] as { kind: "red" | "amber"; label: string; askUpdate?: boolean }[];
    const out: { kind: "red" | "amber"; label: string; askUpdate?: boolean }[] = [];
    const masterGst = (vendor.gst ?? "").trim().toUpperCase();
    const invGst = (form.gst ?? "").trim().toUpperCase();
    if (invGst && masterGst && invGst !== masterGst) out.push({ kind: "red", label: `GST on invoice (${invGst}) differs from master record (${masterGst})` });
    const masterAcc = ((vendor as DbVendor & { bank_account?: string | null }).bank_account ?? "").trim();
    const invAcc = (form.bank_account ?? "").trim();
    if (invAcc && masterAcc && invAcc !== masterAcc) out.push({ kind: "amber", label: "Bank account differs from master record.", askUpdate: true });
    const masterIfsc = ((vendor as DbVendor & { ifsc?: string | null }).ifsc ?? "").trim().toUpperCase();
    const invIfsc = (form.ifsc ?? "").trim().toUpperCase();
    if (invIfsc && masterIfsc && invIfsc !== masterIfsc) out.push({ kind: "amber", label: `IFSC differs from master (${masterIfsc})`, askUpdate: true });
    const masterCo = (vendor.company_name ?? "").trim().toLowerCase();
    const invCo = (form.company_name ?? "").trim().toLowerCase();
    if (invCo && masterCo && invCo !== masterCo) out.push({ kind: "amber", label: `Company name on invoice ("${form.company_name}") differs from master.` });
    return out;
  }, [form, vendor]);

  const save = useMutation({
    mutationFn: async () => {
      if (!user || !form || !pdfUrl || !pdfPath) throw new Error("Not ready");
      const subtotal = num(form.subtotal);
      const gst_amount = num(form.gst_amount);
      const total_amount = num(form.total_amount) || subtotal + gst_amount;
      const { data: ins, error } = await supabase.from("vendor_invoices").insert({
        user_id: user.id,
        project_id: projectId,
        vendor_id: vendor.id,
        invoice_number: form.invoice_number,
        invoice_date: form.invoice_date,
        due_date: form.due_date,
        subtotal, gst_percent: num(form.gst_percent), gst_amount, total_amount,
        company_name_snapshot: form.company_name,
        gst_snapshot: form.gst,
        bank_account_snapshot: form.bank_account,
        ifsc_snapshot: form.ifsc,
        bank_name_snapshot: form.bank_name,
        notes: form.notes, terms: form.terms,
        pdf_url: pdfUrl, pdf_storage_path: pdfPath,
        original_filename: originalName, mime_type: mimeType,
      }).select("id").single();
      if (error) throw error;

      if (form.lines.length > 0) {
        const lines = form.lines.map((l, i) => ({
          user_id: user.id, invoice_id: ins.id, order_index: i,
          description: l.description ?? "",
          quantity: num(l.quantity),
          unit: l.unit,
          rate: num(l.rate),
          amount: num(l.amount),
        }));
        const { error: le } = await supabase.from("vendor_invoice_lines").insert(lines);
        if (le) throw le;
      }

      if (updateMaster) {
        const patch: { bank_account?: string; ifsc?: string; gst?: string } = {};
        if (form.bank_account) patch.bank_account = form.bank_account;
        if (form.ifsc) patch.ifsc = form.ifsc;
        if (form.gst) patch.gst = form.gst;
        if (Object.keys(patch).length > 0) {
          await supabase.from("vendors").update(patch).eq("id", vendor.id);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor_invoices"] });
      qc.invalidateQueries({ queryKey: ["vendor_invoices", projectId] });
      qc.invalidateQueries({ queryKey: ["finance", "vendor_invoices"] });
      qc.invalidateQueries({ queryKey: ["vendor-performance"] });
      qc.invalidateQueries({ queryKey: ["vendors"] });
      toast.success("Invoice saved");
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to save"),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-6xl bg-card rounded-[16px] shadow-2xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Upload Invoice</div>
            <h3 className="font-display text-xl">{vendor.company_name || vendor.name}</h3>
          </div>
          <button onClick={onClose} className="h-9 w-9 rounded-[10px] hover:bg-muted flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>

        {phase === "pick" && (
          <div className="p-12 text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-[#fff7eb] flex items-center justify-center mb-4">
              <Sparkles className="h-6 w-6 text-[#c17f5a]" />
            </div>
            <h4 className="font-display text-2xl mb-2">Upload PDF, JPG or PNG</h4>
            <p className="text-sm text-muted-foreground mb-6">AI will read the invoice and pre-fill every field for you.</p>
            <label className="inline-flex items-center gap-2 h-11 px-5 rounded-[8px] bg-primary text-primary-foreground text-sm font-medium cursor-pointer hover:brightness-95">
              <Upload className="h-4 w-4" /> Choose file
              <input type="file" hidden accept=".pdf,image/jpeg,image/png,image/jpg"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
            </label>
          </div>
        )}

        {phase === "uploading" && (
          <div className="p-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#c17f5a] mb-4" />
            <div className="font-display text-xl">AI reading invoice…</div>
            <div className="text-sm text-muted-foreground mt-1">~10 seconds</div>
          </div>
        )}

        {phase === "review" && form && (
          <>
            <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2 gap-0 min-h-0">
              <div className="border-r border-border bg-muted/30 min-h-[40vh] overflow-auto">
                {pdfUrl && mimeType.startsWith("image/") ? (
                  <img src={pdfUrl} alt="Invoice" className="w-full h-auto" />
                ) : pdfUrl ? (
                  <embed src={pdfUrl} type="application/pdf" className="w-full h-full min-h-[60vh]" />
                ) : null}
              </div>
              <div className="overflow-y-auto p-6 space-y-4">
                {alerts.map((a, i) => (
                  <div key={i} className={`rounded-[10px] border p-3 flex items-start gap-2 ${a.kind === "red" ? "border-[#c4685a] bg-[#fff0ee]" : "border-[#d4882a] bg-[#fff7eb]"}`}>
                    <AlertTriangle className={`h-4 w-4 mt-0.5 flex-shrink-0 ${a.kind === "red" ? "text-[#c4685a]" : "text-[#d4882a]"}`} />
                    <div className="flex-1 text-xs">
                      <div className={a.kind === "red" ? "text-[#c4685a] font-medium" : "text-[#8a5a1a] font-medium"}>{a.label}</div>
                      {a.askUpdate && (
                        <label className="inline-flex items-center gap-1.5 mt-1.5">
                          <input type="checkbox" checked={updateMaster} onChange={(e) => setUpdateMaster(e.target.checked)} className="accent-[#c17f5a]" />
                          <span>Update master vendor record</span>
                        </label>
                      )}
                    </div>
                  </div>
                ))}

                <div className="grid grid-cols-2 gap-3">
                  <Fld label="Invoice Number" missing={missing.includes("invoice_number")}>
                    <Input value={form.invoice_number ?? ""} onChange={(v) => setForm({ ...form, invoice_number: v })} amber={missing.includes("invoice_number") && !form.invoice_number} />
                  </Fld>
                  <Fld label="Invoice Date" missing={missing.includes("invoice_date")}>
                    <Input type="date" value={form.invoice_date ?? ""} onChange={(v) => setForm({ ...form, invoice_date: v })} amber={missing.includes("invoice_date") && !form.invoice_date} />
                  </Fld>
                  <Fld label="Due Date" missing={missing.includes("due_date")}>
                    <Input type="date" value={form.due_date ?? ""} onChange={(v) => setForm({ ...form, due_date: v })} amber={missing.includes("due_date") && !form.due_date} />
                  </Fld>
                  <Fld label="Company on Invoice">
                    <Input value={form.company_name ?? ""} onChange={(v) => setForm({ ...form, company_name: v })} />
                  </Fld>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Line Items</div>
                    <button onClick={() => setForm({ ...form, lines: [...form.lines, { description: "", quantity: 0, unit: "", rate: 0, amount: 0 }] })}
                      className="h-7 px-2 rounded-[6px] border border-border text-[11px] inline-flex items-center gap-1 hover:bg-muted">
                      <Plus className="h-3 w-3" /> Row
                    </button>
                  </div>
                  <div className="rounded-[8px] border border-border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="text-left px-2 py-1.5 font-medium">Description</th>
                          <th className="text-right px-2 py-1.5 font-medium w-14">Qty</th>
                          <th className="text-left px-2 py-1.5 font-medium w-12">Unit</th>
                          <th className="text-right px-2 py-1.5 font-medium w-20">Rate</th>
                          <th className="text-right px-2 py-1.5 font-medium w-24">Amount</th>
                          <th className="w-6" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {form.lines.map((l, i) => (
                          <tr key={i}>
                            <td className="px-1"><LineInput value={l.description ?? ""} onChange={(v) => updateLine(form, setForm, i, "description", v)} /></td>
                            <td className="px-1"><LineInput value={String(l.quantity ?? "")} onChange={(v) => updateLine(form, setForm, i, "quantity", v.replace(/[^\d.]/g, ""))} align="right" /></td>
                            <td className="px-1"><LineInput value={l.unit ?? ""} onChange={(v) => updateLine(form, setForm, i, "unit", v)} /></td>
                            <td className="px-1"><LineInput value={String(l.rate ?? "")} onChange={(v) => updateLine(form, setForm, i, "rate", v.replace(/[^\d.]/g, ""))} align="right" /></td>
                            <td className="px-1"><LineInput value={String(l.amount ?? "")} onChange={(v) => updateLine(form, setForm, i, "amount", v.replace(/[^\d.]/g, ""))} align="right" /></td>
                            <td className="px-1 text-center">
                              <button onClick={() => setForm({ ...form, lines: form.lines.filter((_, k) => k !== i) })} className="text-[#c4685a]"><Trash2 className="h-3 w-3" /></button>
                            </td>
                          </tr>
                        ))}
                        {form.lines.length === 0 && (
                          <tr><td colSpan={6} className="px-2 py-3 text-center text-muted-foreground text-[11px]">No line items extracted. Click + Row to add.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <Fld label="Subtotal" missing={missing.includes("subtotal")}>
                    <Input value={String(form.subtotal ?? "")} onChange={(v) => setForm({ ...form, subtotal: parseNum(v) })} amber={missing.includes("subtotal") && form.subtotal == null} />
                  </Fld>
                  <Fld label="GST %" missing={missing.includes("gst_percent")}>
                    <Input value={String(form.gst_percent ?? "")} onChange={(v) => setForm({ ...form, gst_percent: parseNum(v) })} amber={missing.includes("gst_percent") && form.gst_percent == null} />
                  </Fld>
                  <Fld label="GST Amount" missing={missing.includes("gst_amount")}>
                    <Input value={String(form.gst_amount ?? "")} onChange={(v) => setForm({ ...form, gst_amount: parseNum(v) })} amber={missing.includes("gst_amount") && form.gst_amount == null} />
                  </Fld>
                </div>
                <Fld label="Total Amount" missing={missing.includes("total_amount")}>
                  <Input value={String(form.total_amount ?? "")} onChange={(v) => setForm({ ...form, total_amount: parseNum(v) })} amber={missing.includes("total_amount") && form.total_amount == null} />
                </Fld>

                <div className="pt-2 border-t border-border">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Bank Details</div>
                  <div className="grid grid-cols-2 gap-3">
                    <Fld label="Account Number"><Input value={form.bank_account ?? ""} onChange={(v) => setForm({ ...form, bank_account: v })} /></Fld>
                    <Fld label="IFSC"><Input value={form.ifsc ?? ""} onChange={(v) => setForm({ ...form, ifsc: v.toUpperCase() })} /></Fld>
                    <Fld label="Bank Name"><Input value={form.bank_name ?? ""} onChange={(v) => setForm({ ...form, bank_name: v })} /></Fld>
                    <Fld label="Vendor GSTIN"><Input value={form.gst ?? ""} onChange={(v) => setForm({ ...form, gst: v.toUpperCase() })} /></Fld>
                  </div>
                </div>

                <Fld label="Notes / Terms">
                  <textarea value={`${form.notes ?? ""}${form.terms ? `\n${form.terms}` : ""}`} onChange={(e) => setForm({ ...form, notes: e.target.value, terms: null })}
                    rows={2} className="w-full px-2 py-1.5 rounded-[8px] bg-card border border-border text-xs" />
                </Fld>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex justify-end gap-2 flex-shrink-0">
              <button onClick={onClose} className="h-10 px-4 rounded-[6px] border border-border text-sm font-medium hover:bg-muted">Cancel</button>
              <button onClick={() => save.mutate()} disabled={save.isPending}
                className="h-10 px-5 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95 inline-flex items-center gap-2 disabled:opacity-60">
                {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Confirm & Save
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function emptyExtract(): InvoiceExtract {
  return {
    company_name: null, invoice_number: null, invoice_date: null, due_date: null,
    subtotal: null, gst_percent: null, gst_amount: null, total_amount: null,
    bank_account: null, ifsc: null, bank_name: null, gst: null,
    notes: null, terms: null, lines: [],
  };
}
function num(v: number | null | undefined): number { return Number.isFinite(Number(v)) ? Number(v) : 0; }
function parseNum(v: string): number | null { if (v.trim() === "") return null; const n = Number(v); return Number.isFinite(n) ? n : null; }
function updateLine(form: InvoiceExtract, set: (f: InvoiceExtract) => void, i: number, key: keyof InvoiceLineExtract, val: string) {
  const next = [...form.lines];
  const numeric = key === "quantity" || key === "rate" || key === "amount";
  next[i] = { ...next[i], [key]: numeric ? (val === "" ? null : Number(val)) : val } as InvoiceLineExtract;
  set({ ...form, lines: next });
}

function Fld({ label, missing, children }: { label: string; missing?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className={`text-[10px] uppercase tracking-wider mb-1 ${missing ? "text-[#d4882a]" : "text-muted-foreground"}`}>
        {label}{missing && <span className="ml-1 normal-case tracking-normal">• fill manually</span>}
      </div>
      {children}
    </label>
  );
}
function Input({ value, onChange, type = "text", amber }: { value: string; onChange: (v: string) => void; type?: string; amber?: boolean }) {
  return (
    <input value={value} onChange={(e) => onChange(e.target.value)} type={type}
      className={`w-full h-9 px-2 rounded-[8px] bg-card border text-xs focus:outline-none focus:ring-2 focus:ring-ring/30 ${amber ? "border-[#d4882a] bg-[#fff7eb]" : "border-border"}`} />
  );
}
function LineInput({ value, onChange, align = "left" }: { value: string; onChange: (v: string) => void; align?: "left" | "right" }) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} className={`w-full h-7 px-1.5 bg-transparent border-0 text-xs focus:outline-none focus:bg-card ${align === "right" ? "text-right font-mono" : ""}`} />;
}

// Avoid unused import warning when component unmounts during async
useEffect;
