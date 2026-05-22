import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Table as TableIcon, GanttChart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TaskTable, type TaskRow } from "@/components/tasks/TaskTable";
import { TaskFilters, emptyFilters, type FilterState } from "@/components/tasks/TaskFilters";
import { AINarrativeBar } from "@/components/tasks/AINarrativeBar";
import { GanttTimeline } from "@/components/tasks/GanttTimeline";
import { STATUS_META, WORK_TYPES, deriveActionRequired } from "@/lib/task-flow";

type GroupBy = "all" | "status" | "contractor" | "room" | "work_type";
type View = "table" | "gantt";

const PRIORITIES = ["None", "Urgent", "High", "Medium", "Low"];

function titleCase(s: string) {
  return s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}
function formatStatus(s: string) {
  return STATUS_META[s]?.label ?? titleCase(s);
}

export function ProjectTasksTab({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [groupBy, setGroupBy] = useState<GroupBy>("status");
  const [view, setView] = useState<View>("table");
  const [filters, setFilters] = useState<FilterState>(emptyFilters());

  const [extraRooms, setExtraRooms] = useState<string[]>([]);
  const [extraStatuses, setExtraStatuses] = useState<string[]>([]);
  const [extraWorkTypes, setExtraWorkTypes] = useState<string[]>([]);

  const tasksQ = useQuery({
    queryKey: ["project-tasks", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks").select("*")
        .eq("project_id", projectId)
        .order("planned_start", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as TaskRow[];
    },
  });

  const vendorsQ = useQuery({
    queryKey: ["vendors-for-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vendors").select("id,name").order("name");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const teamQ = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data, error } = await supabase.from("team_members").select("id,name,role").order("created_at");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string; role: string }[];
    },
  });

  const profileQ = useQuery({
    queryKey: ["profile-self"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("full_name").maybeSingle();
      if (error) throw error;
      return data as { full_name: string | null } | null;
    },
  });

  const teamMembers = useMemo(() => {
    const self = profileQ.data?.full_name?.trim();
    const list = [...(teamQ.data ?? [])];
    if (self && !list.some((m) => m.name.toLowerCase() === self.toLowerCase())) {
      list.unshift({ id: "self", name: self, role: "Me (Designer)" });
    }
    return list;
  }, [teamQ.data, profileQ.data]);


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
    const rooms = new Set<string>(extraRooms);
    const contractors = new Set<string>(["Client"]);
    const workTypes = new Set<string>(extraWorkTypes);
    rows.forEach((t) => {
      const areas = Array.isArray(t.areas) && (t.areas as string[]).length ? (t.areas as string[]) : (t.area ? [t.area] : []);
      areas.forEach((a) => rooms.add(a));
      const c = t.agency || t.contractor || t.assignee;
      if (c) contractors.add(c);
      const wts = Array.isArray(t.work_types) && (t.work_types as string[]).length ? (t.work_types as string[]) : (t.work_type ? [t.work_type] : []);
      wts.forEach((w) => workTypes.add(w));
    });
    WORK_TYPES.forEach((w) => workTypes.add(w));
    const baseStatuses = Object.keys(STATUS_META).filter((s) => !["todo", "in_progress"].includes(s));
    const statuses = Array.from(new Set([...baseStatuses, ...extraStatuses]));

    return [
      {
        key: "rooms" as const, label: "Room",
        values: Array.from(rooms).sort(),
        format: (v: string) => titleCase(v),
        addLabel: "Add Room",
        onAdd: (v: string) => setExtraRooms((p) => Array.from(new Set([...p, v]))),
      },
      { key: "contractors" as const, label: "Agency", values: Array.from(contractors).sort() },
      {
        key: "statuses" as const, label: "Status", values: statuses,
        format: (v: string) => formatStatus(v),
        addLabel: "Add Status",
        onAdd: (v: string) => setExtraStatuses((p) => Array.from(new Set([...p, v]))),
      },
      { key: "priorities" as const, label: "Priority", values: PRIORITIES },
      {
        key: "workTypes" as const, label: "Work Type", values: Array.from(workTypes).sort(),
        format: (v: string) => titleCase(v),
        addLabel: "Add Work Type",
        onAdd: (v: string) => setExtraWorkTypes((p) => Array.from(new Set([...p, v]))),
      },
    ];
  }, [rows, extraRooms, extraStatuses, extraWorkTypes]);

  const filtered = useMemo(() => rows.filter((t) => {
    const areas = Array.isArray(t.areas) && (t.areas as string[]).length ? (t.areas as string[]) : (t.area ? [t.area] : []);
    if (filters.rooms.size && !areas.some((a) => filters.rooms.has(a))) return false;
    const c = t.agency || t.contractor || t.assignee || "";
    if (filters.contractors.size && !filters.contractors.has(c)) return false;
    if (filters.statuses.size && !filters.statuses.has(t.status ?? "not_started")) return false;
    if (filters.priorities.size) {
      const p = t.priority ?? "None";
      if (!filters.priorities.has(p)) return false;
    }
    if (filters.workTypes.size && !(t.work_type && filters.workTypes.has(t.work_type))) return false;
    return true;
  }), [rows, filters]);

  const parents = filtered.filter((t) => !t.parent_task_id);

  const groups = useMemo(() => {
    if (groupBy === "all") return [["All Tasks", parents] as [string, TaskRow[]]];
    const m = new Map<string, TaskRow[]>();
    parents.forEach((t) => {
      let key = "Other";
      if (groupBy === "contractor") key = t.agency || t.contractor || t.assignee || "Unassigned";
      else if (groupBy === "room") {
        const areas = Array.isArray(t.areas) && (t.areas as string[]).length ? (t.areas as string[]) : (t.area ? [t.area] : []);
        key = areas[0] ? titleCase(areas[0]) : "Unassigned";
      }
      else if (groupBy === "work_type") key = t.work_type ? titleCase(t.work_type) : "Other";
      else key = STATUS_META[t.status ?? "not_started"]?.label ?? "Not Started";
      const arr = m.get(key) ?? [];
      arr.push(t);
      m.set(key, arr);
    });
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [parents, groupBy]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl">Tasks</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          Smart Task Intelligence — every site update becomes structured tasks. AI extracts events from English, हिन्दी, or Hinglish,
          detects duplicates, links dependencies, and tracks planned vs actual.
        </p>
      </div>

      <AINarrativeBar projectId={projectId} teamMembers={teamMembers} />

      <div className="rounded-[16px] bg-card border border-border p-5 md:p-6" style={{ boxShadow: "var(--shadow-card)" }}>
        <TaskFilters groups={filterGroups} state={filters} setState={setFilters} />
        <div className="mt-5 pt-5 border-t border-border flex items-center gap-3 flex-wrap">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium">Group by</span>
          {([
            ["all", "All"], ["status", "Status"], ["contractor", "Agency"], ["room", "Room"], ["work_type", "Work Type"],
          ] as const).map(([k, l]) => (
            <button key={k} onClick={() => setGroupBy(k)}
              className={`h-8 px-3 rounded-full text-xs font-medium border transition-all ${
                groupBy === k
                  ? "bg-[#c17f5a] text-white border-[#c17f5a]"
                  : "bg-white border-[#e8e3da] text-foreground hover:bg-[#c17f5a18] hover:border-[#c17f5a66]"
              }`}>
              {l}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground font-mono mr-2">{parents.length} task{parents.length === 1 ? "" : "s"}</span>
            <div className="flex rounded-[8px] border border-border overflow-hidden">
              <button
                onClick={() => setView("table")}
                className={`h-8 px-3 text-xs inline-flex items-center gap-1.5 ${view === "table" ? "bg-[#c17f5a] text-white" : "bg-white text-muted-foreground"}`}
              >
                <TableIcon className="h-3.5 w-3.5" /> Table
              </button>
              <button
                onClick={() => setView("gantt")}
                className={`h-8 px-3 text-xs inline-flex items-center gap-1.5 ${view === "gantt" ? "bg-[#c17f5a] text-white" : "bg-white text-muted-foreground"}`}
              >
                <GanttChart className="h-3.5 w-3.5" /> Gantt
              </button>
            </div>
          </div>
        </div>
      </div>

      {tasksQ.isLoading ? (
        <div className="py-20 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : view === "gantt" ? (
        <GanttTimeline rows={parents} />
      ) : groups.length === 0 || parents.length === 0 ? (
        <div className="py-20 text-center text-sm text-muted-foreground">No tasks match these filters.</div>
      ) : (
        <div className="space-y-10">
          {groups.map(([groupKey, items]) => (
            <section key={groupKey}>
              {groupBy !== "all" && (
                <div className="flex items-baseline justify-between mb-4">
                  <h2 className="font-display text-2xl">{groupKey}</h2>
                  <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-mono">
                    {items.length} task{items.length === 1 ? "" : "s"}
                  </span>
                </div>
              )}
              <TaskTable
                rows={[...items, ...filtered.filter((s) => s.parent_task_id && items.some((p) => p.id === s.parent_task_id))]}
                projectMap={projectMap}
                vendors={vendorsQ.data ?? []}
                teamMembers={teamMembers}
                rooms={filterGroups[0].values}
                onAddRoom={(r) => setExtraRooms((p) => Array.from(new Set([...p, r])))}
                allProjectTasks={rows}
              />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

