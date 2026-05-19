import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Search, Plus, X, Loader2, Pencil, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { DbClient } from "@/lib/db-types";

export const Route = createFileRoute("/_authenticated/clients")({
  head: () => ({ meta: [{ title: "Clients — PMStudio" }, { name: "description", content: "Track every client and their project status." }] }),
  component: ClientsPage,
});

function ClientsPage() {
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<DbClient | null>(null);
  const [deleting, setDeleting] = useState<DbClient | null>(null);
  const qc = useQueryClient();

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DbClient[];
    },
  });
  const filtered = clients.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Client deleted");
      setDeleting(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <AppShell>
      <main className="px-4 md:px-8 py-8 md:py-10 max-w-[1400px] w-full pb-24 md:pb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-3">People</div>
            <h1 className="font-display text-4xl md:text-5xl">Clients</h1>
            <p className="text-muted-foreground mt-2">{clients.length} client{clients.length === 1 ? "" : "s"} in your book</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clients…" className="h-10 pl-10 pr-3 rounded-[10px] bg-card border border-border text-sm w-56 focus:outline-none focus:ring-2 focus:ring-ring/30" />
            </div>
            <button onClick={() => setAdding(true)} className="h-10 px-4 inline-flex items-center gap-2 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95">
              <Plus className="h-4 w-4" /> Add Client
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-[16px] bg-card border border-border h-64 animate-pulse" />
        ) : filtered.length === 0 ? (
          <Empty onAdd={() => setAdding(true)} />
        ) : (
          <section className="rounded-[16px] bg-card border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <tr>{["Client", "Phone", "Email", "Address", ""].map((h) => <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((c) => {
                  const initials = c.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
                  return (
                    <tr key={c.id} className="hover:bg-muted/40">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="h-8 w-8 rounded-full bg-[#c17f5a] text-white text-[10px] font-medium flex items-center justify-center">{initials}</span>
                          <span className="font-medium">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{c.phone || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{c.email || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs truncate max-w-xs">{c.address || "—"}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => setEditing(c)} className="h-8 px-2.5 rounded-[6px] border border-border text-xs hover:bg-muted inline-flex items-center gap-1 mr-1">
                          <Pencil className="h-3 w-3" /> Edit
                        </button>
                        <button onClick={() => setDeleting(c)} className="h-8 px-2.5 rounded-[6px] border border-border text-xs text-[#c4685a] hover:bg-[#fff0ee] inline-flex items-center gap-1">
                          <Trash2 className="h-3 w-3" /> Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}
      </main>
      {adding && <ClientModal onClose={() => setAdding(false)} />}
      {editing && <ClientModal client={editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDeleting(null)}>
          <div className="w-full max-w-sm bg-card rounded-[16px] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-2xl mb-2">Delete {deleting.name}?</h3>
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
      <h3 className="font-display text-2xl">No clients yet</h3>
      <p className="text-muted-foreground mt-2 mb-6">Add your first client to start tracking relationships.</p>
      <button onClick={onAdd} className="h-10 px-5 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95">+ Add Client</button>
    </div>
  );
}

const clientSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().email("Invalid email").max(255).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(2000).optional(),
});

function ClientModal({ onClose, client }: { onClose: () => void; client?: DbClient }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const editing = !!client;
  const [form, setForm] = useState({
    name: client?.name ?? "",
    phone: client?.phone ?? "",
    email: client?.email ?? "",
    address: client?.address ?? "",
    notes: client?.notes ?? "",
  });

  const save = useMutation({
    mutationFn: async () => {
      const parsed = clientSchema.parse(form);
      const payload = {
        name: parsed.name,
        phone: parsed.phone || null,
        email: parsed.email || null,
        address: parsed.address || null,
        notes: parsed.notes || null,
      };
      if (editing) {
        const { error } = await supabase.from("clients").update(payload).eq("id", client!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clients").insert({ user_id: user!.id, ...payload });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success(editing ? "Client updated" : "Client added");
      onClose();
    },
    onError: (e) => toast.error(e instanceof z.ZodError ? e.issues[0].message : e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card rounded-[16px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <h3 className="font-display text-2xl">{editing ? "Edit Client" : "Add Client"}</h3>
          <button onClick={onClose} className="h-9 w-9 rounded-[10px] hover:bg-muted flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <F label="Full Name" required><input className={ic} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></F>
          <F label="Phone"><input className={ic} value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" /></F>
          <F label="Email"><input type="email" className={ic} value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></F>
          <F label="Address"><textarea rows={2} className={`${ic} h-auto py-2`} value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></F>
          <F label="Notes"><textarea rows={2} className={`${ic} h-auto py-2`} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></F>
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="h-10 px-4 rounded-[6px] border border-border text-sm font-medium hover:bg-muted">Cancel</button>
          <button onClick={() => save.mutate()} disabled={save.isPending} className="h-10 px-5 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95 inline-flex items-center gap-2 disabled:opacity-60">
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing ? "Save Changes" : "Save Client"}
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
