import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Loader2, Send, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

type CO = {
  id: string;
  description: string;
  reason: string | null;
  additional_cost: number;
  status: "draft" | "pending_client" | "approved" | "rejected" | "active";
  requested_at: string | null;
  decided_at: string | null;
  client_note: string | null;
};

const STATUS_STYLE: Record<CO["status"], { bg: string; color: string; label: string }> = {
  draft: { bg: "rgba(107,95,88,0.12)", color: "#6b5f58", label: "Draft" },
  pending_client: { bg: "rgba(212,136,42,0.18)", color: "#d4882a", label: "Pending Client" },
  approved: { bg: "rgba(122,158,138,0.20)", color: "#3d6f5a", label: "Approved" },
  rejected: { bg: "rgba(196,104,90,0.18)", color: "#c4685a", label: "Rejected" },
  active: { bg: "rgba(122,158,138,0.20)", color: "#3d6f5a", label: "Active" },
};

export function ChangeOrdersTab({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["change-orders", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("change_orders").select("*").eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CO[];
    },
  });

  const requestApproval = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("change_orders")
        .update({ status: "pending_client", requested_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["change-orders", projectId] });
      toast.success("Sent to client portal for approval");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const markActive = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("change_orders").update({ status: "active" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["change-orders", projectId] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("change_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["change-orders", projectId] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl">Change Orders</h2>
          <p className="text-xs text-muted-foreground">{orders.length} order{orders.length === 1 ? "" : "s"}</p>
        </div>
        <button onClick={() => setAdding(true)} className="h-10 px-4 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95 inline-flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5" /> New Change Order
        </button>
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {!isLoading && orders.length === 0 && (
        <div className="rounded-[10px] border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No change orders yet.
        </div>
      )}

      <div className="space-y-2">
        {orders.map((o) => {
          const st = STATUS_STYLE[o.status];
          return (
            <div key={o.id} className="rounded-[10px] border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{o.description}</div>
                  {o.reason && <div className="text-xs text-muted-foreground mt-0.5">Reason: {o.reason}</div>}
                </div>
                <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-[6px] whitespace-nowrap"
                  style={{ background: st.bg, color: st.color }}>{st.label}</span>
              </div>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="font-mono text-sm">+ ₹{(Number(o.additional_cost) / 100000).toFixed(2)}L</div>
                <div className="flex gap-2">
                  {o.status === "draft" && (
                    <button onClick={() => requestApproval.mutate(o.id)}
                      className="h-8 px-3 rounded-[6px] bg-[#c17f5a] text-white text-xs font-medium hover:brightness-110 inline-flex items-center gap-1.5">
                      <Send className="h-3 w-3" /> Request Approval
                    </button>
                  )}
                  {o.status === "approved" && (
                    <button onClick={() => markActive.mutate(o.id)}
                      className="h-8 px-3 rounded-[6px] bg-[#7a9e8a] text-white text-xs font-medium hover:brightness-110 inline-flex items-center gap-1.5">
                      <Check className="h-3 w-3" /> Mark Active
                    </button>
                  )}
                  <button onClick={() => remove.mutate(o.id)} className="h-8 w-8 rounded-[6px] border border-border flex items-center justify-center text-[#c4685a] hover:bg-muted">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {o.client_note && (
                <div className="mt-2 text-xs text-muted-foreground italic border-t border-border pt-2">Client note: {o.client_note}</div>
              )}
            </div>
          );
        })}
      </div>

      {adding && <AddChangeOrderModal projectId={projectId} onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddChangeOrderModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [description, setDescription] = useState("");
  const [reason, setReason] = useState("");
  const [cost, setCost] = useState<number>(0);

  const submit = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("change_orders").insert({
        user_id: user!.id,
        project_id: projectId,
        description,
        reason: reason || null,
        additional_cost: cost,
        status: "draft",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["change-orders", projectId] });
      toast.success("Change order saved as draft");
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-card rounded-t-[20px] sm:rounded-[16px] w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-display text-2xl">New Change Order</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Description of change</span>
            <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={ic + " py-2 h-auto"} placeholder="e.g. Add wardrobe in guest bedroom" />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Reason</span>
            <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className={ic + " py-2 h-auto"} placeholder="Why is this change needed?" />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Additional cost (₹)</span>
            <input type="number" min={0} value={cost} onChange={(e) => setCost(+e.target.value)} className={ic} />
          </label>
        </div>
        <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="h-10 px-4 rounded-[6px] border border-border text-sm font-medium hover:bg-muted">Cancel</button>
          <button onClick={() => submit.mutate()} disabled={!description.trim() || submit.isPending}
            className="h-10 px-5 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95 inline-flex items-center gap-2 disabled:opacity-60">
            {submit.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Draft
          </button>
        </div>
      </div>
    </div>
  );
}

const ic = "w-full h-10 px-3 rounded-[10px] bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 mt-1";
