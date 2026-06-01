import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toast } from "sonner";
import { Search, Plus, X, Loader2, Phone, Pencil, Trash2, Upload, Sparkles, MessageCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { DbVendor } from "@/lib/db-types";
import { extractVendorFromDocument } from "@/lib/vendor-doc.functions";
import { AddressFields, type AddressValue } from "@/components/AddressFields";

export const Route = createFileRoute("/_authenticated/vendors")({
  head: () => ({ meta: [{ title: "Vendors — PMStudio" }, { name: "description", content: "All vendors with categories and contact details." }] }),
  component: VendorsPage,
});

import { DEFAULT_WORK_CATEGORIES, PAYMENT_TERM_PRESETS } from "@/lib/vendor-constants";
const DEFAULT_CATS: string[] = [...DEFAULT_WORK_CATEGORIES];
const DEFAULT_TERMS = PAYMENT_TERM_PRESETS;

function VendorsPage() {
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<DbVendor | null>(null);
  const [deleting, setDeleting] = useState<DbVendor | null>(null);
  const qc = useQueryClient();

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vendors").select("*").is("deleted_at", null).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DbVendor[];
    },
  });

  const { data: perfMap = {} } = useQuery({
    queryKey: ["vendor-performance"],
    queryFn: async () => {
      const [pvRes, snagRes] = await Promise.all([
        supabase.from("project_vendors").select("vendor_id,project_id,po_amount,status,expected_delivery"),
        supabase.from("snags").select("vendor_id,status"),
      ]);
      const map: Record<string, { projects: number; poTotal: number; onTimePct: number | null; openSnags: number; totalSnags: number }> = {};
      const byVendor: Record<string, { projects: Set<string>; po: number; delivered: number; onTime: number }> = {};
      for (const r of pvRes.data ?? []) {
        const k = r.vendor_id as string;
        if (!byVendor[k]) byVendor[k] = { projects: new Set(), po: 0, delivered: 0, onTime: 0 };
        byVendor[k].projects.add(r.project_id as string);
        byVendor[k].po += Number(r.po_amount ?? 0);
        if (r.status === "completed") {
          byVendor[k].delivered += 1;
          if (r.expected_delivery && new Date(r.expected_delivery) >= new Date(new Date().toDateString())) byVendor[k].onTime += 1;
        }
      }
      const snagsByVendor: Record<string, { open: number; total: number }> = {};
      for (const s of snagRes.data ?? []) {
        if (!s.vendor_id) continue;
        const k = s.vendor_id as string;
        if (!snagsByVendor[k]) snagsByVendor[k] = { open: 0, total: 0 };
        snagsByVendor[k].total += 1;
        if (s.status !== "closed" && s.status !== "verified") snagsByVendor[k].open += 1;
      }
      const allIds = new Set([...Object.keys(byVendor), ...Object.keys(snagsByVendor)]);
      for (const id of allIds) {
        const v = byVendor[id];
        const s = snagsByVendor[id];
        map[id] = {
          projects: v ? v.projects.size : 0,
          poTotal: v ? v.po : 0,
          onTimePct: v && v.delivered > 0 ? Math.round((v.onTime / v.delivered) * 100) : null,
          openSnags: s ? s.open : 0,
          totalSnags: s ? s.total : 0,
        };
      }
      return map;
    },
  });
  const filtered = vendors.filter((v) => v.name.toLowerCase().includes(q.toLowerCase()) || (v.company_name ?? "").toLowerCase().includes(q.toLowerCase()));

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vendors").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendors"] });
      toast.success("Vendor moved to Trash");
      setDeleting(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <AppShell>
      <main className="px-4 md:px-8 py-8 md:py-10 max-w-[1400px] w-full pb-24 md:pb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-3">Supply</div>
            <h1 className="font-display text-4xl md:text-5xl">Vendors</h1>
            <p className="text-muted-foreground mt-2">{vendors.length} vendor{vendors.length === 1 ? "" : "s"} in your network</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search vendors…" className="h-10 pl-10 pr-3 rounded-[10px] bg-card border border-border text-sm w-56 focus:outline-none focus:ring-2 focus:ring-ring/30" />
            </div>
            <button onClick={() => setAdding(true)} className="h-10 px-4 inline-flex items-center gap-2 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95">
              <Plus className="h-4 w-4" /> Add Vendor
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-[16px] bg-card border border-border h-64 animate-pulse" />
        ) : filtered.length === 0 ? (
          <Empty onAdd={() => setAdding(true)} />
        ) : (
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filtered.map((v) => (
              <article key={v.id} className="rounded-[16px] bg-card border border-border p-6" style={{ boxShadow: "var(--shadow-card)" }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {v.category && (
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-[6px] mb-1 inline-block" style={{ background: "rgba(193,127,90,0.15)", color: "#c17f5a" }}>{v.category}</span>
                    )}
                    <h3 className="font-display text-2xl leading-tight">{v.company_name || v.name}</h3>
                    {v.company_name && v.name && <div className="text-xs text-muted-foreground mt-0.5">Contact: {v.name}</div>}
                    <div className="mt-3 space-y-1 text-xs">
                      {v.phone && (
                        <div className="flex items-center gap-2 text-muted-foreground font-mono">
                          <Phone className="h-3 w-3" /> {v.phone}
                          {v.whatsapp && <MessageCircle className="h-3 w-3 text-[#25D366]" />}
                        </div>
                      )}
                      {v.gst && <div className="font-mono text-muted-foreground">GST: {v.gst}</div>}
                      {v.payment_terms && <div className="text-muted-foreground">Terms: <span className="text-foreground">{v.payment_terms}</span></div>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <button onClick={() => setEditing(v)} className="h-8 px-2.5 rounded-[6px] border border-border text-xs hover:bg-muted inline-flex items-center gap-1">
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                    <button onClick={() => setDeleting(v)} className="h-8 px-2.5 rounded-[6px] border border-border text-xs text-[#c4685a] hover:bg-[#fff0ee] inline-flex items-center gap-1">
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </div>
                </div>
                {v.notes && <p className="mt-3 text-xs text-muted-foreground">{v.notes}</p>}
                {(() => {
                  const p = perfMap[v.id];
                  if (!p || (p.projects === 0 && p.totalSnags === 0)) return null;
                  return (
                    <div className="mt-4 pt-3 border-t border-border grid grid-cols-4 gap-2 text-center">
                      <div><div className="font-display text-lg tabular-nums">{p.projects}</div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">Projects</div></div>
                      <div><div className="font-display text-lg tabular-nums">₹{(p.poTotal / 100000).toFixed(1)}L</div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">PO Value</div></div>
                      <div><div className="font-display text-lg tabular-nums" style={{ color: p.onTimePct == null ? undefined : p.onTimePct >= 80 ? "#7a9e8a" : "#d4882a" }}>{p.onTimePct == null ? "—" : `${p.onTimePct}%`}</div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">On-time</div></div>
                      <div><div className="font-display text-lg tabular-nums" style={{ color: p.openSnags > 0 ? "#c4685a" : undefined }}>{p.openSnags}/{p.totalSnags}</div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">Open Snags</div></div>
                    </div>
                  );
                })()}
              </article>
            ))}
          </section>
        )}
      </main>
      {adding && <VendorModal onClose={() => setAdding(false)} />}
      {editing && <VendorModal vendor={editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDeleting(null)}>
          <div className="w-full max-w-sm bg-card rounded-[16px] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-2xl mb-2">Delete {deleting.company_name || deleting.name}?</h3>
            <p className="text-sm text-muted-foreground mb-5">This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleting(null)} className="h-10 px-4 rounded-[6px] border border-border text-sm font-medium hover:bg-muted">Cancel</button>
              <button onClick={() => del.mutate(deleting.id)} disabled={del.isPending} className="h-10 px-5 rounded-[6px] bg-[#c4685a] text-white text-sm font-medium hover:brightness-95 inline-flex items-center gap-2 disabled:opacity-60">
                {del.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Empty({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-[16px] border border-dashed border-border p-16 text-center">
      <h3 className="font-display text-2xl">No vendors yet</h3>
      <p className="text-muted-foreground mt-2 mb-6">Add your first vendor to keep procurement organised.</p>
      <button onClick={onAdd} className="h-10 px-5 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95">+ Add Vendor</button>
    </div>
  );
}

const vendorSchema = z.object({
  vendor_type: z.enum(["individual", "company"]),
  name: z.string().trim().min(1, "Name required").max(160),
  phone: z.string().trim().min(1, "Mobile required").max(40),
});

export function VendorModal({ onClose, vendor, initialName, onCreated }: { onClose: () => void; vendor?: DbVendor; initialName?: string; onCreated?: (v: DbVendor) => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const editing = !!vendor;
  const extractFn = useServerFn(extractVendorFromDocument);

  const { data: customCats = [] } = useQuery({
    queryKey: ["vendor_custom_categories"],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("vendor_custom_categories").select("name").order("name");
      return ((data ?? []) as { name: string }[]).map((r) => r.name);
    },
  });
  const allCats = [...DEFAULT_CATS, ...customCats.filter((c) => !DEFAULT_CATS.includes(c))];

  const existingType = (vendor as any)?.vendor_type as "individual" | "company" | undefined;
  const initialCats: string[] = Array.isArray((vendor as any)?.work_categories)
    ? (vendor as any).work_categories
    : (vendor?.category ? [vendor.category] : []);

  const [form, setForm] = useState({
    vendor_type: existingType ?? "company" as "individual" | "company",
    name: vendor?.name ?? initialName ?? "",
    company_name: (vendor as any)?.company_name ?? "",
    designation: (vendor as any)?.designation ?? "",
    phone: vendor?.phone ?? "",
    whatsapp: (vendor as any)?.whatsapp ?? "",
    sameWA: !(vendor as any)?.whatsapp || (vendor as any)?.whatsapp === vendor?.phone,
    email: vendor?.email ?? "",
    work_categories: initialCats as string[],
    customCat: "",
    pan: (vendor as any)?.pan ?? "",
    gst: (vendor as any)?.gst ?? "",
    bank_account: (vendor as any)?.bank_account ?? "",
    ifsc: (vendor as any)?.ifsc ?? "",
    bank_name: (vendor as any)?.bank_name ?? "",
    payment_terms: vendor?.payment_terms ?? DEFAULT_TERMS[0],
    customTerms: "",
    notes: vendor?.notes ?? "",
  });
  const [address, setAddress] = useState<AddressValue>({
    flat_number: (vendor as any)?.flat_number ?? "",
    street: (vendor as any)?.street ?? "",
    city: (vendor as any)?.city ?? "",
    state: (vendor as any)?.state ?? "",
    country: (vendor as any)?.country ?? "",
    pincode: (vendor as any)?.pincode ?? "",
    latitude: (vendor as any)?.latitude ?? null,
    longitude: (vendor as any)?.longitude ?? null,
  });
  const setF = (k: keyof typeof form, v: any) => setForm((s) => ({ ...s, [k]: v }));
  const toggleCat = (c: string) => setForm((s) => ({ ...s, work_categories: s.work_categories.includes(c) ? s.work_categories.filter((x) => x !== c) : [...s.work_categories, c] }));
  const addCustomCat = async () => {
    const v = form.customCat.trim();
    if (!v) return;
    if (!customCats.includes(v) && user) {
      await supabase.from("vendor_custom_categories").insert({ user_id: user.id, name: v });
      qc.invalidateQueries({ queryKey: ["vendor_custom_categories"] });
    }
    setForm((s) => ({ ...s, work_categories: s.work_categories.includes(v) ? s.work_categories : [...s.work_categories, v], customCat: "" }));
  };
  const [extracting, setExtracting] = useState(false);

  const onFileUpload = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) { toast.error("Max 10MB"); return; }
    setExtracting(true);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      const res = await extractFn({ data: { fileName: file.name, mimeType: file.type || "application/pdf", base64 } });
      if (!res.ok || !res.data) { toast.error(res.error || "Couldn't read document"); return; }
      const d = res.data;
      setForm((s) => ({
        ...s,
        company_name: d.company_name ?? s.company_name,
        name: d.contact_person ?? s.name,
        phone: d.phone ?? s.phone,
        email: d.email ?? s.email,
        gst: d.gst ?? s.gst,
        pan: d.pan ?? s.pan,
        ifsc: d.ifsc ?? s.ifsc,
        bank_account: d.bank_account ?? s.bank_account,
        notes: d.notes ?? (d.items?.length ? d.items.map((i) => `${i.description}${i.amount ? ` — ${i.amount}` : ""}`).join("\n") : s.notes),
      }));
      setAddress((a) => ({
        ...a,
        flat_number: d.flat_number ?? a.flat_number,
        street: d.street ?? a.street,
        city: d.city ?? a.city,
        state: d.state ?? a.state,
        country: d.country ?? a.country,
        pincode: d.pincode ?? a.pincode,
      }));
      toast.success("AI auto-filled fields. Please review.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setExtracting(false);
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      const parsed = vendorSchema.parse({ vendor_type: form.vendor_type, name: form.vendor_type === "company" ? (form.company_name || form.name) : form.name, phone: form.phone });
      const finalTerms = form.payment_terms === "Custom" ? form.customTerms.trim() : form.payment_terms;
      const isCompany = form.vendor_type === "company";
      const payload: any = {
        vendor_type: form.vendor_type,
        name: form.name.trim(),
        company_name: isCompany ? (form.company_name.trim() || null) : null,
        designation: isCompany ? (form.designation.trim() || null) : null,
        phone: parsed.phone,
        whatsapp: form.sameWA ? parsed.phone : (form.whatsapp || null),
        email: form.email || null,
        category: form.work_categories[0] ?? null, // legacy single-cat field
        work_categories: form.work_categories,
        pan: form.pan || null,
        gst: isCompany ? (form.gst || null) : null,
        bank_account: form.bank_account || null,
        ifsc: form.ifsc || null,
        bank_name: form.bank_name || null,
        payment_terms: finalTerms || null,
        notes: form.notes || null,
        flat_number: address.flat_number || null,
        street: address.street || null,
        city: address.city || null,
        state: address.state || null,
        country: address.country || null,
        pincode: address.pincode || null,
        latitude: address.latitude,
        longitude: address.longitude,
      };
      if (editing) {
        const { error } = await supabase.from("vendors").update(payload).eq("id", vendor!.id);
        if (error) throw error;
        return vendor!;
      } else {
        const { data: inserted, error } = await supabase.from("vendors").insert({ user_id: user!.id, rating: 0, ...payload }).select("*").single();
        if (error) throw error;
        return inserted as DbVendor;
      }
    },
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["vendors"] });
      qc.invalidateQueries({ queryKey: ["vendors-full"] });
      toast.success(editing ? "Vendor updated" : "Vendor added");
      if (!editing && created) onCreated?.(created);
      onClose();
    },
    onError: (e) => toast.error(e instanceof z.ZodError ? e.issues[0].message : e instanceof Error ? e.message : "Failed"),
  });

  const isCompany = form.vendor_type === "company";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-card rounded-[16px] shadow-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-border flex items-center justify-between flex-shrink-0">
          <h3 className="font-display text-2xl">{editing ? "Edit Vendor" : "Add Vendor"}</h3>
          <button onClick={onClose} className="h-9 w-9 rounded-[10px] hover:bg-muted flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Type toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-[10px] bg-muted">
            {(["individual","company"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setF("vendor_type", t)}
                className={`h-9 rounded-[8px] text-xs font-medium transition ${form.vendor_type === t ? "bg-card shadow-sm" : "text-muted-foreground"}`}>
                {t === "individual" ? "Individual" : "Company"}
              </button>
            ))}
          </div>

          {!editing && (
            <div className="rounded-[10px] border border-dashed border-[#c17f5a] bg-[#fff7eb] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-[#c17f5a]" />
                <span className="text-sm font-medium">Upload BOQ, Invoice or Quotation</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">AI auto-fills the form.</p>
              <label className="inline-flex items-center gap-2 h-9 px-4 rounded-[6px] bg-white border border-border text-xs font-medium cursor-pointer hover:bg-muted">
                {extracting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {extracting ? "AI reading document..." : "Choose file"}
                <input type="file" hidden accept=".pdf,.xlsx,.xls,.csv,image/*"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileUpload(f); }} />
              </label>
            </div>
          )}

          {isCompany ? (
            <>
              <F label="Company Name" required><input className={ic} value={form.company_name} onChange={(e) => setF("company_name", e.target.value)} /></F>
              <div className="grid grid-cols-2 gap-3">
                <F label="Contact Person"><input className={ic} value={form.name} onChange={(e) => setF("name", e.target.value)} /></F>
                <F label="Designation"><input className={ic} value={form.designation} onChange={(e) => setF("designation", e.target.value)} /></F>
              </div>
            </>
          ) : (
            <F label="Full Name" required><input className={ic} value={form.name} onChange={(e) => setF("name", e.target.value)} /></F>
          )}

          <F label="Mobile Number" required>
            <div className="flex gap-2"><span className="h-10 px-3 rounded-[10px] bg-muted border border-border text-sm flex items-center font-mono">+91</span>
              <input className={ic} value={form.phone} onChange={(e) => setF("phone", e.target.value)} />
            </div>
          </F>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.sameWA} onChange={(e) => setF("sameWA", e.target.checked)} className="accent-[#c17f5a]" />
            WhatsApp same as mobile
          </label>
          {!form.sameWA && <F label="WhatsApp Number"><input className={ic} value={form.whatsapp} onChange={(e) => setF("whatsapp", e.target.value)} /></F>}
          <F label="Email"><input type="email" className={ic} value={form.email} onChange={(e) => setF("email", e.target.value)} /></F>

          <F label="Work Categories (select all that apply)">
            <div className="flex flex-wrap gap-1.5">
              {allCats.map((c) => {
                const on = form.work_categories.includes(c);
                return (
                  <button key={c} type="button" onClick={() => toggleCat(c)}
                    className={`h-7 px-2.5 rounded-full text-[11px] border transition ${on ? "bg-[#c17f5a] text-white border-[#c17f5a]" : "bg-card border-border text-muted-foreground hover:bg-muted"}`}>
                    {on && "✓ "}{c}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex gap-2">
              <input className={ic} value={form.customCat} onChange={(e) => setF("customCat", e.target.value)} placeholder="+ Add custom category…"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomCat(); } }} />
              <button type="button" onClick={addCustomCat} className="h-10 px-3 rounded-[10px] border border-border text-xs whitespace-nowrap hover:bg-muted">Add</button>
            </div>
          </F>

          <div className="grid grid-cols-2 gap-3">
            <F label="PAN Number"><input className={ic} value={form.pan} onChange={(e) => setF("pan", e.target.value.toUpperCase())} maxLength={10} /></F>
            {isCompany && <F label="GST Number"><input className={ic} value={form.gst} onChange={(e) => setF("gst", e.target.value.toUpperCase())} maxLength={15} /></F>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="Bank Account"><input className={ic} value={form.bank_account} onChange={(e) => setF("bank_account", e.target.value)} /></F>
            <F label="IFSC Code"><input className={ic} value={form.ifsc} onChange={(e) => setF("ifsc", e.target.value.toUpperCase())} maxLength={11} /></F>
          </div>
          <F label="Bank Name"><input className={ic} value={form.bank_name} onChange={(e) => setF("bank_name", e.target.value)} /></F>
          <F label="Payment Terms">
            <select className={ic} value={form.payment_terms} onChange={(e) => setF("payment_terms", e.target.value)}>
              {DEFAULT_TERMS.map((t) => <option key={t}>{t}</option>)}
            </select>
            {form.payment_terms === "Custom" && (
              <input className={`${ic} mt-2`} value={form.customTerms} onChange={(e) => setF("customTerms", e.target.value)} placeholder="Type custom terms…" />
            )}
          </F>
          {isCompany && (
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Registered Address</div>
              <AddressFields value={address} onChange={setAddress} />
            </div>
          )}
          <F label="Notes"><textarea rows={3} className={`${ic} h-auto py-2`} value={form.notes} onChange={(e) => setF("notes", e.target.value)} /></F>
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-end gap-2 flex-shrink-0">
          <button onClick={onClose} className="h-10 px-4 rounded-[6px] border border-border text-sm font-medium hover:bg-muted">Cancel</button>
          <button onClick={() => save.mutate()} disabled={save.isPending} className="h-10 px-5 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95 inline-flex items-center gap-2 disabled:opacity-60">
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing ? "Save Changes" : "Save Vendor"}
          </button>
        </div>
      </div>
    </div>
  );
}

function F({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return <label className="block"><span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}{required && <span className="text-[#c17f5a] ml-1">*</span>}</span><div className="mt-1.5">{children}</div></label>;
}
const ic = "w-full h-10 px-3 rounded-[10px] bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring/30";

