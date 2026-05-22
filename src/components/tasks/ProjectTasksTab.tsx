import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TaskTable, type TaskRow } from "@/components/tasks/TaskTable";
import { TaskFilters, emptyFilters, type FilterState } from "@/components/tasks/TaskFilters";
import { STATUS_META, WORK_TYPES, deriveActionRequired } from "@/lib/task-flow";

export function ProjectTasksTab({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [groupBy, setGroupBy] = useState<"status" | "contractor" | "room" | "work_type">("status");
  const [filters, setFilters] = useState<FilterState>(emptyFilters());

  const tasksQ = useQuery({
    queryKey: ["project-tasks", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks").select("*")
        .eq("project_id", projectId)
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as TaskRow[];
    },
  });

  useEffect(() => {
    const ch = supabase.channel(`tasks-rt-${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `project_id=eq.${projectId}` }, () => {
        tasksQ.refetch();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [projectId, tasksQ]);

  const projectMap = useMemo(() => new Map([[projectId, projectName]]), [projectId, projectName]);

  const rows = useMemo(() => (tasksQ.data ?? []).map((t) => {
    if (t.action_required) return t;
    const derived = deriveActionRequired(t);
    return derived.required ? { ...t, action_required: true, action_label: t.action_label ?? derived.label } : t;
  }), [tasksQ.data]);

  const filterGroups = useMemo(() => {
    const rooms = new Set<string>();
    const contractors = new Set<string>();
    const workTypes = new Set<string>();
    rows.forEach((t) => {
      if (t.area) rooms.add(t.area);
      const c = t.contractor || t.assignee;
      if (c) contractors.add(c);
      if (t.work_type) workTypes.add(t.work_type);
    });
    WORK_TYPES.forEach((w) => workTypes.add(w));
    return [
      { key: "rooms" as const,       label: "Room",       values: Array.from(rooms).sort() },
      { key: "contractors" as const, label: "Contractor", values: Array.from(contractors).sort() },
      { key: "statuses" as const,    label: "Status",     values: Object.keys(STATUS_META).filter((s) => !["todo","in_progress"].includes(s)) },
      { key: "priorities" as const,  label: "Priority",   values: ["Urgent", "High", "Medium", "Low"] },
      { key: "workTypes" as const,   label: "Work Type",  values: Array.from(workTypes).sort() },
    ];
  }, [rows]);

  const filtered = useMemo(() => rows.filter((t) => {
    if (filters.rooms.size && !(t.area && filters.rooms.has(t.area))) return false;
    const c = t.contractor || t.assignee || "";
    if (filters.contractors.size && !filters.contractors.has(c)) return false;
    if (filters.statuses.size && !filters.statuses.has(t.status ?? "not_started")) return false;
    if (filters.priorities.size && !filters.priorities.has(t.priority ?? "Medium")) return false;
    if (filters.workTypes.size && !(t.work_type && filters.workTypes.has(t.work_type))) return false;
    return true;
  }), [rows, filters]);

  const parents = filtered.filter((t) => !t.parent_task_id);

  const groups = useMemo(() => {
    const m = new Map<string, TaskRow[]>();
    parents.forEach((t) => {
      let key = "Other";
      if (groupBy === "contractor") key = t.contractor || t.assignee || "Unassigned";
      else if (groupBy === "room") key = t.area || "Unassigned";
      else if (groupBy === "work_type") key = t.work_type || "Other";
      else key = STATUS_META[t.status ?? "not_started"]?.label ?? "Not Started";
      const arr = m.get(key) ?? [];
      arr.push(t);
      m.set(key, arr);
    });
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [parents, groupBy]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl">Tasks</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          Every task in this project — filter, group, expand. Urgent rows tinted red, action-required amber, done green, planned grey.
          Use the AI bar above to log site updates.
        </p>
      </div>

      <div className="rounded-[16px] bg-card border border-border p-5 md:p-6" style={{ boxShadow: "var(--shadow-card)" }}>
        <TaskFilters groups={filterGroups} state={filters} setState={setFilters} />
        <div className="mt-5 pt-5 border-t border-border flex items-center gap-3 flex-wrap">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium">Group by</span>
          {([
            ["status", "Status"], ["contractor", "Contractor"], ["room", "Room"], ["work_type", "Work Type"],
          ] as const).map(([k, l]) => (
            <button key={k} onClick={() => setGroupBy(k)}
              className={`h-8 px-3 rounded-[8px] text-xs font-medium ${groupBy === k ? "bg-[#1a1612] text-white" : "border border-border bg-card hover:bg-muted"}`}>
              {l}
            </button>
          ))}
          <span className="ml-auto text-[11px] text-muted-foreground font-mono">{parents.length} task{parents.length === 1 ? "" : "s"}</span>
        </div>
      </div>

      {tasksQ.isLoading ? (
        <div className="py-20 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : groups.length === 0 ? (
        <div className="py-20 text-center text-sm text-muted-foreground">No tasks match these filters.</div>
      ) : (
        <div className="space-y-10">
          {groups.map(([groupKey, items]) => (
            <section key={groupKey}>
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="font-display text-2xl">{groupKey}</h2>
                <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-mono">
                  {items.length} task{items.length === 1 ? "" : "s"}
                </span>
              </div>
              <TaskTable
                rows={[...items, ...filtered.filter((s) => s.parent_task_id && items.some((p) => p.id === s.parent_task_id))]}
                projectMap={projectMap}
              />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
