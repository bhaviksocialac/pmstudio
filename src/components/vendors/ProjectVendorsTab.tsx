import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, MessageCircle, ExternalLink, Pencil, Trash2, Loader2, Phone } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatINR } from "@/lib/studio-data";
import type { DbVendor } from "@/lib/db-types";
import { VendorAutocomplete } from "@/components/VendorAutocomplete";
import { VendorModal } from "@/routes/_authenticated/vendors";

type ProjectVendorRow = {
  id: string;
  project_id: string;
  vendor_id: string;
  scope: string | null;
  po_amount: number;
  expected_delivery: string | null;
  status: string;
  notes: string | null;
};

type Joined = ProjectVendorRow & { vendor: DbVendor | null };

const STATUS = {
  pending: { bg: "rgba(212,136,42,0.18)", color: "#d4882a", label: "Pending" },
  confirmed: { bg: "rgba(122,158,138,0.18)", color: "#7a9e8a", label: "Confirmed" },
  delayed: { bg: "rgba(196,104,90,0.18)", color: "#c4685a", label: "Delayed" },
  completed: { bg: "rgba(122,158,138,0.18)", color: "#7a9e8a", label: "Delivered" },
} as const;

export function ProjectVendorsTab({ projectId }: { projectId: string }) {
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState<Joined | null>(null);
  const qc = useQueryClient();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["project_vendors", projectId],
    queryFn: async () => {
      const { data: links, error } = await supabase
        .from("project_vendors")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = (links ?? []).map((l) => l.vendor_id);
      const { data: vendors } = ids.length
        ? await supabase.from("vendors").select("*").in("id", ids)
        : { data: [] as DbVendor[] };
      const map = new Map((vendors ?? []).map((v) => [v.id, v as DbVendor]));
      return (links ?? []).map((l) => ({ ...l, vendor: map.get(l.vendor_id) ?? null })) as Joined[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_vendors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project_vendors", projectId] });
      toast.success("Vendor removed from project");
    },
  });

  return (
    <div className="rounded-[16px] bg-card border border-border overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl">Project Vendors</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Linked from your master vendor list</p>
        </div>
        <button
          onClick={() => setPicking(true)}
          className="h-9 px-3 rounded-[6px] bg-primary text-primary-foreground text-xs font-medium hover:brightness-95 inline-flex items-center gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" /> Add Vendor
        </button>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="h-40 animate-pulse bg-muted rounded-[10px]" />
        ) : rows.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground mb-4">No vendors added to this project yet.</p>
            <button
              onClick={() => setPicking(true)}
              className="h-10 px-5 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium"
            >
              + Add Vendor
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rows.map((r) => {
              const s = STATUS[r.status as keyof typeof STATUS] ?? STATUS.pending;
              const v = r.vendor;
              return (
                <article key={r.id} className="rounded-[12px] border border-border p-4 bg-background">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {v?.category && (
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-[6px] mb-1 inline-block"
                          style={{ background: "rgba(193,127,90,0.15)", color: "#c17f5a" }}>{v.category}</span>
                      )}
                      <h3 className="font-display text-lg leading-tight">{v?.company_name || v?.name || "Vendor"}</h3>
                      {v?.phone && <div className="text-xs text-muted-foreground font-mono mt-0.5 flex items-center gap-1.5"><Phone className="h-3 w-3" />{v.phone}</div>}
                    </div>
                    <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-[6px]" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div><div className="text-muted-foreground text-[10px] uppercase">Scope</div><div>{r.scope || "—"}</div></div>
                    <div><div className="text-muted-foreground text-[10px] uppercase">PO Amount</div><div className="font-mono">{formatINR(Number(r.po_amount))}</div></div>
                    <div><div className="text-muted-foreground text-[10px] uppercase">Expected Delivery</div><div className="font-mono">{r.expected_delivery ?? "—"}</div></div>
                  </div>
                  <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                    {v?.whatsapp || v?.phone ? (
                      <a href={`https://wa.me/${(v.whatsapp || v.phone || "").replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                        className="h-8 px-2.5 rounded-[6px] border border-border text-[11px] hover:bg-muted inline-flex items-center gap-1 text-[#25D366]">
                        <MessageCircle className="h-3 w-3" /> WhatsApp
                      </a>
                    ) : null}
                    <Link to="/vendors" className="h-8 px-2.5 rounded-[6px] border border-border text-[11px] hover:bg-muted inline-flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" /> View Profile
                    </Link>
                    <button onClick={() => setEditing(r)} className="h-8 px-2.5 rounded-[6px] border border-border text-[11px] hover:bg-muted inline-flex items-center gap-1">
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                    <button onClick={() => del.mutate(r.id)} className="h-8 px-2.5 rounded-[6px] border border-border text-[11px] hover:bg-[#fff0ee] text-[#c4685a] inline-flex items-center gap-1">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {picking && (
        <VendorPickerOverlay
          projectId={projectId}
          existingVendorIds={rows.map((r) => r.vendor_id)}
          onClose={() => setPicking(false)}
          onLinked={() => qc.invalidateQueries({ queryKey: ["project_vendors", projectId] })}
        />
      )}
      {editing && (
        <ProjectVendorDetailsModal
          mode="edit"
          row={editing}
          vendor={editing.vendor}
          projectId={projectId}
          onClose={() => setEditing(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["project_vendors", projectId] })}
        />
      )}
    </div>
  );
}

function VendorPickerOverlay({
  projectId, existingVendorIds, onClose, onLinked,
}: { projectId: string; existingVendorIds: string[]; onClose: () => void; onLinked: () => void }) {
  const [selected, setSelected] = useState<DbVendor | null>(null);
  const [creatingName, setCreatingName] = useState<string | null>(null);

  if (selected) {
    return (
      <ProjectVendorDetailsModal
        mode="create"
        vendor={selected}
        projectId={projectId}
        onClose={onClose}
        onSaved={() => { onLinked(); onClose(); }}
      />
    );
  }

  if (creatingName !== null) {
    return (
      <VendorModal
        initialName={creatingName}
        onClose={() => setCreatingName(null)}
        onCreated={(v) => { setCreatingName(null); setSelected(v); }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-card rounded-[16px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-display text-xl">Add Vendor to Project</h3>
          <button onClick={onClose} className="h-9 w-9 rounded-[10px] hover:bg-muted flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-6 space-y-3">
          <p className="text-xs text-muted-foreground">Search your master vendor list. Pick one to link it to this project.</p>
          <VendorAutocomplete
            excludeIds={existingVendorIds}
            onSelect={(v) => setSelected(v)}
            onCreateNew={(name) => setCreatingName(name)}
            placeholder="Search vendor by name or company…"
          />
          <div className="pt-2 border-t border-border">
            <button
              onClick={() => setCreatingName("")}
              className="w-full h-10 rounded-[8px] border border-dashed border-border text-xs font-medium hover:bg-muted inline-flex items-center justify-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> Add New Vendor to Master List
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectVendorDetailsModal({
  mode, row, vendor, projectId, onClose, onSaved,
}: {
  mode: "create" | "edit";
  row?: Joined;
  vendor: DbVendor | null;
  projectId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [scope, setScope] = useState(row?.scope ?? "");
  const [amount, setAmount] = useState(String(row?.po_amount ?? ""));
  const [delivery, setDelivery] = useState(row?.expected_delivery ?? "");
  const [status, setStatus] = useState(row?.status ?? "pending");
  const [notes, setNotes] = useState(row?.notes ?? "");

  const save = useMutation({
    mutationFn: async () => {
      if (!user || !vendor) throw new Error("Missing user/vendor");
      const payload = {
        scope: scope.trim() || null,
        po_amount: Number(amount) || 0,
        expected_delivery: delivery || null,
        status,
        notes: notes.trim() || null,
      };
      if (mode === "edit" && row) {
        const { error } = await supabase.from("project_vendors").update(payload).eq("id", row.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("project_vendors").insert({
          user_id: user.id, project_id: projectId, vendor_id: vendor.id, ...payload,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(mode === "edit" ? "Updated" : "Vendor linked to project"); onSaved(); onClose(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card rounded-[16px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{mode === "edit" ? "Edit Project Details" : "Project Details"}</div>
            <h3 className="font-display text-xl">{vendor?.company_name || vendor?.name}</h3>
          </div>
          <button onClick={onClose} className="h-9 w-9 rounded-[10px] hover:bg-muted flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-6 space-y-3">
          <Field label="Scope of Work for this Project">
            <textarea value={scope} onChange={(e) => setScope(e.target.value)} rows={3}
              className="w-full px-3 py-2 rounded-[8px] bg-card border border-border text-sm" placeholder="e.g. Master bedroom flooring + skirting" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="PO Amount (₹)">
              <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                className="w-full h-10 px-3 rounded-[8px] bg-card border border-border text-sm font-mono" placeholder="0" />
            </Field>
            <Field label="Expected Delivery">
              <input type="date" value={delivery} onChange={(e) => setDelivery(e.target.value)}
                className="w-full h-10 px-3 rounded-[8px] bg-card border border-border text-sm" />
            </Field>
          </div>
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value)}
              className="w-full h-10 px-3 rounded-[8px] bg-card border border-border text-sm">
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="delayed">Delayed</option>
              <option value="completed">Delivered</option>
            </select>
          </Field>
          <Field label="Notes">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full px-3 py-2 rounded-[8px] bg-card border border-border text-sm" />
          </Field>
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="h-10 px-4 rounded-[6px] border border-border text-sm">Cancel</button>
          <button onClick={() => save.mutate()} disabled={save.isPending}
            className="h-10 px-5 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium inline-flex items-center gap-2 disabled:opacity-60">
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {mode === "edit" ? "Save Changes" : "Add to Project"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}
