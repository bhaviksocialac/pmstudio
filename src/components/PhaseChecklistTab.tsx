import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Lock, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

// Sequential execution phases reusing existing phase_subcategories (phase='Execution').
const PHASE_DEFS: { name: string; tasks: string[]; budgetPct: number }[] = [
  { name: "Civil Work", tasks: ["Site cleared", "Demolition complete", "Brickwork done", "Plaster complete", "Waterproofing applied"], budgetPct: 15 },
  { name: "Electrical Work", tasks: ["Conduiting done", "Wiring pulled", "DB installed", "Switches & sockets fitted", "Light fixtures installed"], budgetPct: 10 },
  { name: "Plumbing Work", tasks: ["Lines laid", "Pressure tested", "Fixtures installed", "Drainage connected", "Hot water lines done"], budgetPct: 10 },
  { name: "Flooring Work", tasks: ["Subfloor levelled", "Tiles/flooring laid", "Grouting done", "Skirting installed", "Polishing complete"], budgetPct: 20 },
  { name: "Painting Work", tasks: ["Putty applied", "Primer coat done", "First coat", "Final coat", "Touch-ups complete"], budgetPct: 8 },
  { name: "Furniture Installation", tasks: ["Carpentry on-site", "Modular units fitted", "Hardware installed", "Final fitting", "Cleaning & handover prep"], budgetPct: 12 },
];

type Sub = {
  id: string;
  name: string;
  status: string;
  checklist: { text: string; done: boolean }[];
  signed_off_at: string | null;
};

export function PhaseChecklistTab({ projectId, projectBudget }: { projectId: string; projectBudget: number }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(PHASE_DEFS[0].name);
  const [confirming, setConfirming] = useState<{ name: string; next: string | null; amount: number } | null>(null);

  const { data: subs = [], isLoading } = useQuery({
    queryKey: ["exec-checklists", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("phase_subcategories")
        .select("id,name,status,checklist,signed_off_at")
        .eq("project_id", projectId)
        .eq("phase", "Execution");
      if (error) throw error;
      return (data ?? []) as Sub[];
    },
  });

  // Ensure rows exist for each phase def
  const ensure = useMutation({
    mutationFn: async () => {
      const have = new Set(subs.map((s) => s.name));
      const toInsert = PHASE_DEFS.filter((p) => !have.has(p.name)).map((p, i) => ({
        user_id: user!.id,
        project_id: projectId,
        phase: "Execution",
        name: p.name,
        order_index: i,
        status: "planned",
        checklist: p.tasks.map((t) => ({ text: t, done: false })),
      }));
      // Backfill checklists for existing rows missing them
      const toBackfill = subs.filter((s) => {
        const def = PHASE_DEFS.find((p) => p.name === s.name);
        return def && (!s.checklist || (s.checklist as any[]).length === 0);
      });
      if (toInsert.length) await supabase.from("phase_subcategories").insert(toInsert);
      for (const s of toBackfill) {
        const def = PHASE_DEFS.find((p) => p.name === s.name)!;
        await supabase.from("phase_subcategories").update({ checklist: def.tasks.map((t) => ({ text: t, done: false })) }).eq("id", s.id);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exec-checklists", projectId] }),
  });

  // Order subs by PHASE_DEFS order
  const ordered = useMemo(() => {
    return PHASE_DEFS.map((def) => {
      const row = subs.find((s) => s.name === def.name);
      return { def, row };
    });
  }, [subs]);

  const toggleTask = useMutation({
    mutationFn: async ({ id, idx, done, checklist }: { id: string; idx: number; done: boolean; checklist: { text: string; done: boolean }[] }) => {
      const next = checklist.map((t, i) => (i === idx ? { ...t, done } : t));
      const allDone = next.every((t) => t.done);
      const patch: any = { checklist: next };
      // mark in_progress when first ticks; revert to planned if all unchecked
      if (next.some((t) => t.done)) patch.status = allDone ? "in_progress" : "in_progress";
      const { error } = await supabase.from("phase_subcategories").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exec-checklists", projectId] }),
  });

  const signOff = useMutation({
    mutationFn: async ({ id, name, amount }: { id: string; name: string; amount: number }) => {
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await supabase.from("phase_subcategories")
        .update({ status: "done", signed_off_at: new Date().toISOString(), end_date: today })
        .eq("id", id);
      if (error) throw error;
      // Auto-draft invoice
      await supabase.from("invoices").insert({
        user_id: user!.id,
        project_id: projectId,
        amount,
        milestone: `${name} complete`,
        status: "draft",
      });
      return { name, amount };
    },
    onSuccess: ({ name, amount }) => {
      qc.invalidateQueries({ queryKey: ["exec-checklists", projectId] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["invoices", projectId] });
      toast.success(`${name} signed off. Invoice draft created for ₹${(amount / 100000).toFixed(2)}L.`);
      setConfirming(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  if (subs.length === 0 || ordered.some(({ row }) => !row)) {
    return (
      <div className="rounded-[10px] border border-dashed border-border p-6 text-center">
        <p className="text-sm text-muted-foreground mb-3">Set up execution phase checklists.</p>
        <button onClick={() => ensure.mutate()} disabled={ensure.isPending}
          className="h-9 px-4 rounded-[6px] bg-primary text-primary-foreground text-xs font-medium hover:brightness-95 inline-flex items-center gap-2 disabled:opacity-60">
          {ensure.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Initialize Phases
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">6 execution phases, sequential. Complete all checklist items in a phase to enable Sign Off.</div>
      {ordered.map(({ def, row }, idx) => {
        const prev = idx > 0 ? ordered[idx - 1].row : null;
        const locked = idx > 0 && (!prev || !prev.signed_off_at);
        const cl: { text: string; done: boolean }[] = (row!.checklist as any) ?? [];
        const allDone = cl.length > 0 && cl.every((t) => t.done);
        const signedOff = !!row!.signed_off_at;
        const open = expanded === def.name;
        const amount = Math.round(projectBudget * 100000 * (def.budgetPct / 100));
        return (
          <div key={def.name} className={`rounded-[10px] border ${signedOff ? "border-[#7a9e8a] bg-[#f3f8f5]" : locked ? "border-border bg-muted/40 opacity-60" : "border-border bg-card"} overflow-hidden`}>
            <button
              onClick={() => !locked && setExpanded(open ? null : def.name)}
              disabled={locked}
              className="w-full px-4 py-3 flex items-center gap-3 text-left disabled:cursor-not-allowed"
            >
              <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-mono ${signedOff ? "bg-[#7a9e8a] text-white" : locked ? "bg-muted text-muted-foreground" : "bg-[#c17f5a] text-white"}`}>
                {signedOff ? <Check className="h-3 w-3" /> : locked ? <Lock className="h-3 w-3" /> : idx + 1}
              </span>
              <span className="font-medium text-sm flex-1">{def.name}</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">{def.budgetPct}% · ₹{(amount / 100000).toFixed(1)}L</span>
              {signedOff && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-[4px] bg-[#7a9e8a]/20 text-[#3d6f5a]">Signed Off</span>}
              {!locked && (open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />)}
            </button>
            {open && !locked && (
              <div className="px-4 pb-4 pt-1 border-t border-border space-y-2">
                {cl.map((t, i) => (
                  <label key={i} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={t.done}
                      disabled={signedOff}
                      onChange={(e) => toggleTask.mutate({ id: row!.id, idx: i, done: e.target.checked, checklist: cl })}
                      className="accent-[#c17f5a] h-4 w-4"
                    />
                    <span className={t.done ? "line-through text-muted-foreground" : ""}>{t.text}</span>
                  </label>
                ))}
                {!signedOff && (
                  <button
                    onClick={() => setConfirming({ name: def.name, next: ordered[idx + 1]?.def.name ?? null, amount })}
                    disabled={!allDone}
                    className="mt-2 h-9 px-4 rounded-[6px] bg-[#7a9e8a] text-white text-xs font-medium hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                  >
                    <Check className="h-3.5 w-3.5" /> Sign Off Phase
                  </button>
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
              Mark {confirming.name} as complete{confirming.next ? ` and begin ${confirming.next}` : ""}? A draft invoice for ₹{(confirming.amount / 100000).toFixed(2)}L will be created.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirming(null)} className="h-10 px-4 rounded-[6px] border border-border text-sm font-medium hover:bg-muted">Cancel</button>
              <button
                onClick={() => {
                  const row = subs.find((s) => s.name === confirming.name)!;
                  signOff.mutate({ id: row.id, name: confirming.name, amount: confirming.amount });
                }}
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
