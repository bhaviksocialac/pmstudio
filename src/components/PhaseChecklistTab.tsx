import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, ChevronDown, ChevronRight, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { sendInvoiceEmail, sendMilestoneEmail } from "@/lib/emails.functions";
import {
  computeRollup, EXECUTION_PHASE_GROUPS, type GroupRollup, type TaskLite,
} from "@/lib/phase-sync";

const BUDGET_PCT: Record<string, number> = {
  "Civil Work": 15, "Electrical Work": 10, "Plumbing Work": 10,
  "Flooring Work": 20, "Painting Work": 8, "Furniture Installation": 12,
};

export function PhaseChecklistTab({ projectId, projectBudget }: { projectId: string; projectBudget: number }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Set<string>>(new Set(EXECUTION_PHASE_GROUPS));
  const [confirming, setConfirming] = useState<{ name: string; amount: number } | null>(null);

  // Pull live tasks → source of truth.
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["project-tasks-rollup", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id,status,done,work_type,work_types,areas,area,room,completion_pct,notes")
        .eq("project_id", projectId);
      if (error) throw error;
      return (data ?? []) as TaskLite[];
    },
  });

  // Track sign-offs via phase_subcategories (one row per phase group).
  const { data: signoffs = [] } = useQuery({
    queryKey: ["phase-signoffs", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("phase_subcategories")
        .select("id,name,signed_off_at")
        .eq("project_id", projectId)
        .eq("phase", "Execution");
      return (data ?? []) as { id: string; name: string; signed_off_at: string | null }[];
    },
  });

  const rollups = useMemo<GroupRollup[]>(() => computeRollup(tasks), [tasks]);

  const sendInvoiceEmailFn = useServerFn(sendInvoiceEmail);
  const sendMilestoneEmailFn = useServerFn(sendMilestoneEmail);

  const signOff = useMutation({
    mutationFn: async ({ name, amount }: { name: string; amount: number }) => {
      // Upsert phase_subcategories row marking sign-off
      const existing = signoffs.find((s) => s.name === name);
      const today = new Date().toISOString();
      if (existing) {
        await supabase.from("phase_subcategories")
          .update({ signed_off_at: today, status: "done", end_date: today.slice(0, 10) })
          .eq("id", existing.id);
      } else {
        await supabase.from("phase_subcategories").insert({
          user_id: user!.id, project_id: projectId, phase: "Execution",
          name, status: "done", signed_off_at: today, end_date: today.slice(0, 10),
          order_index: EXECUTION_PHASE_GROUPS.indexOf(name as never),
        });
      }
      await supabase.from("invoices").insert({
        user_id: user!.id, project_id: projectId, amount,
        milestone: `${name} complete`, status: "draft",
      });
      return { name, amount };
    },
    onSuccess: ({ name, amount }) => {
      qc.invalidateQueries({ queryKey: ["phase-signoffs", projectId] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast.success(`${name} signed off. Invoice draft for ₹${(amount / 100000).toFixed(2)}L.`);
      setConfirming(null);
      const milestone = `${name} complete`;
      sendMilestoneEmailFn({ data: { projectId, milestone } }).catch(() => {});
      sendInvoiceEmailFn({ data: { projectId, milestone, amount } }).catch(() => {});
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const togglePhase = (g: string) => setExpanded((s) => {
    const n = new Set(s);
    if (n.has(g)) n.delete(g); else n.add(g);
    return n;
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        All phases run in parallel. Progress is auto-calculated from tasks — every AI bar entry flows through here.
      </div>

      {rollups.map((r) => {
        const signed = signoffs.find((s) => s.name === r.group)?.signed_off_at;
        const open = expanded.has(r.group);
        const amount = Math.round(projectBudget * 100000 * ((BUDGET_PCT[r.group] ?? 10) / 100));
        const canSign = !signed && r.total > 0 && r.pct === 100;
        return (
          <div key={r.group} className={`rounded-[10px] border ${signed ? "border-[#7a9e8a] bg-[#f3f8f5]" : "border-border bg-card"} overflow-hidden`}>
            <button
              onClick={() => togglePhase(r.group)}
              className="w-full px-4 py-3 flex items-center gap-3 text-left"
            >
              <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-mono ${signed ? "bg-[#7a9e8a] text-white" : r.pct === 100 ? "bg-[#7a9e8a] text-white" : r.pct > 0 ? "bg-[#c17f5a] text-white" : "bg-muted text-muted-foreground"}`}>
                {signed ? <Check className="h-3 w-3" /> : `${r.pct}%`}
              </span>
              <span className="font-medium text-sm flex-1">{r.group}</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                {r.done}/{r.total} · ₹{(amount / 100000).toFixed(1)}L
              </span>
              {signed && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-[4px] bg-[#7a9e8a]/20 text-[#3d6f5a]">Signed Off</span>}
              {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </button>

            {/* Progress bar */}
            <div className="px-4 pb-2">
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full transition-all" style={{
                  width: `${r.pct}%`,
                  background: r.pct === 100 ? "#7a9e8a" : "#c17f5a",
                }} />
              </div>
            </div>

            {open && (
              <div className="px-4 pb-4 pt-1 border-t border-border space-y-4">
                {r.workTypes.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-2">
                    No tasks for {r.group} yet. Use the AI bar in Tasks to log work — it will appear here automatically.
                  </p>
                ) : (
                  r.workTypes.map((wt) => (
                    <div key={wt.workType}>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium">{wt.workType}</h4>
                        <span className="text-[11px] font-mono text-muted-foreground">{wt.done}/{wt.total} · {wt.pct}%</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {wt.rooms.map((rm) => (
                          <div key={rm.room} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-[6px] text-xs ${
                            rm.status === "done" ? "bg-[#7a9e8a]/15 text-[#3d6f5a]"
                            : rm.status === "wip" ? "bg-[#d4882a]/15 text-[#8a5a1a]"
                            : "bg-muted text-muted-foreground"
                          }`}>
                            {rm.status === "done" ? <Check className="h-3 w-3 shrink-0" /> : <span className="h-2 w-2 rounded-full shrink-0" style={{ background: rm.status === "wip" ? "#d4882a" : "#c4b8a6" }} />}
                            <span className="flex-1 truncate">{rm.room}</span>
                            <span className="font-mono text-[10px] opacity-70">{rm.pct}%</span>
                            {rm.note && <span className="text-[10px] italic truncate max-w-[120px]" title={rm.note}>· {rm.note}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}

                {!signed && (
                  <div className="pt-2 border-t border-border">
                    <button
                      onClick={() => setConfirming({ name: r.group, amount })}
                      disabled={!canSign}
                      className="h-9 px-4 rounded-[6px] bg-[#7a9e8a] text-white text-xs font-medium hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                    >
                      <Check className="h-3.5 w-3.5" /> Sign Off {r.group}
                    </button>
                    {!canSign && r.blocker && (
                      <span className="ml-3 inline-flex items-center gap-1 text-[11px] text-[#8a5a1a]">
                        <AlertCircle className="h-3 w-3" /> {r.blocker}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {confirming && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setConfirming(null)}>
          <div className="bg-card rounded-[16px] p-6 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-2xl mb-2">Sign off {confirming.name}?</h3>
            <p className="text-sm text-muted-foreground mb-5">
              Mark {confirming.name} complete? A draft invoice for ₹{(confirming.amount / 100000).toFixed(2)}L will be created.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirming(null)} className="h-10 px-4 rounded-[6px] border border-border text-sm font-medium hover:bg-muted">Cancel</button>
              <button
                onClick={() => signOff.mutate(confirming)}
                disabled={signOff.isPending}
                className="h-10 px-5 rounded-[6px] bg-[#7a9e8a] text-white text-sm font-medium hover:brightness-110 inline-flex items-center gap-2 disabled:opacity-60"
              >
                {signOff.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
