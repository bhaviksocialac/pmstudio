import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Loader2, Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

type Snag = {
  id: string;
  description: string;
  photo_url: string | null;
  contractor_name: string | null;
  deadline: string | null;
  status: "open" | "in_progress" | "resolved";
};

const STATUS_ORDER: Record<string, number> = { open: 0, in_progress: 1, resolved: 2 };
const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  open: { bg: "rgba(196,104,90,0.15)", color: "#c4685a", label: "Open" },
  in_progress: { bg: "rgba(193,127,90,0.18)", color: "#c17f5a", label: "In Progress" },
  resolved: { bg: "rgba(122,158,138,0.20)", color: "#3d6f5a", label: "Resolved" },
};

export function SnagsTab({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);

  const { data: snags = [], isLoading } = useQuery({
    queryKey: ["snags", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("snags").select("*").eq("project_id", projectId);
      if (error) throw error;
      const sorted = (data ?? []).slice().sort((a: any, b: any) => {
        const s = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        if (s !== 0) return s;
        return (a.deadline ?? "").localeCompare(b.deadline ?? "");
      });
      return sorted as Snag[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Snag["status"] }) => {
      const patch: any = { status };
      if (status === "resolved") patch.resolved_at = new Date().toISOString();
      const { error } = await supabase.from("snags").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["snags", projectId] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("snags").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["snags", projectId] }),
  });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl">Snag List</h2>
          <p className="text-xs text-muted-foreground">{snags.length} item{snags.length === 1 ? "" : "s"}</p>
        </div>
        <button onClick={() => setAdding(true)} className="h-10 px-4 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95 inline-flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add Snag
        </button>
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}

      {!isLoading && snags.length === 0 && (
        <div className="rounded-[10px] border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No snags. Add one to start tracking site issues.
        </div>
      )}

      <div className="space-y-2">
        {snags.map((s) => {
          const overdue = s.status !== "resolved" && s.deadline && s.deadline <= today;
          const st = STATUS_STYLE[s.status];
          return (
            <div key={s.id} className={`rounded-[10px] border p-4 flex items-start gap-3 ${overdue ? "border-[#c4685a] bg-[#fdf3f1]" : "border-border bg-card"}`}>
              {s.photo_url ? (
                <a href={s.photo_url} target="_blank" rel="noreferrer" className="h-16 w-16 rounded-[6px] bg-muted bg-cover bg-center flex-shrink-0"
                  style={{ backgroundImage: `url(${s.photo_url})` }} />
              ) : (
                <div className="h-16 w-16 rounded-[6px] bg-muted flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{s.description}</div>
                <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                  {s.contractor_name && <span>👤 {s.contractor_name}</span>}
                  {s.deadline && <span className={overdue ? "text-[#c4685a] font-medium" : ""}>📅 {s.deadline}{overdue ? " · overdue" : ""}</span>}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <select
                  value={s.status}
                  onChange={(e) => updateStatus.mutate({ id: s.id, status: e.target.value as Snag["status"] })}
                  className="h-8 px-2 rounded-[6px] text-[11px] font-medium border-0"
                  style={{ background: st.bg, color: st.color }}
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
                <button onClick={() => remove.mutate(s.id)} className="text-[#c4685a] hover:opacity-70">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {adding && <AddSnagModal projectId={projectId} onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddSnagModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [description, setDescription] = useState("");
  const [contractor, setContractor] = useState("");
  const [deadline, setDeadline] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
      let photo_url: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${user!.id}/${projectId}/snags/${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("project-photos").upload(path, file);
        if (!error) {
          const { data } = supabase.storage.from("project-photos").getPublicUrl(path);
          photo_url = data.publicUrl;
        }
      }
      const { error } = await supabase.from("snags").insert({
        user_id: user!.id,
        project_id: projectId,
        description,
        contractor_name: contractor || null,
        deadline: deadline || null,
        photo_url,
        status: "open",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["snags", projectId] });
      toast.success("Snag added");
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-card rounded-t-[20px] sm:rounded-[16px] w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-display text-2xl">Add Snag</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Description</span>
            <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={ic + " py-2 h-auto"} placeholder="What's the issue?" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Contractor</span>
              <input value={contractor} onChange={(e) => setContractor(e.target.value)} className={ic} placeholder="Assigned to" />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Deadline</span>
              <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={ic} />
            </label>
          </div>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Photo</span>
            <div className="mt-1">
              <label className="h-10 px-3 rounded-[6px] border border-dashed border-border inline-flex items-center gap-1.5 text-xs cursor-pointer hover:bg-muted">
                <Upload className="h-3.5 w-3.5" /> {file ? file.name.slice(0, 20) : "Choose photo"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>
          </label>
        </div>
        <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="h-10 px-4 rounded-[6px] border border-border text-sm font-medium hover:bg-muted">Cancel</button>
          <button onClick={() => submit.mutate()} disabled={!description.trim() || submit.isPending}
            className="h-10 px-5 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95 inline-flex items-center gap-2 disabled:opacity-60">
            {submit.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Snag
          </button>
        </div>
      </div>
    </div>
  );
}

const ic = "w-full h-10 px-3 rounded-[10px] bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 mt-1";
