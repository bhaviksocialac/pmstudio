import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

const STATUS_OPTIONS = [
  { value: "planned", label: "Not Started" },
  { value: "active", label: "In Progress" },
  { value: "done", label: "Completed" },
];

export function EditPhaseModal({
  projectId,
  phase,
  onClose,
}: {
  projectId: string;
  phase: string;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [status, setStatus] = useState("planned");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [completion, setCompletion] = useState(0);
  const [notes, setNotes] = useState("");

  const { data: row, isLoading } = useQuery({
    queryKey: ["phase-row", projectId, phase],
    queryFn: async () => {
      const { data } = await supabase.from("project_phases").select("*").eq("project_id", projectId).eq("phase", phase as any).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (row) {
      setStatus((row as any).status ?? "planned");
      setStartDate((row as any).start_date ?? "");
      setEndDate((row as any).end_date ?? "");
      setCompletion((row as any).completion ?? 0);
      setNotes((row as any).notes ?? "");
    }
  }, [row]);

  const save = useMutation({
    mutationFn: async () => {
      const patch: any = { status, start_date: startDate || null, end_date: endDate || null, completion, notes: notes || null };
      if (row) {
        const { error } = await supabase.from("project_phases").update(patch).eq("project_id", projectId).eq("phase", phase as any);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("project_phases").insert({
          user_id: user!.id, project_id: projectId, phase: phase as any, order_index: 0, ...patch,
        });
        if (error) throw error;
      }
      if (status === "active") {
        await supabase.from("projects").update({ phase: phase as any }).eq("id", projectId);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["project-phases", projectId] });
      qc.invalidateQueries({ queryKey: ["phase-row", projectId, phase] });
      toast.success("Phase updated");
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card rounded-[16px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <h3 className="font-display text-2xl">Edit {phase}</h3>
          <button onClick={onClose} className="h-9 w-9 rounded-[10px] hover:bg-muted flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        {isLoading ? (
          <div className="p-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="p-6 space-y-4">
            <L label="Status">
              <select className={ic} value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </L>
            <div className="grid grid-cols-2 gap-3">
              <L label="Start date"><input type="date" className={ic} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></L>
              <L label="End date"><input type="date" className={ic} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></L>
            </div>
            <L label={`Completion: ${completion}%`}>
              <input type="range" min={0} max={100} value={completion} onChange={(e) => setCompletion(Number(e.target.value))} className="w-full accent-[#c17f5a]" />
            </L>
            <L label="Notes"><textarea rows={3} className={`${ic} h-auto py-2`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What's happening in this phase…" /></L>
          </div>
        )}
        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="h-10 px-4 rounded-[6px] border border-border text-sm font-medium hover:bg-muted">Cancel</button>
          <button onClick={() => save.mutate()} disabled={save.isPending} className="h-10 px-5 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95 inline-flex items-center gap-2 disabled:opacity-60">
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save
          </button>
        </div>
      </div>
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</span><div className="mt-1.5">{children}</div></label>;
}
const ic = "w-full h-10 px-3 rounded-[10px] bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring/30";
