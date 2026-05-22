import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computeBreakdown, type ProgressRow } from "@/lib/task-flow";
import {
  computeRollup,
  overallProjectPct,
  isDone,
  EXECUTION_PHASE_GROUPS,
  type TaskLite,
} from "@/lib/phase-sync";

type TaskRow = TaskLite & {
  agency: string | null;
  contractor: string | null;
  assignee: string | null;
};

function Bar({ pct, tone = "#c17f5a" }: { pct: number; tone?: string }) {
  return (
    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: tone }} />
    </div>
  );
}

function Section({ title, rows, emptyHint }: { title: string; rows: ProgressRow[]; emptyHint: string }) {
  if (!rows.length) {
    return (
      <div>
        <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-3">{title}</h4>
        <p className="text-xs text-muted-foreground italic">{emptyHint}</p>
      </div>
    );
  }
  return (
    <div>
      <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-3">{title}</h4>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.key}>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-medium truncate pr-2">{r.key}</span>
              <span className="font-mono text-muted-foreground tabular-nums shrink-0">{r.done}/{r.total} · {r.pct}%</span>
            </div>
            <Bar pct={r.pct} tone={r.pct === 100 ? "#7a9e8a" : "#c17f5a"} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProjectProgressPanels({ projectId }: { projectId: string }) {
  const { data: tasks = [] } = useQuery({
    queryKey: ["project-tasks-progress", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("status,done,agency,contractor,assignee,work_type,work_types,area,areas,room,completion_pct,phase,ifr_date,ifa_date,ifc_date")
        .eq("project_id", projectId);
      return (data ?? []) as TaskRow[];
    },
  });

  const overall = overallProjectPct(tasks);
  const doneCount = tasks.filter((t) => isDone(t)).length;

  const phaseRows = useMemo<ProgressRow[]>(() => {
    const rollup = computeRollup(tasks);
    const order = new Map(EXECUTION_PHASE_GROUPS.map((p, i) => [p, i] as const));
    return rollup
      .filter((g) => g.total > 0)
      .sort((a, b) => (order.get(a.group) ?? 99) - (order.get(b.group) ?? 99))
      .map((g) => ({ key: g.group, done: g.done, total: g.total, pct: g.pct }));
  }, [tasks]);

  const agencyRows = useMemo(
    () => computeBreakdown(tasks, (t: TaskRow) => t.agency || t.contractor || t.assignee || "Unassigned"),
    [tasks],
  );
  const workTypeRows = useMemo(
    () => computeBreakdown(tasks, (t: TaskRow) => t.work_type ?? null),
    [tasks],
  );

  return (
    <div className="rounded-[16px] bg-card border border-border p-6" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-start justify-between mb-5 gap-4">
        <div>
          <h3 className="font-display text-xl">Task Progress</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Tasks are the single source of truth.</p>
        </div>
        <div className="text-right shrink-0">
          <div className="font-display text-3xl tabular-nums">{overall}%</div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            {doneCount}/{tasks.length} done
          </div>
        </div>
      </div>
      <div className="mb-6">
        <Bar pct={overall} tone={overall === 100 ? "#7a9e8a" : "#c17f5a"} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Section title="Phase Progress" rows={phaseRows} emptyHint="No tasks yet." />
        <Section title="Agency Progress" rows={agencyRows} emptyHint="No agencies assigned." />
        <Section title="Work Type Progress" rows={workTypeRows} emptyHint="No work types tagged." />
      </div>
    </div>
  );
}
