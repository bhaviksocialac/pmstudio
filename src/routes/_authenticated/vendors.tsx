import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Search, Plus, X, Loader2, Star, Phone } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { DbVendor } from "@/lib/db-types";

export const Route = createFileRoute("/_authenticated/vendors")({
  head: () => ({ meta: [{ title: "Vendors — PMStudio" }, { name: "description", content: "All vendors with categories and contact details." }] }),
  component: VendorsPage,
});

function VendorsPage() {
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vendors").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DbVendor[];
    },
  });
  const filtered = vendors.filter((v) => v.name.toLowerCase().includes(q.toLowerCase()));

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
                  <div className="min-w-0">
                    {v.category && (
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-[6px] mb-1 inline-block" style={{ background: "rgba(193,127,90,0.15)", color: "#c17f5a" }}>{v.category}</span>
                    )}
                    <h3 className="font-display text-2xl leading-tight">{v.name}</h3>
                    {v.phone && (
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground font-mono">
                        <Phone className="h-3 w-3" /> {v.phone}
                      </div>
                    )}
                  </div>
                  <div className="flex">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5" fill={i < (v.rating ?? 0) ? "#d4882a" : "transparent"} color={i < (v.rating ?? 0) ? "#d4882a" : "#c9c1b6"} />
                    ))}
                  </div>
                </div>
                {v.payment_terms && (
                  <div className="mt-4 text-xs text-muted-foreground">Terms: <span className="text-foreground">{v.payment_terms}</span></div>
                )}
                {v.notes && <p className="mt-3 text-xs text-muted-foreground">{v.notes}</p>}
              </article>
            ))}
          </section>
        )}
      </main>
      {adding && <AddVendorModal onClose={() => setAdding(false)} />}
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
  name: z.string().trim().min(1, "Name is required").max(120),
  category: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().email("Invalid email").max(255).optional().or(z.literal("")),
  rating: z.coerce.number().min(0).max(5).optional(),
  payment_terms: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(2000).optional(),
});

function AddVendorModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", category: "Tiles", phone: "", email: "", rating: "4", payment_terms: "30 days", notes: "" });

  const save = useMutation({
    mutationFn: async () => {
      const parsed = vendorSchema.parse(form);
      const { error } = await supabase.from("vendors").insert({
        user_id: user!.id,
        name: parsed.name,
        category: parsed.category || null,
        phone: parsed.phone || null,
        email: parsed.email || null,
        rating: parsed.rating ?? 0,
        payment_terms: parsed.payment_terms || null,
        notes: parsed.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendors"] });
      toast.success("Vendor added");
      onClose();
    },
    onError: (e) => toast.error(e instanceof z.ZodError ? e.issues[0].message : e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card rounded-[16px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <h3 className="font-display text-2xl">Add Vendor</h3>
          <button onClick={onClose} className="h-9 w-9 rounded-[10px] hover:bg-muted flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <F label="Vendor Name" required><input className={ic} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></F>
          <F label="Category">
            <select className={ic} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {["Tiles", "Flooring", "Electrical", "Plumbing", "Painting", "Furniture", "Lighting", "Hardware", "Carpentry", "Other"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </F>
          <F label="Phone"><input className={ic} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" /></F>
          <F label="Email"><input type="email" className={ic} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></F>
          <div className="grid grid-cols-2 gap-3">
            <F label="Rating (0-5)"><input type="number" min={0} max={5} className={ic} value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} /></F>
            <F label="Payment Terms">
              <select className={ic} value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}>
                <option>Advance 50%</option><option>On delivery</option><option>30 days</option><option>60 days</option>
              </select>
            </F>
          </div>
          <F label="Notes"><textarea rows={2} className={`${ic} h-auto py-2`} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></F>
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="h-10 px-4 rounded-[6px] border border-border text-sm font-medium hover:bg-muted">Cancel</button>
          <button onClick={() => save.mutate()} disabled={save.isPending} className="h-10 px-5 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95 inline-flex items-center gap-2 disabled:opacity-60">
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Vendor
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
