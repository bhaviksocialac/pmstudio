import { useEffect, useMemo, useRef, useState } from "react";
import Gantt from "frappe-gantt";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import type { TaskRow } from "./TaskTable";
import { phaseOfTask, PROJECT_PHASES, isTaskDone, type ProjectPhase } from "@/lib/task-flow";

type ViewMode = "Day" | "Week" | "Month" | "Year";
type GroupMode = "all" | "agency" | "work_type" | "room";

type Milestone = {
  id: string;
  name: string;
  kind: string;
  trigger: { phase?: string } | null;
  status: string;
  triggered_at: string | null;
  triggered_on_time: boolean | null;
  invoice_amount?: number | null;
};

type FrappeTask = {
  id: string;
  name: string;
  start: string;
  end: string;
  progress: number;
  dependencies?: string;
  custom_class?: string;
};

const fmt = (d: Date) => d.toISOString().slice(0, 10);

function toDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function rowsToBucketKey(t: TaskRow, mode: GroupMode): string {
  if (mode === "agency") return (t.agency || t.contractor || t.assignee || "Unassigned").trim();
  if (mode === "work_type") {
    const wts = Array.isArray((t as { work_types?: unknown }).work_types)
      ? ((t as { work_types?: unknown }).work_types as string[])
      : [];
    return (wts[0] || t.work_type || "Other").trim();
  }
  if (mode === "room") {
    const areas = Array.isArray(t.areas) && (t.areas as string[]).length
      ? (t.areas as string[])
      : (t.area ? [t.area] : []);
    return (areas[0] || "Unassigned").trim();
  }
  return phaseOfTask(t);
}

function statusClass(t: TaskRow): string {
  const today = new Date();
  if (isTaskDone(t)) return "pms-done";
  const pe = toDate(t.planned_end ?? t.due_date);
  if (pe && pe < today) return "pms-delayed";
  if (t.status === "wip" || t.status === "in_progress") return "pms-wip";
  if (t.status === "blocked") return "pms-blocked";
  return "pms-planned";
}

function progressOf(t: TaskRow): number {
  if (isTaskDone(t)) return 100;
  if (t.status === "wip" || t.status === "in_progress") return 50;
  return 0;
}

export function GanttTimeline({
  rows,
  onSelect,
  projectId,
}: {
  rows: TaskRow[];
  onSelect?: (id: string) => void;
  projectId?: string;
}) {
  const isMobile = useIsMobile();
  const [viewMode, setViewMode] = useState<ViewMode>(isMobile ? "Week" : "Month");
  const [groupBy, setGroupBy] = useState<GroupMode>("all");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [activeMilestone, setActiveMilestone] = useState<Milestone | null>(null);
  const [pendingMove, setPendingMove] = useState<{
    taskId: string;
    deltaDays: number;
    dependents: TaskRow[];
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const ganttRef = useRef<Gantt | null>(null);

  // Load milestones
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("milestones")
        .select("id,name,kind,trigger,status,triggered_at,triggered_on_time,invoice_amount")
        .eq("project_id", projectId);
      if (!cancelled && data) setMilestones(data as unknown as Milestone[]);
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  // Map: task id → dependents (tasks that depend on this one)
  const dependentsByTaskId = useMemo(() => {
    const m = new Map<string, TaskRow[]>();
    rows.forEach((t) => {
      const deps = Array.isArray(t.depends_on) ? (t.depends_on as string[]) : [];
      deps.forEach((dId) => {
        const arr = m.get(dId) ?? [];
        arr.push(t);
        m.set(dId, arr);
      });
    });
    return m;
  }, [rows]);

  // Build groups
  const groups = useMemo(() => {
    const parents = rows.filter((r) => !r.parent_task_id);
    const map = new Map<string, TaskRow[]>();

    // For "all" mode, pre-seed all phases so empty ones can show placeholders
    if (groupBy === "all") {
      PROJECT_PHASES.forEach((p) => map.set(p, []));
    }

    parents.forEach((t) => {
      const k = rowsToBucketKey(t, groupBy);
      const arr = map.get(k) ?? [];
      arr.push(t);
      map.set(k, arr);
    });

    const entries: { key: string; phase?: ProjectPhase; items: TaskRow[] }[] = [];
    if (groupBy === "all") {
      PROJECT_PHASES.forEach((p) => {
        entries.push({ key: p, phase: p, items: map.get(p) ?? [] });
      });
    } else {
      Array.from(map.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([k, items]) => entries.push({ key: k, items }));
    }
    return entries;
  }, [rows, groupBy]);

  // Build the Frappe tasks array
  const frappeTasks = useMemo<FrappeTask[]>(() => {
    const out: FrappeTask[] = [];
    const today = fmt(new Date());

    const groupSpan = (items: TaskRow[]): { start: Date; end: Date } | null => {
      let s: Date | null = null;
      let e: Date | null = null;
      items.forEach((t) => {
        const ps = toDate(t.planned_start) ?? toDate(t.start_date) ?? toDate(t.actual_start);
        const pe = toDate(t.planned_end) ?? toDate(t.due_date) ?? toDate(t.actual_end);
        if (ps && (!s || ps < s)) s = ps;
        if (pe && (!e || pe > e)) e = pe;
      });
      return s && e ? { start: s, end: e } : null;
    };

    groups.forEach((g) => {
      const span = groupSpan(g.items);
      const groupId = `grp:${g.key}`;
      const isCollapsed = collapsed.has(g.key);

      if (!span) {
        // Empty placeholder
        out.push({
          id: groupId,
          name: `${g.key} — No dates set — add tasks to see timeline`,
          start: today,
          end: today,
          progress: 0,
          custom_class: "pms-empty",
        });
        return;
      }

      const doneCount = g.items.filter((t) => isTaskDone(t)).length;
      const pct = g.items.length ? Math.round((doneCount / g.items.length) * 100) : 0;
      out.push({
        id: groupId,
        name: `${isCollapsed ? "▶" : "▼"} ${g.key}  (${doneCount}/${g.items.length} · ${pct}%)`,
        start: fmt(span.start),
        end: fmt(span.end),
        progress: pct,
        custom_class: "pms-phase",
      });

      if (!isCollapsed) {
        g.items.forEach((t) => {
          const ps = toDate(t.planned_start) ?? toDate(t.start_date) ?? toDate(t.actual_start);
          const pe = toDate(t.planned_end) ?? toDate(t.due_date) ?? toDate(t.actual_end);
          if (!ps || !pe) return;
          const deps = Array.isArray(t.depends_on) ? (t.depends_on as string[]) : [];
          out.push({
            id: `task:${t.id}`,
            name: t.title,
            start: fmt(ps),
            end: fmt(pe),
            progress: progressOf(t),
            dependencies: deps.map((d) => `task:${d}`).join(","),
            custom_class: statusClass(t),
          });
        });

        // Milestones (only in "all" mode where group key matches phase)
        if (groupBy === "all" && g.phase) {
          milestones
            .filter((m) => m.kind === "phase" && (m.trigger?.phase ?? "") === g.phase)
            .forEach((m) => {
              const at = toDate(m.triggered_at) ?? span.end;
              const today2 = new Date();
              const diff = (at.getTime() - today2.getTime()) / 86400000;
              let cls = "pms-milestone";
              if (m.status === "pending") {
                cls += diff >= 0 && diff <= 7 ? " pms-ms-upcoming" : " pms-ms-delayed";
              } else {
                cls += m.triggered_on_time === false ? " pms-ms-delayed" : " pms-ms-ontime";
              }
              const day = fmt(at);
              out.push({
                id: `ms:${m.id}`,
                name: `◆ ${m.name}`,
                start: day,
                end: day,
                progress: 0,
                custom_class: cls,
              });
            });
        }
      }
    });

    return out;
  }, [groups, collapsed, milestones, groupBy]);

  // (Re)mount the Gantt instance whenever data/view changes
  useEffect(() => {
    if (!containerRef.current) return;
    if (frappeTasks.length === 0) {
      containerRef.current.innerHTML = "";
      ganttRef.current = null;
      return;
    }

    // Clear container
    containerRef.current.innerHTML = "";

    const g = new Gantt(containerRef.current, frappeTasks, {
      view_mode: viewMode,
      bar_height: 22,
      bar_corner_radius: 4,
      padding: 14,
      readonly: false,
      infinite_padding: false,
      today_button: false,
      view_mode_select: false,
      popup: ({ task, set_title, set_subtitle, set_details }: { task: { name: string; start: string | Date; end: string | Date; progress?: number }; set_title: (s: string) => void; set_subtitle: (s: string) => void; set_details: (s: string) => void }) => {
        set_title(task.name.replace(/^[▶▼]\s*/, ""));
        const start = new Date(task.start as unknown as string);
        const end = new Date(task.end as unknown as string);
        set_subtitle(`${start.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} → ${end.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`);
        set_details(`${task.progress ?? 0}% complete`);
      },
      on_click: (task: { id: string }) => {
        if (task.id.startsWith("grp:")) {
          const key = task.id.slice(4);
          setCollapsed((s) => {
            const n = new Set(s);
            n.has(key) ? n.delete(key) : n.add(key);
            return n;
          });
          return;
        }
        if (task.id.startsWith("ms:")) {
          const msId = task.id.slice(3);
          const ms = milestones.find((m) => m.id === msId);
          if (ms) setActiveMilestone(ms);
          return;
        }
        if (task.id.startsWith("task:")) {
          onSelect?.(task.id.slice(5));
        }
      },
      on_date_change: async (
        task: { id: string },
        start: Date,
        end: Date,
      ) => {
        if (!task.id.startsWith("task:")) return;
        const taskId = task.id.slice(5);
        const original = rows.find((r) => r.id === taskId);
        if (!original) return;
        const startStr = fmt(start);
        const endStr = fmt(end);
        const { error } = await supabase
          .from("tasks")
          .update({
            planned_start: startStr,
            planned_end: endStr,
            start_date: startStr,
            due_date: endStr,
          })
          .eq("id", taskId);
        if (error) {
          toast.error(`Couldn't save dates: ${error.message}`);
          return;
        }
        toast.success("Dates updated");
        // Check dependents
        const dependents = dependentsByTaskId.get(taskId) ?? [];
        if (dependents.length > 0) {
          const originalEnd = toDate(original.planned_end ?? original.due_date);
          const deltaDays = originalEnd
            ? Math.round((end.getTime() - originalEnd.getTime()) / 86400000)
            : 0;
          if (deltaDays !== 0) {
            setPendingMove({ taskId, deltaDays, dependents });
          }
        }
      },
    });

    ganttRef.current = g;

    // Center on today
    requestAnimationFrame(() => {
      try {
        g.scroll_current?.();
        // Stagger animation: assign --i to each bar wrapper
        const wrappers = containerRef.current?.querySelectorAll(".bar-wrapper");
        wrappers?.forEach((el, i) => {
          (el as HTMLElement).style.animationDelay = `${i * 50}ms`;
        });
        // Draw today line
        drawTodayLine(containerRef.current);
      } catch {
        /* noop */
      }
    });

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = "";
      ganttRef.current = null;
    };
  }, [frappeTasks, viewMode, milestones, onSelect, rows, dependentsByTaskId]);

  // Cascade dependents
  const applyCascade = async () => {
    if (!pendingMove) return;
    const { deltaDays, dependents } = pendingMove;
    const shift = (s: string | null) => {
      if (!s) return null;
      const d = new Date(s);
      d.setDate(d.getDate() + deltaDays);
      return fmt(d);
    };
    for (const dep of dependents) {
      await supabase
        .from("tasks")
        .update({
          planned_start: shift(dep.planned_start ?? dep.start_date),
          planned_end: shift(dep.planned_end ?? dep.due_date),
          start_date: shift(dep.start_date),
          due_date: shift(dep.due_date),
        })
        .eq("id", dep.id);
    }
    toast.success(`${dependents.length} dependent task${dependents.length === 1 ? "" : "s"} updated`);
    setPendingMove(null);
  };

  if (rows.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-12">
        No tasks to chart.
      </div>
    );
  }

  return (
    <div
      className="rounded-[16px] bg-card border border-border overflow-hidden"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
        <h3 className="font-display text-lg">Gantt Timeline</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-[8px] border border-border overflow-hidden">
            {(["Day", "Week", "Month", "Year"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className={`h-8 px-3 text-[11px] font-medium transition-colors ${
                  viewMode === v
                    ? "bg-[#c17f5a] text-white"
                    : "bg-white text-muted-foreground hover:bg-[#c17f5a14]"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupMode)}
            className="h-8 px-2 rounded-[8px] border border-border bg-white text-[11px] font-medium"
          >
            <option value="all">Group: Phase</option>
            <option value="agency">Group: Agency</option>
            <option value="work_type">Group: Work Type</option>
            <option value="room">Group: Room</option>
          </select>
        </div>
      </div>

      <div className="px-5 py-2 border-b border-border flex items-center gap-4 text-[11px] text-muted-foreground flex-wrap">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#6b9e82" }} /> Done
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#c17f5a" }} /> WIP
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#c4685a" }} /> Delayed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm border border-[#d4882a]" style={{ background: "#fff3e0" }} /> Planned
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#b8aea3" }} /> Blocked
        </span>
        <span className="inline-flex items-center gap-1.5 text-[#1a1612]">◆ Milestone</span>
      </div>

      <div className="pmstudio-gantt-scroll overflow-auto pmstudio-gantt relative">
        <div ref={containerRef} />
      </div>

      {/* Milestone popup */}
      <AlertDialog open={!!activeMilestone} onOpenChange={(o) => !o && setActiveMilestone(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>◆ {activeMilestone?.name}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm pt-2">
                <div>
                  <span className="text-muted-foreground">Date: </span>
                  {activeMilestone?.triggered_at
                    ? new Date(activeMilestone.triggered_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                    : "—"}
                </div>
                <div>
                  <span className="text-muted-foreground">Status: </span>
                  <span className="font-medium capitalize">{activeMilestone?.status}</span>
                </div>
                {activeMilestone?.invoice_amount ? (
                  <div>
                    <span className="text-muted-foreground">Linked invoice: </span>
                    ₹{Number(activeMilestone.invoice_amount).toLocaleString("en-IN")}
                  </div>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setActiveMilestone(null)}>Close</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dependency cascade prompt */}
      <AlertDialog open={!!pendingMove} onOpenChange={(o) => !o && setPendingMove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update dependent tasks?</AlertDialogTitle>
            <AlertDialogDescription>
              Moving this task affects {pendingMove?.dependents.length} dependent task
              {pendingMove?.dependents.length === 1 ? "" : "s"}. Shift them by the same
              {" "}
              {pendingMove?.deltaDays} day{Math.abs(pendingMove?.deltaDays ?? 0) === 1 ? "" : "s"} too?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingMove(null)}>No</AlertDialogCancel>
            <AlertDialogAction onClick={applyCascade} className="bg-[#c17f5a] hover:bg-[#a86b4a]">
              Yes, shift them
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Draw a red vertical "Today" line over the rendered SVG
function drawTodayLine(container: HTMLDivElement | null) {
  if (!container) return;
  const svg = container.querySelector("svg.gantt") as SVGSVGElement | null;
  if (!svg) return;
  const today = new Date();
  const dateText = svg.querySelector(".today-highlight");
  if (!dateText) return;
  const rect = (dateText as SVGRectElement).getBoundingClientRect();
  const svgRect = svg.getBoundingClientRect();
  const x = rect.left - svgRect.left + rect.width / 2;
  // Remove any previous indicator
  container.querySelectorAll(".pmstudio-today-line, .pmstudio-today-label").forEach((n) => n.remove());
  const line = document.createElement("div");
  line.className = "pmstudio-today-line";
  line.style.left = `${x}px`;
  const label = document.createElement("div");
  label.className = "pmstudio-today-label";
  label.style.left = `${x}px`;
  label.textContent = "Today";
  // Position relative to the scroll wrapper
  const wrapper = container.parentElement;
  if (wrapper) {
    wrapper.style.position = wrapper.style.position || "relative";
    wrapper.appendChild(line);
    wrapper.appendChild(label);
    void today;
  }
}
