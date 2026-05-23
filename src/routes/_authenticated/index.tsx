import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, ArrowUpRight, Clock, AlertTriangle, Clipboard, Sparkles,
  Flame, ListChecks, ArrowRight, CalendarDays, TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import {
  healthMap, computeHealth, type DbProject, type DbTask, type HealthKey,
} from "@/lib/db-types";
import { useAuth } from "@/lib/auth";
import { PendingApprovals } from "@/components/PendingApprovals";
import { PhotoStaging } from "@/components/PhotoStaging";
import { TodayFocus } from "@/components/tasks/TodayFocus";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Dashboard — PMStudio" },
      { name: "description", content: "Run every project, client, vendor and rupee from one premium command center." },
    ],
  }),
  component: Dashboard,
});

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function Dashboard() {
  const { user } = useAuth();

  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DbProject[];
    },
  });

  const tasksQuery = useQuery({
    queryKey: ["tasks", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as DbTask[];
    },
  });

  const meetingsQuery = useQuery({
    queryKey: ["meetings", "upcoming"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("meetings")
        .select("id,title,scheduled_at,location,project_id,client_id")
        .gte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(3);
      if (error) throw error;
      return data ?? [];
    },
  });

  const clientsQuery = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id,name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const projects = projectsQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];
  const openTasks = useMemo(() => tasks.filter((t) => !t.done), [tasks]);
  const meetings = meetingsQuery.data ?? [];
  const clients = clientsQuery.data ?? [];

  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const clientMap = useMemo(() => new Map(clients.map((c: any) => [c.id, c.name])), [clients]);

  const projectsWithHealth = useMemo(
    () =>
      projects.map((p) => {
        const t = openTasks.filter((tk) => tk.project_id === p.id);
        return { ...p, health: computeHealth(p, t) as HealthKey };
      }),
    [projects, openTasks],
  );

  const attention = projectsWithHealth.filter((p) => p.health !== "on-track").length;
  const firstName = profileQuery.data?.full_name?.split(" ")[0] ?? "there";

  const todayStr = new Date().toISOString().slice(0, 10);
  const fireAlerts: { project: DbProject; reason: string }[] = [];
  const overdueSnagsQuery = useQuery({
    queryKey: ["overdue-snags-dashboard"],
    queryFn: async () => {
      const { data } = await supabase
        .from("snags").select("id,project_id,description,room,contractor_name,target_fix_date,status")
        .in("status", ["open", "in_progress", "reopened"]);
      return data ?? [];
    },
  });
  projects.forEach((p) => {
    const overdueCount = openTasks.filter(
      (t) => t.project_id === p.id && t.due_date && t.due_date < todayStr,
    ).length;
    if (overdueCount > 0) {
      fireAlerts.push({ project: p, reason: `${overdueCount} overdue task${overdueCount === 1 ? "" : "s"}` });
    }
    const projSnags = (overdueSnagsQuery.data ?? []).filter((s) => s.project_id === p.id && s.target_fix_date && s.target_fix_date < todayStr);
    projSnags.forEach((s) => {
      const days = Math.max(1, Math.round((Date.now() - new Date(s.target_fix_date!).getTime()) / 86400000));
      fireAlerts.push({ project: p, reason: `Snag overdue ${days}d — ${s.description.slice(0, 40)}${s.contractor_name ? ` · ${s.contractor_name}` : ""}` });
    });
    if (p.expected_handover) {
      const hrs = (new Date(p.expected_handover).getTime() - Date.now()) / 3600000;
      if (hrs >= 0 && hrs <= 48) {
        fireAlerts.push({ project: p, reason: `Handover in ${Math.round(hrs)}h` });
      } else if (hrs < 0) {
        fireAlerts.push({ project: p, reason: `Handover overdue by ${Math.round(-hrs / 24)}d` });
      }
    }
  });

  const todaysFocus = [...openTasks]
    .sort((a, b) => {
      const aD = a.due_date || "9999";
      const bD = b.due_date || "9999";
      return aD.localeCompare(bD);
    })
    .slice(0, 3);

  // Weekly site update per active project
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const weekAhead = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);
  const weeklyUpdates = projects
    .filter((p) => p.phase !== "Handover")
    .slice(0, 4)
    .map((p) => {
      const projectTasks = tasks.filter((t) => t.project_id === p.id);
      const completedThisWeek = projectTasks.filter(
        (t) => t.done && t.updated_at && t.updated_at.slice(0, 10) >= weekAgo,
      );
      const plannedNextWeek = projectTasks.filter(
        (t) => !t.done && t.due_date && t.due_date >= todayStr && t.due_date <= weekAhead,
      );
      return { project: p, completed: completedThisWeek, planned: plannedNextWeek };
    });

  return (
    <AppShell>
      <main className="px-4 md:px-8 py-8 md:py-10 max-w-[1400px] w-full pb-24 md:pb-10">
        <div className="mb-10">
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-3">Dashboard</div>
          <h1 className="text-4xl md:text-5xl font-display">{greeting()}, {firstName}.</h1>
          <p className="text-muted-foreground mt-2 max-w-xl">
            {projects.length === 0
              ? "Your studio is set up. Create your first project to get started."
              : `${projects.length} project${projects.length === 1 ? "" : "s"} in motion.`}
          </p>
        </div>

        <section className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 mb-10">
          <StatCard icon={Clipboard} label="Active Projects" value={`${projects.length}`} accent="#c17f5a" />
          <StatCard icon={ListChecks} label="Open Tasks" value={`${openTasks.length}`} accent="#7a9e8a" />
          <StatCard icon={AlertTriangle} label="Need Attention" value={`${attention}`} accent="#c4685a" />
        </section>

        <TodayFocus />
        <PhotoStaging />
        <PendingApprovals />

        {fireAlerts.length > 0 && <FireAlertsCard alerts={fireAlerts} />}

        <TodaysFocusCard tasks={todaysFocus} projectMap={projectMap} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          <WeeklyUpdateCard updates={weeklyUpdates} />
          <UpcomingMeetingsCard meetings={meetings} projectMap={projectMap} clientMap={clientMap} onAdded={() => meetingsQuery.refetch()} projects={projects} clients={clients as any} />
        </div>

        <div className="flex items-baseline justify-between mb-5 mt-10">
          <h2 className="font-display text-2xl">Your Projects</h2>
          <Link to="/projects" className="text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground">
            View all
          </Link>
        </div>

        {projectsQuery.isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-[16px] bg-card border border-border h-64 animate-pulse" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <EmptyProjects />
        ) : (
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {projectsWithHealth.slice(0, 6).map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </section>
        )}
      </main>
    </AppShell>
  );
}

function WeeklyUpdateCard({ updates }: { updates: { project: DbProject; completed: DbTask[]; planned: DbTask[] }[] }) {
  return (
    <section className="rounded-[16px] bg-card border border-border p-5 md:p-6" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-2 mb-4">
        <div className="h-9 w-9 rounded-[10px] bg-[#7a9e8a]/15 text-[#7a9e8a] flex items-center justify-center">
          <TrendingUp className="h-4 w-4" />
        </div>
        <div>
          <h2 className="font-display text-xl">Weekly Site Update</h2>
          <p className="text-xs text-muted-foreground">Last 7 days · next 7 days, per active project</p>
        </div>
      </div>
      {updates.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No active projects yet.</p>
      ) : (
        <ul className="space-y-4">
          {updates.map((u) => (
            <li key={u.project.id} className="pb-3 border-b border-border last:border-b-0 last:pb-0">
              <Link to="/projects/$projectId" params={{ projectId: u.project.id }} className="font-medium text-sm hover:text-[#c17f5a]">
                {u.project.name}
              </Link>
              <div className="text-xs text-muted-foreground mt-1">Phase: {u.project.phase}</div>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[#7a9e8a] font-medium mb-1">Completed</div>
                  {u.completed.length === 0
                    ? <div className="text-muted-foreground">Nothing logged.</div>
                    : <ul className="space-y-0.5">{u.completed.slice(0, 3).map((t) => <li key={t.id} className="truncate">· {t.title}</li>)}</ul>}
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[#c17f5a] font-medium mb-1">Planned next</div>
                  {u.planned.length === 0
                    ? <div className="text-muted-foreground">Nothing scheduled.</div>
                    : <ul className="space-y-0.5">{u.planned.slice(0, 3).map((t) => <li key={t.id} className="truncate">· {t.title}</li>)}</ul>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function UpcomingMeetingsCard({
  meetings, projectMap, clientMap, onAdded, projects, clients,
}: {
  meetings: any[];
  projectMap: Map<string, DbProject>;
  clientMap: Map<string, string>;
  onAdded: () => void;
  projects: DbProject[];
  clients: { id: string; name: string }[];
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", scheduled_at: "", project_id: "", client_id: "", location: "" });

  const add = async () => {
    if (!user || !form.title || !form.scheduled_at) {
      toast.error("Title and date/time are required");
      return;
    }
    const { error } = await (supabase as any).from("meetings").insert({
      user_id: user.id,
      title: form.title,
      scheduled_at: new Date(form.scheduled_at).toISOString(),
      project_id: form.project_id || null,
      client_id: form.client_id || null,
      location: form.location || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Meeting added");
    setOpen(false);
    setForm({ title: "", scheduled_at: "", project_id: "", client_id: "", location: "" });
    onAdded();
  };

  return (
    <section className="rounded-[16px] bg-card border border-border p-5 md:p-6" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-[10px] bg-[#c17f5a]/15 text-[#c17f5a] flex items-center justify-center">
            <CalendarDays className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-xl">Upcoming Meetings</h2>
            <p className="text-xs text-muted-foreground">Next 3 scheduled</p>
          </div>
        </div>
        <button onClick={() => setOpen((v) => !v)} className="text-xs h-8 px-3 rounded-[6px] border border-border hover:bg-muted inline-flex items-center gap-1">
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>

      {open && (
        <div className="mb-4 p-3 rounded-[10px] bg-muted/40 border border-border space-y-2">
          <input className="w-full h-9 px-2 rounded-[6px] border border-border bg-card text-sm" placeholder="Title (e.g. Site walkthrough)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input type="datetime-local" className="w-full h-9 px-2 rounded-[6px] border border-border bg-card text-sm" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <select className="h-9 px-2 rounded-[6px] border border-border bg-card text-sm" value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
              <option value="">No project</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select className="h-9 px-2 rounded-[6px] border border-border bg-card text-sm" value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}>
              <option value="">No client</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <input className="w-full h-9 px-2 rounded-[6px] border border-border bg-card text-sm" placeholder="Location (optional)" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <div className="flex gap-2">
            <button onClick={add} className="h-8 px-3 rounded-[6px] bg-[#c17f5a] text-white text-xs">Save</button>
            <button onClick={() => setOpen(false)} className="h-8 px-3 rounded-[6px] border border-border text-xs">Cancel</button>
          </div>
        </div>
      )}

      {meetings.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No meetings scheduled.</p>
      ) : (
        <ul className="space-y-2">
          {meetings.map((m) => {
            const dt = new Date(m.scheduled_at);
            const dateStr = dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
            const timeStr = dt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
            const projectName = m.project_id ? projectMap.get(m.project_id)?.name : null;
            const clientName = m.client_id ? clientMap.get(m.client_id) : null;
            return (
              <li key={m.id} className="py-2.5 border-b border-border last:border-b-0">
                <div className="text-sm font-medium">{m.title}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {dateStr} · {timeStr}{clientName ? ` · ${clientName}` : ""}{projectName ? ` · ${projectName}` : ""}
                </div>
                {m.location && <div className="text-[11px] text-muted-foreground">📍 {m.location}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function FireAlertsCard({ alerts }: { alerts: { project: DbProject; reason: string }[] }) {
  return (
    <section
      className="mb-8 rounded-[16px] border-2 border-[#c4685a]/60 bg-[#fff5f2] p-5 md:p-6"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="h-9 w-9 rounded-[10px] bg-[#c4685a] text-white flex items-center justify-center">
          <Flame className="h-4 w-4" />
        </div>
        <div>
          <h2 className="font-display text-xl text-[#1a1612]">Fire Alerts</h2>
          <p className="text-xs text-[#7a3a30]">{alerts.length} item{alerts.length === 1 ? "" : "s"} need your attention now</p>
        </div>
      </div>
      <ul className="divide-y divide-[#c4685a]/20">
        {alerts.map((a, i) => (
          <li key={`${a.project.id}-${i}`}>
            <Link
              to="/projects/$projectId"
              params={{ projectId: a.project.id }}
              className="flex items-center justify-between py-3 group"
            >
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{a.project.name}</div>
                <div className="text-xs text-[#7a3a30] mt-0.5">{a.reason}</div>
              </div>
              <ArrowRight className="h-4 w-4 text-[#c4685a] opacity-60 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TodaysFocusCard({
  tasks,
  projectMap,
}: {
  tasks: DbTask[];
  projectMap: Map<string, DbProject>;
}) {
  const qc = useQueryClient();
  const toggle = useMutation({
    mutationFn: async (task: DbTask) => {
      const { error } = await supabase.from("tasks").update({ done: true }).eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks", "all"] });
      toast.success("Task completed");
    },
  });

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <section className="rounded-[16px] bg-card border border-border p-5 md:p-6 mb-2" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-[10px] bg-[#c17f5a]/15 text-[#c17f5a] flex items-center justify-center">
            <ListChecks className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-xl">Today's Focus</h2>
            <p className="text-xs text-muted-foreground">Top 3 urgent tasks across all projects</p>
          </div>
        </div>
      </div>
      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Nothing urgent. Plan something.</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => {
            const overdue = t.due_date && t.due_date < todayStr;
            const project = t.project_id ? projectMap.get(t.project_id) : null;
            return (
              <li key={t.id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-b-0">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#c17f5a]"
                  onChange={() => toggle.mutate(t)}
                  disabled={toggle.isPending}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{t.title}</div>
                  {project && (
                    <div className="text-[11px] text-muted-foreground truncate">{project.name}</div>
                  )}
                </div>
                {t.due_date && (
                  <span
                    className="text-[10px] uppercase tracking-wider font-mono px-2 py-1 rounded-[6px]"
                    style={{
                      background: overdue ? "#c4685a18" : "#7a9e8a18",
                      color: overdue ? "#c4685a" : "#7a9e8a",
                    }}
                  >
                    {overdue ? "Overdue" : t.due_date}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <article
      className="relative overflow-hidden rounded-[16px] bg-card border border-border p-5 md:p-6"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className="h-9 w-9 rounded-[10px] flex items-center justify-center"
          style={{ background: `${accent}18`, color: accent }}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="font-display text-[32px] leading-tight mt-1 tabular-nums">{value}</div>
      <div className="absolute bottom-0 inset-x-0 h-[3px]" style={{ background: accent }} />
    </article>
  );
}

export function ProjectCard({ project: p }: { project: DbProject & { health: HealthKey } }) {
  const h = healthMap[p.health];
  return (
    <Link
      to="/projects/$projectId"
      params={{ projectId: p.id }}
      className="group relative bg-card rounded-[16px] border border-border p-7 flex flex-col gap-5 overflow-hidden hover:-translate-y-[3px] hover:shadow-lg transition-[transform,box-shadow] duration-200"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <header className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: h.color }} />
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{h.label}</span>
        <span className="ml-auto text-[10px] uppercase tracking-wider px-2 py-1 rounded-[6px] bg-muted">{p.phase}</span>
      </header>
      <div>
        <h3 className="font-display text-xl leading-tight">{p.name}</h3>
        <p className="text-xs text-muted-foreground mt-1">{p.location || "—"}</p>
      </div>
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Completion</span>
          <span className="font-display text-2xl tabular-nums">{p.completion}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${p.completion}%`, background: "#c17f5a" }} />
        </div>
      </div>
      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#c17f5a] mt-auto">
        View project <ArrowUpRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}

function EmptyProjects() {
  return (
    <div className="rounded-[16px] border border-dashed border-border p-16 text-center">
      <div className="h-16 w-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
        <Sparkles className="h-6 w-6 text-[#c17f5a]" />
      </div>
      <h3 className="font-display text-2xl">Welcome to PMStudio</h3>
      <p className="text-muted-foreground mt-2 mb-6 max-w-md mx-auto">
        Create your first project — clients, vendors, finance and updates will all flow from here.
      </p>
      <Link
        to="/projects"
        className="inline-flex items-center gap-2 h-10 px-5 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95"
      >
        <Plus className="h-4 w-4" /> Create your first project
      </Link>
    </div>
  );
}
