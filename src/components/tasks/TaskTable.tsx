import { Fragment, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ChevronRight, ChevronDown, Check, AlertCircle, Paperclip, StickyNote,
  ArrowRight, SplitSquareVertical, Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  STATUS_META, STATUS_ORDER, PRIORITY_META, rowTint, nextStatus, WORK_TYPES,
} from "@/lib/task-flow";
import { cascadeDependents, splitTaskPerRoom } from "@/lib/task-ai.functions";
import {
  AgencyPicker, AreaPicker, DateField, DependencyPicker, PillPicker, WorkTypePicker,
} from "./TaskInlineEditors";
import { TaskEditSheet } from "./TaskEditSheet";

export type TaskRow = {
  id: string;
  project_id: string | null;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  area: string | null;
  areas: unknown;
  agency: string | null;
  contractor: string | null;
  assignee: string | null;
  work_type: string | null;
  work_types?: unknown;
  vendor_id: string | null;
  start_date: string | null;
  due_date: string | null;
  ifr_date: string | null;
  ifr_type: string | null;
  ifa_date?: string | null;
  ifc_date?: string | null;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  mailed?: boolean | null;
  done: boolean;
  notes: string | null;
  attachments: unknown;
  depends_on: unknown;
  action_required: boolean | null;
  action_label: string | null;
};

function asAreas(t: Pick<TaskRow, "areas" | "area">): string[] {
  if (Array.isArray(t.areas) && (t.areas as string[]).length) return t.areas as string[];
  return t.area ? [t.area] : [];
}

function isDelayed(t: TaskRow) {
  return !!(t.planned_end && t.actual_end && t.actual_end > t.planned_end);
}
function isEarly(t: TaskRow) {
  return !!(t.planned_end && t.actual_end && t.actual_end < t.planned_end);
}

const PRIORITIES = ["Urgent", "High", "Medium", "Low"] as const;

export function TaskTable({
  rows, projectMap, showProject = true, onChanged,
  vendors = [], teamMembers = [], rooms = [], onAddRoom,
  allProjectTasks,
}: {
  rows: TaskRow[];
  projectMap?: Map<string, string>;
  showProject?: boolean;
  onChanged?: () => void;
  vendors?: { id: string; name: string }[];
  teamMembers?: { name: string; role?: string }[];
  rooms?: string[];
  onAddRoom?: (r: string) => void;
  /** All tasks in the project — used for dependency pickers (across filter groups). */
  allProjectTasks?: TaskRow[];
}) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editSheet, setEditSheet] = useState<TaskRow | null>(null);
  const cascade = useServerFn(cascadeDependents);
  const splitFn = useServerFn(splitTaskPerRoom);

  const projectScopeTasks = allProjectTasks ?? rows;

  const titleById = useMemo(() => {
    const m = new Map<string, string>();
    projectScopeTasks.forEach((r) => m.set(r.id, r.title));
    return m;
  }, [projectScopeTasks]);

  const blockingMap = useMemo(() => {
    const m = new Map<string, string[]>();
    projectScopeTasks.forEach((t) => {
      const deps = Array.isArray(t.depends_on) ? (t.depends_on as string[]) : [];
      deps.forEach((depId) => {
        const arr = m.get(depId) ?? [];
        arr.push(t.title);
        m.set(depId, arr);
      });
    });
    return m;
  }, [projectScopeTasks]);

  const subs = useMemo(() => {
    const m = new Map<string, TaskRow[]>();
    rows.forEach((t) => {
      if (t.parent_task_id) {
        const arr = m.get(t.parent_task_id) ?? [];
        arr.push(t);
        m.set(t.parent_task_id, arr);
      }
    });
    return m;
  }, [rows]);

  const parents = rows.filter((t) => !t.parent_task_id);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["all-tasks"] });
    qc.invalidateQueries({ queryKey: ["project-tasks"] });
    onChanged?.();
  };

  const updateField = async (t: TaskRow, patch: Record<string, unknown>) => {
    const { error } = await supabase.from("tasks")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", t.id);
    if (error) { toast.error(error.message); return false; }
    refresh();
    return true;
  };

  const updateStatus = async (t: TaskRow, status: string) => {
    const ok = await updateField(t, { status, done: status === "done" });
    if (ok && t.project_id && (status === "done" || status === "material_delivered")) {
      try {
        const res = await cascade({ data: { taskId: t.id, projectId: t.project_id } });
        if (res.unblocked) toast.success(`${res.unblocked} dependent task${res.unblocked === 1 ? "" : "s"} unblocked`);
      } catch { /* swallow */ }
    }
  };

  // Setting "blocking" on a row T means updating other tasks so they depend_on T
  const setBlocking = async (t: TaskRow, blockedTaskIds: string[]) => {
    const currentlyBlocking = projectScopeTasks
      .filter((x) => Array.isArray(x.depends_on) && (x.depends_on as string[]).includes(t.id))
      .map((x) => x.id);
    const toAdd = blockedTaskIds.filter((id) => !currentlyBlocking.includes(id));
    const toRemove = currentlyBlocking.filter((id) => !blockedTaskIds.includes(id));
    for (const id of toAdd) {
      const target = projectScopeTasks.find((x) => x.id === id);
      const cur = Array.isArray(target?.depends_on) ? (target!.depends_on as string[]) : [];
      await supabase.from("tasks").update({ depends_on: [...cur, t.id] }).eq("id", id);
    }
    for (const id of toRemove) {
      const target = projectScopeTasks.find((x) => x.id === id);
      const cur = Array.isArray(target?.depends_on) ? (target!.depends_on as string[]) : [];
      await supabase.from("tasks").update({ depends_on: cur.filter((d) => d !== t.id) }).eq("id", id);
    }
    refresh();
  };

  const toggleExpand = (id: string) => {
    setExpanded((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  return (
    <div className="rounded-[16px] bg-card border border-border overflow-visible" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <Th className="w-10" />
              <Th className="w-10" />
              <Th>Description</Th>
              <Th>Agency</Th>
              <Th>Status</Th>
              <Th>Start Date</Th>
              <Th>End Date</Th>
              <Th>IFR/IFA/IFC</Th>
              <Th>Area</Th>
              <Th>Priority</Th>
              <Th>Blocked By</Th>
              <Th>Blocking</Th>
              <Th>Notes</Th>
              <Th>Action</Th>
              <Th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {parents.map((t) => {
              const childSubs = subs.get(t.id) ?? [];
              const deps = Array.isArray(t.depends_on) ? (t.depends_on as string[]) : [];
              const blockedBy = deps.map((id) => titleById.get(id)).filter(Boolean) as string[];
              const blocks = blockingMap.get(t.id) ?? [];
              const blocksIds = projectScopeTasks
                .filter((x) => Array.isArray(x.depends_on) && (x.depends_on as string[]).includes(t.id))
                .map((x) => x.id);
              const hasDetail = childSubs.length > 0 || t.notes || (Array.isArray(t.attachments) && t.attachments.length > 0) || t.description;
              const isOpen = expanded.has(t.id);
              const sc = STATUS_META[t.status ?? "not_started"] ?? STATUS_META.not_started;
              const pc = PRIORITY_META[t.priority ?? "Medium"] ?? PRIORITY_META.Medium;
              const projName = showProject && t.project_id ? projectMap?.get(t.project_id) : null;
              const tint = rowTint(t);
              const next = nextStatus(t.status);
              const areas = asAreas(t);
              const startD = t.actual_start ?? t.planned_start ?? t.start_date;
              const endD = t.actual_end ?? t.planned_end ?? t.due_date;
              const delayed = isDelayed(t);
              const early = isEarly(t);
              const delayDays = delayed && t.planned_end && t.actual_end
                ? Math.round((new Date(t.actual_end).getTime() - new Date(t.planned_end).getTime()) / 86400000)
                : 0;
              const earlyDays = early && t.planned_end && t.actual_end
                ? Math.round((new Date(t.planned_end).getTime() - new Date(t.actual_end).getTime()) / 86400000)
                : 0;

              return (
                <Fragment key={t.id}>
                  <tr className={`border-b border-border last:border-b-0 hover:bg-muted/10 transition-colors ${tint}`}>
                    <Td>
                      {hasDetail ? (
                        <button onClick={() => toggleExpand(t.id)} className="h-7 w-7 rounded-[6px] hover:bg-muted flex items-center justify-center">
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      ) : null}
                    </Td>
                    <Td>
                      <button
                        onClick={() => updateStatus(t, t.status === "done" ? "not_started" : "done")}
                        className={`h-5 w-5 rounded-[4px] border flex items-center justify-center transition-colors ${
                          t.done ? "bg-[#7a9e8a] border-[#7a9e8a] text-white" : "border-border bg-card hover:border-[#c17f5a]"
                        }`}
                      >
                        {t.done && <Check className="h-3 w-3" />}
                      </button>
                    </Td>
                    <Td>
                      <div className="py-3 min-w-[220px]">
                        <div className={`font-medium ${t.done ? "line-through text-muted-foreground" : ""}`}>{t.title}</div>
                        {t.work_type && <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{t.work_type}</div>}
                        {projName && <div className="text-[11px] text-muted-foreground mt-1">{projName}</div>}
                      </div>
                    </Td>
                    <Td>
                      <div className="min-w-[140px]">
                        <AgencyPicker
                          value={t.agency || t.contractor || t.assignee}
                          vendors={vendors}
                          teamMembers={teamMembers}
                          onChange={(v) => updateField(t, { agency: v, contractor: v })}
                        />
                      </div>
                    </Td>
                    <Td>
                      <PillPicker
                        value={(t.status ?? "not_started")}
                        options={STATUS_ORDER as unknown as readonly string[]}
                        format={(s) => STATUS_META[s]?.label ?? s}
                        onChange={(s) => updateStatus(t, s)}
                        bg={sc.bg}
                        fg={sc.fg}
                      />
                    </Td>
                    <Td>
                      <div className="min-w-[120px]">
                        <DateField
                          value={startD}
                          onChange={(v) => updateField(t, { planned_start: v, start_date: v })}
                        />
                      </div>
                    </Td>
                    <Td>
                      <div className="min-w-[120px]">
                        <DateField
                          value={endD}
                          onChange={(v) => updateField(t, { planned_end: v, due_date: v })}
                        />
                        {delayed && <div className="text-[10px] text-[#8a2a1f] font-medium mt-0.5">+{delayDays}d delayed</div>}
                        {early && <div className="text-[10px] text-[#4f6b5e] font-medium mt-0.5">{earlyDays}d early</div>}
                      </div>
                    </Td>
                    <Td>
                      <div className="min-w-[130px] space-y-1">
                        <DateField
                          value={t.ifr_date}
                          onChange={(v) => updateField(t, { ifr_date: v })}
                          placeholder="IFR —"
                          className="text-[#7a7a7a] h-7"
                        />
                        <DateField
                          value={t.ifa_date ?? null}
                          onChange={(v) => updateField(t, { ifa_date: v })}
                          placeholder="IFA —"
                          className="text-[#b8862a] h-7"
                        />
                        <DateField
                          value={t.ifc_date ?? null}
                          onChange={(v) => updateField(t, { ifc_date: v })}
                          placeholder="IFC —"
                          className="text-[#c17f5a] h-7"
                        />
                      </div>
                    </Td>
                    <Td>
                      <div className="min-w-[160px] max-w-[220px]">
                        <AreaPicker
                          value={areas}
                          rooms={rooms}
                          onChange={(v) => updateField(t, { areas: v, area: v[0] ?? null })}
                          onAddRoom={onAddRoom}
                        />
                      </div>
                    </Td>
                    <Td>
                      <PillPicker
                        value={(t.priority ?? "Medium")}
                        options={PRIORITIES as unknown as readonly string[]}
                        onChange={(p) => updateField(t, { priority: p })}
                        bg={pc.bg}
                        fg={pc.fg}
                      />
                    </Td>
                    <Td>
                      <div className="min-w-[160px]">
                        <DependencyPicker
                          allTasks={projectScopeTasks.filter((p) => p.id !== t.id && !p.parent_task_id)}
                          selected={deps}
                          onChange={(ids) => updateField(t, { depends_on: ids })}
                        />
                      </div>
                    </Td>
                    <Td>
                      <div className="min-w-[160px]">
                        <DependencyPicker
                          allTasks={projectScopeTasks.filter((p) => p.id !== t.id && !p.parent_task_id)}
                          selected={blocksIds}
                          onChange={(ids) => setBlocking(t, ids)}
                        />
                      </div>
                    </Td>
                    <Td>
                      <span className="text-xs text-muted-foreground line-clamp-2 max-w-[160px] block">
                        {t.notes || "—"}
                      </span>
                    </Td>
                    <Td>
                      {t.action_required ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-[6px] bg-[#c4685a22] text-[#8a2a1f] text-[10px] font-medium uppercase tracking-wider">
                          <AlertCircle className="h-3 w-3" /> Action
                        </span>
                      ) : next ? (
                        <button
                          onClick={() => updateStatus(t, next)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-[6px] hover:bg-muted text-[10px] text-muted-foreground uppercase tracking-wider"
                          title={`Advance to ${STATUS_META[next].label}`}
                        >
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      ) : null}
                    </Td>
                    <Td>
                      <button
                        onClick={() => setEditSheet(t)}
                        className="h-7 w-7 rounded-[6px] hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-[#c17f5a]"
                        title="Edit task"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </Td>
                  </tr>

                  {isOpen && hasDetail && (
                    <tr className="bg-muted/10 border-b border-border">
                      <td colSpan={15} className="px-6 py-5">
                        {t.action_required && t.action_label && (
                          <div className="mb-4 px-3 py-2 rounded-[8px] bg-[#c4685a18] border border-[#c4685a40] text-sm text-[#8a2a1f] flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" /> {t.action_label}
                          </div>
                        )}
                        <div className="grid md:grid-cols-3 gap-6">
                          {t.description && (
                            <div>
                              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Description</div>
                              <p className="text-sm leading-relaxed">{t.description}</p>
                            </div>
                          )}
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Planned vs Actual</div>
                            <div className="text-xs space-y-1 font-mono">
                              <div>Planned: {t.planned_start ?? "—"} → {t.planned_end ?? "—"}</div>
                              <div>Actual:  {t.actual_start ?? "—"} → {t.actual_end ?? "—"}</div>
                              {delayed && <div className="text-[#8a2a1f]">Delayed by {delayDays} day{delayDays === 1 ? "" : "s"}</div>}
                              {early && <div className="text-[#4f6b5e]">Completed {earlyDays} day{earlyDays === 1 ? "" : "s"} early</div>}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2 flex items-center gap-1.5">
                              <StickyNote className="h-3 w-3" /> Notes
                            </div>
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">
                              {t.notes || <span className="text-muted-foreground italic">No notes</span>}
                            </p>
                          </div>
                        </div>

                        {blockedBy.length > 0 && (
                          <div className="mt-5">
                            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Blocked by</div>
                            <ul className="text-sm space-y-1">
                              {blockedBy.map((b, i) => <li key={i} className="text-[#8a4a3f]">• {b}</li>)}
                            </ul>
                          </div>
                        )}

                        {blocks.length > 0 && (
                          <div className="mt-5">
                            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Blocking</div>
                            <ul className="text-sm space-y-1">
                              {blocks.map((b, i) => <li key={i} className="text-[#4f6b5e]">• {b}</li>)}
                            </ul>
                          </div>
                        )}

                        {Array.isArray(t.attachments) && (t.attachments as unknown[]).length > 0 && (
                          <div className="mt-5">
                            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2 flex items-center gap-1.5">
                              <Paperclip className="h-3 w-3" /> Attachments
                            </div>
                            <ul className="text-sm space-y-1">
                              {(t.attachments as { name?: string; url?: string }[]).map((a, i) => (
                                <li key={i}>
                                  {a.url
                                    ? <a href={a.url} target="_blank" rel="noreferrer" className="text-[#c17f5a] hover:underline">{a.name ?? a.url}</a>
                                    : <span>{a.name}</span>}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {childSubs.length > 0 && (
                          <div className="mt-5">
                            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-3">Sub-tasks</div>
                            <ul className="space-y-2">
                              {childSubs.map((s) => {
                                const ssc = STATUS_META[s.status ?? "not_started"] ?? STATUS_META.not_started;
                                return (
                                  <li key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-[8px] bg-card border border-border">
                                    <button
                                      onClick={() => updateStatus(s, s.status === "done" ? "not_started" : "done")}
                                      className={`h-4 w-4 rounded-[3px] border flex items-center justify-center ${
                                        s.done ? "bg-[#7a9e8a] border-[#7a9e8a] text-white" : "border-border"
                                      }`}
                                    >
                                      {s.done && <Check className="h-2.5 w-2.5" />}
                                    </button>
                                    <span className={`flex-1 text-sm ${s.done ? "line-through text-muted-foreground" : ""}`}>{s.title}</span>
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-[6px] text-[10px] uppercase tracking-wider font-mono font-medium"
                                      style={{ background: ssc.bg, color: ssc.fg }}>{ssc.label}</span>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        )}

                        {asAreas(t).includes("All") && (
                          <div className="mt-5">
                            <button
                              onClick={async () => {
                                try {
                                  const res = await splitFn({ data: { taskId: t.id } });
                                  toast.success(`Split into ${res.created} room tasks`);
                                  refresh();
                                } catch (e) {
                                  toast.error(e instanceof Error ? e.message : "Failed");
                                }
                              }}
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[8px] border border-[#c17f5a] text-[#c17f5a] text-xs hover:bg-[#c17f5a] hover:text-white transition-colors"
                            >
                              <SplitSquareVertical className="h-3.5 w-3.5" /> Split per room
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <TaskEditSheet
        task={editSheet}
        open={!!editSheet}
        onClose={() => setEditSheet(null)}
        onChanged={refresh}
        allTasks={projectScopeTasks}
        vendors={vendors}
        teamMembers={teamMembers}
        rooms={rooms}
        onAddRoom={onAddRoom ?? (() => {})}
      />
    </div>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`text-left px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-2 align-middle ${className}`}>{children}</td>;
}
