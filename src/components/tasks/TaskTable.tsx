import { Fragment, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ChevronRight, ChevronDown, Check, AlertCircle, Paperclip, StickyNote,
  ArrowRight, SplitSquareVertical, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  STATUS_META, STATUS_ORDER, PRIORITY_META, WORK_TYPES, rowTint, nextStatus,
} from "@/lib/task-flow";
import { cascadeDependents, splitTaskPerRoom } from "@/lib/task-ai.functions";

export type TaskRow = {
  id: string;
  project_id: string | null;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  area: string | null;
  contractor: string | null;
  assignee: string | null;
  work_type: string | null;
  vendor_id: string | null;
  start_date: string | null;
  due_date: string | null;
  ifr_date: string | null;
  ifr_type: string | null;
  done: boolean;
  notes: string | null;
  attachments: unknown;
  depends_on: unknown;
  action_required: boolean | null;
  action_label: string | null;
};

export function TaskTable({
  rows, projectMap, showProject = true, onChanged,
}: {
  rows: TaskRow[];
  projectMap?: Map<string, string>;
  showProject?: boolean;
  onChanged?: () => void;
}) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const cascade = useServerFn(cascadeDependents);
  const splitFn = useServerFn(splitTaskPerRoom);

  const titleById = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => m.set(r.id, r.title));
    return m;
  }, [rows]);

  // Reverse map: which tasks depend on this task (i.e. it blocks them)
  const blockingMap = useMemo(() => {
    const m = new Map<string, string[]>();
    rows.forEach((t) => {
      const deps = Array.isArray(t.depends_on) ? (t.depends_on as string[]) : [];
      deps.forEach((depId) => {
        const arr = m.get(depId) ?? [];
        arr.push(t.title);
        m.set(depId, arr);
      });
    });
    return m;
  }, [rows]);

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

  const updateStatus = async (t: TaskRow, status: string) => {
    const { error } = await supabase.from("tasks")
      .update({ status, done: status === "done", updated_at: new Date().toISOString() })
      .eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    refresh();
    if (t.project_id && (status === "done" || status === "material_delivered")) {
      try {
        const res = await cascade({ data: { taskId: t.id, projectId: t.project_id } });
        if (res.unblocked) toast.success(`${res.unblocked} dependent task${res.unblocked === 1 ? "" : "s"} unblocked`);
      } catch { /* swallow */ }
    }
  };

  const toggleExpand = (id: string) => {
    setExpanded((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  return (
    <div className="rounded-[16px] bg-card border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <Th className="w-10" />
              <Th className="w-10" />
              <Th>Description</Th>
              <Th>Agency</Th>
              <Th>Status</Th>
              <Th>Start</Th>
              <Th>End</Th>
              <Th>IFR/IFA/IFC</Th>
              <Th>Area</Th>
              <Th>Priority</Th>
              <Th>Blocked By</Th>
              <Th>Blocking</Th>
              <Th>Notes</Th>
              <Th>Action</Th>
            </tr>
          </thead>
          <tbody>
            {parents.map((t) => {
              const childSubs = subs.get(t.id) ?? [];
              const deps = Array.isArray(t.depends_on) ? (t.depends_on as string[]) : [];
              const blockedBy = deps.map((id) => titleById.get(id)).filter(Boolean);
              const hasDetail = childSubs.length > 0 || t.notes || (Array.isArray(t.attachments) && t.attachments.length > 0) || t.description || deps.length > 0;
              const isOpen = expanded.has(t.id);
              const sc = STATUS_META[t.status ?? "not_started"] ?? STATUS_META.not_started;
              const pc = PRIORITY_META[t.priority ?? "Medium"] ?? PRIORITY_META.Medium;
              const projName = showProject && t.project_id ? projectMap?.get(t.project_id) : null;
              const tint = rowTint(t);
              const next = nextStatus(t.status);

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
                    <Td><span className="text-xs">{t.contractor ?? t.assignee ?? "—"}</span></Td>
                    <Td>
                      <button
                        onClick={() => setEditing(editing === t.id ? null : t.id)}
                        className="inline-flex items-center gap-1"
                      >
                        <Tag bg={sc.bg} fg={sc.fg}>{sc.label}</Tag>
                      </button>
                    </Td>
                    <Td><span className="text-xs text-muted-foreground font-mono">{t.start_date ?? "—"}</span></Td>
                    <Td><span className="text-xs text-muted-foreground font-mono">{t.due_date ?? "—"}</span></Td>
                    <Td>
                      <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                        {t.ifr_date ? `${t.ifr_type ?? "IFR"} · ${t.ifr_date}` : "—"}
                      </span>
                    </Td>
                    <Td><span className="text-xs">{t.area ?? "—"}</span></Td>
                    <Td><Tag bg={pc.bg} fg={pc.fg}>{t.priority ?? "Medium"}</Tag></Td>
                    <Td>
                      {blockedBy.length > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[#8a4a3f]">
                          <AlertCircle className="h-3 w-3" />{blockedBy.length === 1 ? blockedBy[0] : `${blockedBy.length} tasks`}
                        </span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </Td>
                    <Td>
                      {(blockingMap.get(t.id) ?? []).length > 0 ? (
                        <span className="text-[11px] text-[#4f6b5e]">
                          {(blockingMap.get(t.id) ?? []).length === 1
                            ? blockingMap.get(t.id)![0]
                            : `${blockingMap.get(t.id)!.length} tasks`}
                        </span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </Td>
                    <Td>
                      <span className="text-xs text-muted-foreground line-clamp-2 max-w-[180px] block">
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
                  </tr>

                  {editing === t.id && (
                    <tr className="bg-[#fff7eb] border-b border-border">
                      <td colSpan={11} className="px-6 py-4">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Set status</div>
                        <div className="flex flex-wrap gap-2">
                          {STATUS_ORDER.map((s) => (
                            <button
                              key={s}
                              onClick={() => { updateStatus(t, s); setEditing(null); }}
                              className={`px-3 py-1.5 rounded-[6px] text-xs ${t.status === s ? "bg-[#1a1612] text-white" : "bg-card border border-border hover:border-[#c17f5a]"}`}
                            >
                              {STATUS_META[s].label}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}

                  {isOpen && hasDetail && (
                    <tr className="bg-muted/10 border-b border-border">
                      <td colSpan={11} className="px-6 py-5">
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
                            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2 flex items-center gap-1.5">
                              <StickyNote className="h-3 w-3" /> Notes
                            </div>
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">
                              {t.notes || <span className="text-muted-foreground italic">No notes</span>}
                            </p>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2 flex items-center gap-1.5">
                              <Paperclip className="h-3 w-3" /> Attachments
                            </div>
                            {Array.isArray(t.attachments) && (t.attachments as unknown[]).length > 0 ? (
                              <ul className="text-sm space-y-1">
                                {(t.attachments as { name?: string; url?: string }[]).map((a, i) => (
                                  <li key={i}>
                                    {a.url
                                      ? <a href={a.url} target="_blank" rel="noreferrer" className="text-[#c17f5a] hover:underline">{a.name ?? a.url}</a>
                                      : <span>{a.name}</span>}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <span className="text-sm text-muted-foreground italic">No attachments</span>
                            )}
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
                                    <Tag bg={ssc.bg} fg={ssc.fg}>{ssc.label}</Tag>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        )}

                        {t.area === "All" && (
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
    </div>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`text-left px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-2 align-middle ${className}`}>{children}</td>;
}
function Tag({ children, bg, fg }: { children: React.ReactNode; bg: string; fg: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-[6px] text-[10px] uppercase tracking-wider font-mono font-medium whitespace-nowrap"
      style={{ background: bg, color: fg }}>
      {children}
    </span>
  );
}
