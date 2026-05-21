import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight, ChevronDown, Paperclip, StickyNote, Loader2, Check,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks — PMStudio" },
      { name: "description", content: "All tasks across every project, grouped, filterable, and editable." },
    ],
  }),
  component: TasksPage,
});

type DbTask = {
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
  start_date: string | null;
  due_date: string | null;
  done: boolean;
  notes: string | null;
  attachments: unknown;
  depends_on: unknown;
};

type DbProj = { id: string; name: string };

// Decode legacy "[Priority] [Phase] title — description" titles.
function decode(t: DbTask) {
  const m = /^\[(High|Medium|Low)\]\s*(?:\[[^\]]*\]\s*)?(.*?)(?:\s+—\s+(.*))?$/.exec(t.title ?? "");
  return {
    title: m ? m[2] : t.title,
    priority: t.priority && t.priority !== "Medium" ? t.priority : (m?.[1] ?? t.priority ?? "Medium"),
    description: t.description ?? m?.[3] ?? null,
  };
}

const STATUS_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  todo:        { bg: "#d4882a18", fg: "#d4882a", label: "To Do" },
  in_progress: { bg: "#c17f5a22", fg: "#c17f5a", label: "In Progress" },
  blocked:     { bg: "#c4685a22", fg: "#c4685a", label: "Blocked" },
  done:        { bg: "#7a9e8a22", fg: "#7a9e8a", label: "Done" },
};

const PRIORITY_COLORS: Record<string, { bg: string; fg: string }> = {
  High:   { bg: "#c4685a22", fg: "#c4685a" },
  Medium: { bg: "#c17f5a22", fg: "#c17f5a" },
  Low:    { bg: "#7a9e8a22", fg: "#7a9e8a" },
};

function TasksPage() {
  const qc = useQueryClient();
  const [groupBy, setGroupBy] = useState<"contractor" | "status">("status");
  const [project, setProject] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [priority, setPriority] = useState<string>("all");
  const [contractor, setContractor] = useState<string>("all");

  const projects = useQuery({
    queryKey: ["projects-min"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id,name").order("name");
      return (data ?? []) as DbProj[];
    },
  });

  const tasks = useQuery({
    queryKey: ["all-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as DbTask[];
    },
  });

  const projectMap = useMemo(() => {
    const m = new Map<string, string>();
    (projects.data ?? []).forEach((p) => m.set(p.id, p.name));
    return m;
  }, [projects.data]);

  const rows = useMemo(() => (tasks.data ?? []).map((t) => ({ ...t, ...decode(t) })), [tasks.data]);

  // Only parent-level rows (sub-tasks render under their parent)
  const parents = useMemo(() => rows.filter((t) => !t.parent_task_id), [rows]);
  const subs = useMemo(() => {
    const m = new Map<string, typeof rows>();
    rows.forEach((t) => {
      if (t.parent_task_id) {
        const arr = m.get(t.parent_task_id) ?? [];
        arr.push(t);
        m.set(t.parent_task_id, arr);
      }
    });
    return m;
  }, [rows]);

  const contractors = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((t) => { if (t.contractor) s.add(t.contractor); else if (t.assignee) s.add(t.assignee); });
    return Array.from(s).sort();
  }, [rows]);

  const filtered = useMemo(() => parents.filter((t) => {
    if (project !== "all" && t.project_id !== project) return false;
    const eff = (t.status ?? (t.done ? "done" : "todo"));
    if (status !== "all" && eff !== status) return false;
    if (priority !== "all" && (t.priority ?? "Medium") !== priority) return false;
    const c = t.contractor ?? t.assignee ?? "";
    if (contractor !== "all" && c !== contractor) return false;
    return true;
  }), [parents, project, status, priority, contractor]);

  const groups = useMemo(() => {
    const m = new Map<string, typeof filtered>();
    filtered.forEach((t) => {
      const key = groupBy === "contractor"
        ? (t.contractor ?? t.assignee ?? "Unassigned")
        : STATUS_COLORS[t.status ?? (t.done ? "done" : "todo")]?.label ?? "To Do";
      const arr = m.get(key) ?? [];
      arr.push(t);
      m.set(key, arr);
    });
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, groupBy]);

  return (
    <AppShell>
      <main className="px-4 md:px-10 py-8 md:py-12 max-w-[1400px] w-full pb-24 md:pb-12">
        <header className="mb-10">
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-3">All Projects</div>
          <h1 className="font-display text-4xl md:text-5xl leading-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground mt-3 max-w-2xl">
            Every task across every project — table view with filters, grouping, and expandable detail.
          </p>
        </header>

        {/* Filter bar */}
        <div className="rounded-[16px] bg-card border border-border p-5 md:p-6 mb-8" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Select label="Project" value={project} onChange={setProject}
              options={[{ v: "all", l: "All Projects" }, ...(projects.data ?? []).map((p) => ({ v: p.id, l: p.name }))]} />
            <Select label="Status" value={status} onChange={setStatus}
              options={[{ v: "all", l: "All" }, ...Object.entries(STATUS_COLORS).map(([v, c]) => ({ v, l: c.label }))]} />
            <Select label="Priority" value={priority} onChange={setPriority}
              options={[{ v: "all", l: "All" }, { v: "High", l: "High" }, { v: "Medium", l: "Medium" }, { v: "Low", l: "Low" }]} />
            <Select label="Contractor" value={contractor} onChange={setContractor}
              options={[{ v: "all", l: "All" }, ...contractors.map((c) => ({ v: c, l: c }))]} />
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Group By</div>
              <div className="flex gap-1">
                {(["status", "contractor"] as const).map((g) => (
                  <button key={g} onClick={() => setGroupBy(g)}
                    className={`h-10 px-4 rounded-[8px] text-xs font-medium capitalize ${groupBy === g ? "bg-[#1a1612] text-white" : "border border-border bg-card hover:bg-muted"}`}>
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Groups */}
        {tasks.isLoading ? (
          <div className="py-20 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : groups.length === 0 ? (
          <div className="py-20 text-center text-sm text-muted-foreground">No tasks match these filters.</div>
        ) : (
          <div className="space-y-10">
            {groups.map(([groupKey, items]) => (
              <section key={groupKey}>
                <div className="flex items-baseline justify-between mb-4">
                  <h2 className="font-display text-2xl">{groupKey}</h2>
                  <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-mono">{items.length} task{items.length === 1 ? "" : "s"}</span>
                </div>
                <TaskTable
                  rows={items}
                  subs={subs}
                  projectMap={projectMap}
                  onToggleDone={async (t) => {
                    const next = !t.done;
                    const { error } = await supabase.from("tasks")
                      .update({ done: next, status: next ? "done" : "todo" })
                      .eq("id", t.id);
                    if (error) { toast.error(error.message); return; }
                    qc.invalidateQueries({ queryKey: ["all-tasks"] });
                  }}
                />
              </section>
            ))}
          </div>
        )}
      </main>
    </AppShell>
  );
}

function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 px-3 rounded-[8px] bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring/30">
        {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}

function TaskTable({
  rows, subs, projectMap, onToggleDone,
}: {
  rows: (DbTask & { title: string; priority: string; description: string | null })[];
  subs: Map<string, (DbTask & { title: string; priority: string; description: string | null })[]>;
  projectMap: Map<string, string>;
  onToggleDone: (t: DbTask) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) => {
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
              <Th className="w-10"></Th>
              <Th className="w-10"></Th>
              <Th>Description</Th>
              <Th>Status</Th>
              <Th>Start</Th>
              <Th>End</Th>
              <Th>Area / Room</Th>
              <Th>Priority</Th>
              <Th>Contractor</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const childSubs = subs.get(t.id) ?? [];
              const hasDetail = childSubs.length > 0 || t.notes || (Array.isArray(t.attachments) && t.attachments.length > 0) || t.description;
              const isOpen = expanded.has(t.id);
              const eff = (t.status ?? (t.done ? "done" : "todo"));
              const sc = STATUS_COLORS[eff] ?? STATUS_COLORS.todo;
              const pc = PRIORITY_COLORS[t.priority] ?? PRIORITY_COLORS.Medium;
              const projName = t.project_id ? projectMap.get(t.project_id) : null;
              return (
                <FragmentRow key={t.id}>
                  <tr className="border-b border-border last:border-b-0 hover:bg-muted/20 transition-colors">
                    <Td>
                      {hasDetail ? (
                        <button onClick={() => toggle(t.id)} className="h-7 w-7 rounded-[6px] hover:bg-muted flex items-center justify-center">
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      ) : null}
                    </Td>
                    <Td>
                      <button onClick={() => onToggleDone(t)}
                        className={`h-5 w-5 rounded-[4px] border flex items-center justify-center ${t.done ? "bg-[#7a9e8a] border-[#7a9e8a] text-white" : "border-border bg-card hover:border-[#c17f5a]"}`}>
                        {t.done && <Check className="h-3 w-3" />}
                      </button>
                    </Td>
                    <Td>
                      <div className="py-3">
                        <div className={`font-medium ${t.done ? "line-through text-muted-foreground" : ""}`}>{t.title}</div>
                        {projName && <div className="text-[11px] text-muted-foreground mt-1">{projName}</div>}
                      </div>
                    </Td>
                    <Td><Tag bg={sc.bg} fg={sc.fg}>{sc.label}</Tag></Td>
                    <Td><span className="text-xs text-muted-foreground font-mono">{t.start_date ?? "—"}</span></Td>
                    <Td><span className="text-xs text-muted-foreground font-mono">{t.due_date ?? "—"}</span></Td>
                    <Td><span className="text-xs">{t.area ?? "—"}</span></Td>
                    <Td><Tag bg={pc.bg} fg={pc.fg}>{t.priority}</Tag></Td>
                    <Td><span className="text-xs">{t.contractor ?? t.assignee ?? "—"}</span></Td>
                  </tr>
                  {isOpen && hasDetail && (
                    <tr className="bg-muted/10 border-b border-border">
                      <td colSpan={9} className="px-6 py-5">
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
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{t.notes || <span className="text-muted-foreground italic">No notes</span>}</p>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2 flex items-center gap-1.5">
                              <Paperclip className="h-3 w-3" /> Attachments
                            </div>
                            {Array.isArray(t.attachments) && t.attachments.length > 0 ? (
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
                        {childSubs.length > 0 && (
                          <div className="mt-6">
                            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-3">Sub-tasks</div>
                            <ul className="space-y-2">
                              {childSubs.map((s) => {
                                const ssc = STATUS_COLORS[s.status ?? (s.done ? "done" : "todo")] ?? STATUS_COLORS.todo;
                                return (
                                  <li key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-[8px] bg-card border border-border">
                                    <button onClick={() => onToggleDone(s)}
                                      className={`h-4 w-4 rounded-[3px] border flex items-center justify-center ${s.done ? "bg-[#7a9e8a] border-[#7a9e8a] text-white" : "border-border"}`}>
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
                      </td>
                    </tr>
                  )}
                </FragmentRow>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`text-left px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium ${className}`}>{children}</th>
  );
}
function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-2 align-middle ${className}`}>{children}</td>;
}
function Tag({ children, bg, fg }: { children: React.ReactNode; bg: string; fg: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-[6px] text-[10px] uppercase tracking-wider font-mono font-medium"
      style={{ background: bg, color: fg }}>
      {children}
    </span>
  );
}
