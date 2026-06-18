import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, ArrowUpRight, AlertTriangle, Sparkles,
  Flame, ListChecks, ArrowRight, CalendarDays, TrendingUp,
  IndianRupee, Activity, Flag, ClipboardCheck,
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
import { MorningBriefing } from "@/components/dashboard/MorningBriefing";
import { StudioCommandBar } from "@/components/dashboard/StudioCommandBar";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Studio — PMStudio" },
      { name: "description", content: "The studio command centre — projects, priorities, intelligence and finances in one calm view." },
    ],
  }),
  component: Dashboard,
});

// ────────────────────────────────────────────────────────────────────────
// Currency helpers
// ────────────────────────────────────────────────────────────────────────
const inr = (n: number) => {
  if (!n) return "₹0";
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(n >= 100000000 ? 0 : 1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(n >= 1000000 ? 0 : 1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}k`;
  return `₹${Math.round(n)}`;
};

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
      const { data, error } = await supabase.from("projects").select("*").is("deleted_at", null).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DbProject[];
    },
  });

  const tasksQuery = useQuery({
    queryKey: ["tasks", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").order("due_date", { ascending: true, nullsFirst: false });
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

  const milestonesQuery = useQuery({
    queryKey: ["milestones", "upcoming-by-project"],
    queryFn: async () => {
      const { data } = await supabase
        .from("milestones")
        .select("id,project_id,name,status,order_index,triggered_at")
        .neq("status", "paid")
        .order("order_index", { ascending: true });
      return data ?? [];
    },
  });

  const invoicesQuery = useQuery({
    queryKey: ["invoices", "dashboard"],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("id,number,project_id,client_id,amount,status,due_at,sent_at,milestone")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const activityQuery = useQuery({
    queryKey: ["activity", "dashboard"],
    queryFn: async () => {
      const [appr, pay, tasks] = await Promise.all([
        supabase.from("approvals").select("id,title,status,project_id,approved_at,updated_at,created_at").order("updated_at", { ascending: false }).limit(15),
        supabase.from("payment_requests").select("id,amount,scope,project_id,vendor_id,status,created_at,updated_at").order("updated_at", { ascending: false }).limit(15),
        supabase.from("tasks").select("id,title,project_id,updated_at,work_type,agency").eq("done", true).order("updated_at", { ascending: false }).limit(15),
      ]);
      return { appr: appr.data ?? [], pay: pay.data ?? [], tasks: tasks.data ?? [] };
    },
  });

  const projects = projectsQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];
  const openTasks = useMemo(() => tasks.filter((t) => !t.done), [tasks]);
  const meetings = meetingsQuery.data ?? [];
  const clients = clientsQuery.data ?? [];
  const milestones = milestonesQuery.data ?? [];
  const invoices = invoicesQuery.data ?? [];

  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const clientMap = useMemo(() => new Map(clients.map((c: any) => [c.id, c.name])), [clients]);
  const nextMilestoneMap = useMemo(() => {
    const m = new Map<string, string>();
    milestones.forEach((ms: any) => {
      if (!m.has(ms.project_id)) m.set(ms.project_id, ms.name);
    });
    return m;
  }, [milestones]);

  const projectsWithMeta = useMemo(
    () =>
      projects.map((p) => {
        const t = openTasks.filter((tk) => tk.project_id === p.id);
        return {
          ...p,
          health: computeHealth(p, t) as HealthKey,
          clientName: p.client_id ? clientMap.get(p.client_id) || null : null,
          nextMilestone: nextMilestoneMap.get(p.id) || null,
        };
      }),
    [projects, openTasks, clientMap, nextMilestoneMap],
  );

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
    .sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999"))
    .slice(0, 5);

  // ── Studio Intelligence: per-project weekly update
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const weekAhead = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const weeklyUpdates = projects
    .filter((p) => p.phase !== "Handover")
    .slice(0, 4)
    .map((p) => {
      const projectTasks = tasks.filter((t) => t.project_id === p.id);
      return {
        project: p,
        completed: projectTasks.filter((t) => t.done && t.updated_at && t.updated_at.slice(0, 10) >= weekAgo),
        planned: projectTasks.filter((t) => !t.done && t.due_date && t.due_date >= todayStr && t.due_date <= weekAhead),
      };
    });

  // ── Financial Snapshot aggregates
  const finance = useMemo(() => {
    const totalBudget = projects.reduce((s, p) => s + Number(p.budget || 0), 0);
    const totalSpent = projects.reduce((s, p) => s + Number(p.spent || 0), 0);
    const outstanding = invoices
      .filter((i: any) => i.status !== "paid" && i.status !== "draft")
      .reduce((s, i: any) => s + Number(i.amount || 0), 0);
    const overdue = invoices.filter(
      (i: any) => i.status !== "paid" && i.due_at && i.due_at < todayStr,
    );
    const recent = invoices.slice(0, 4);
    return { totalBudget, totalSpent, outstanding, overdue, recent };
  }, [projects, invoices, todayStr]);

  // ── Recent Activity — merge & sort
  const recentActivity = useMemo(() => {
    const acts: { id: string; ts: string; label: string; meta: string; projectId: string | null; tone: string; icon: any }[] = [];
    (activityQuery.data?.appr ?? []).forEach((a: any) => {
      acts.push({
        id: `appr-${a.id}`,
        ts: a.approved_at ?? a.updated_at ?? a.created_at,
        label: a.status === "approved" ? `Approved — ${a.title}` : `Approval requested — ${a.title}`,
        meta: a.status === "approved" ? "Approval" : "Pending",
        projectId: a.project_id,
        tone: a.status === "approved" ? "#7a9e8a" : "#d4882a",
        icon: ClipboardCheck,
      });
    });
    (activityQuery.data?.pay ?? []).forEach((p: any) => {
      acts.push({
        id: `pay-${p.id}`,
        ts: p.updated_at ?? p.created_at,
        label: `Payment ${p.status} — ${inr(Number(p.amount || 0))}${p.scope ? ` · ${p.scope}` : ""}`,
        meta: "Payment",
        projectId: p.project_id,
        tone: "#c17f5a",
        icon: IndianRupee,
      });
    });
    (activityQuery.data?.tasks ?? []).forEach((t: any) => {
      acts.push({
        id: `task-${t.id}`,
        ts: t.updated_at,
        label: `Task completed — ${t.title}`,
        meta: t.work_type || "Task",
        projectId: t.project_id,
        tone: "#7a9e8a",
        icon: ListChecks,
      });
    });
    return acts.sort((a, b) => (b.ts || "").localeCompare(a.ts || "")).slice(0, 8);
  }, [activityQuery.data]);

  return (
    <AppShell>
      <main className="px-5 md:px-14 py-10 md:py-16 max-w-[1340px] w-full pb-24 md:pb-20">

        {/* 1. MORNING BRIEFING */}
        <SectionLabel eyebrow="01 — Briefing" title="Morning Briefing" subtitle="What needs your attention before the studio opens." />
        <MorningBriefing projects={projects} tasks={tasks} firstName={firstName} />

        {/* 2. TODAY'S PRIORITIES */}
        <SectionLabel eyebrow="02 — Today" title="Today's Priorities" subtitle="Fires to put out, tasks to ship, conversations to have." />
        {fireAlerts.length > 0 && <FireAlertsCard alerts={fireAlerts} />}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-7">
          <div className="lg:col-span-2">
            <TodaysFocusCard tasks={todaysFocus} projectMap={projectMap} />
          </div>
          <UpcomingMeetingsCard
            meetings={meetings}
            projectMap={projectMap}
            clientMap={clientMap}
            onAdded={() => meetingsQuery.refetch()}
            projects={projects}
            clients={clients as any}
          />
        </div>

        {/* 3. ACTIVE PROJECTS */}
        <SectionLabel
          eyebrow="03 — Portfolio"
          title="Active Projects"
          subtitle={`${projects.length} live · ${projectsWithMeta.filter((p) => p.health !== "on-track").length} need attention`}
          rightSlot={
            <Link to="/projects" className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground link-underline pb-1">
              View all
            </Link>
          }
        />
        {projectsQuery.isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-7">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-[20px] bg-card h-72 animate-pulse" style={{ boxShadow: "var(--shadow-card)" }} />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <EmptyProjects />
        ) : (
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-7">
            {projectsWithMeta.slice(0, 6).map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </section>
        )}

        {/* 4. STUDIO INTELLIGENCE */}
        <SectionLabel eyebrow="04 — Intelligence" title="Studio Intelligence" subtitle="Weekly motion, approvals in flight, and photos awaiting tags." />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-7">
          <WeeklyUpdateCard updates={weeklyUpdates} />
          <div className="space-y-7">
            <div className="rounded-[20px] bg-card p-7 md:p-8" style={{ boxShadow: "var(--shadow-card)" }}>
              <PendingApprovals />
            </div>
            <div className="rounded-[20px] bg-card p-7 md:p-8" style={{ boxShadow: "var(--shadow-card)" }}>
              <PhotoStaging />
            </div>
          </div>
        </div>

        {/* 5. FINANCIAL SNAPSHOT */}
        <SectionLabel
          eyebrow="05 — Finance"
          title="Financial Snapshot"
          subtitle="Portfolio budget, money in motion, and what's outstanding."
          rightSlot={
            <Link to="/finance" className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground link-underline pb-1">
              Open finance
            </Link>
          }
        />
        <FinancialSnapshot finance={finance} projectMap={projectMap} clientMap={clientMap} />

        {/* 6. RECENT ACTIVITY */}
        <SectionLabel eyebrow="06 — Activity" title="Recent Activity" subtitle="The studio's pulse, across every project." />
        <RecentActivityFeed items={recentActivity} projectMap={projectMap} />

      </main>
    </AppShell>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Section header — eyebrow + serif title + helper line
// ────────────────────────────────────────────────────────────────────────
function SectionLabel({
  eyebrow, title, subtitle, rightSlot,
}: { eyebrow: string; title: string; subtitle?: string; rightSlot?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-6 mt-20 first:mt-0 mb-8">
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.28em] text-[#c17f5a] mb-3">{eyebrow}</div>
        <h2 className="font-display text-[34px] md:text-[40px] leading-[1.05] tracking-[-0.01em]">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-2 italic font-display">{subtitle}</p>}
      </div>
      {rightSlot && <div className="shrink-0 pb-1.5">{rightSlot}</div>}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Today's Focus
// ────────────────────────────────────────────────────────────────────────
function TodaysFocusCard({
  tasks, projectMap,
}: { tasks: DbTask[]; projectMap: Map<string, DbProject> }) {
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
    <section className="rounded-[20px] bg-card p-7 md:p-9 h-full" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-3 mb-7">
        <div className="h-10 w-10 rounded-[12px] bg-[#c17f5a]/12 text-[#c17f5a] flex items-center justify-center">
          <ListChecks className="h-4 w-4" />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-1">Focus</div>
          <h3 className="font-display text-2xl leading-none">Top tasks across all projects</h3>
        </div>
      </div>
      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center italic">Nothing urgent. Plan something.</p>
      ) : (
        <ul className="space-y-1">
          {tasks.map((t) => {
            const overdue = t.due_date && t.due_date < todayStr;
            const project = t.project_id ? projectMap.get(t.project_id) : null;
            return (
              <li key={t.id} className="flex items-center gap-4 py-3.5 group">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#c17f5a] shrink-0"
                  onChange={() => toggle.mutate(t)}
                  disabled={toggle.isPending}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate">{t.title}</div>
                  {project && (
                    <div className="font-display text-[12px] text-muted-foreground truncate mt-0.5 italic">{project.name}</div>
                  )}
                </div>
                {t.due_date && (
                  <span className="text-[10px] uppercase tracking-[0.15em] font-medium shrink-0"
                    style={{ color: overdue ? "#c4685a" : "#7a9e8a" }}>
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

// ────────────────────────────────────────────────────────────────────────
// Upcoming Meetings
// ────────────────────────────────────────────────────────────────────────
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
    if (!user || !form.title || !form.scheduled_at) { toast.error("Title and date/time are required"); return; }
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
    <section className="rounded-[20px] bg-card p-7 md:p-9 h-full" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-start justify-between gap-3 mb-7">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-[12px] bg-[#7a9e8a]/14 text-[#7a9e8a] flex items-center justify-center">
            <CalendarDays className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-1">Calendar</div>
            <h3 className="font-display text-2xl leading-none">Upcoming meetings</h3>
          </div>
        </div>
        <button onClick={() => setOpen((v) => !v)} className="text-[11px] uppercase tracking-[0.18em] h-8 px-3 rounded-full bg-muted/60 hover:bg-muted inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>

      {open && (
        <div className="mb-6 p-4 rounded-[14px] bg-muted/40 space-y-2.5">
          <input className="w-full h-9 px-3 rounded-[8px] bg-card text-sm" placeholder="Title (e.g. Site walkthrough)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input type="datetime-local" className="w-full h-9 px-3 rounded-[8px] bg-card text-sm" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <select className="h-9 px-3 rounded-[8px] bg-card text-sm" value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
              <option value="">No project</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select className="h-9 px-3 rounded-[8px] bg-card text-sm" value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}>
              <option value="">No client</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <input className="w-full h-9 px-3 rounded-[8px] bg-card text-sm" placeholder="Location (optional)" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <div className="flex gap-2 pt-1">
            <button onClick={add} className="h-9 px-4 rounded-full bg-[#c17f5a] text-white text-xs uppercase tracking-[0.15em]">Save</button>
            <button onClick={() => setOpen(false)} className="h-9 px-4 rounded-full bg-muted text-xs uppercase tracking-[0.15em] text-muted-foreground">Cancel</button>
          </div>
        </div>
      )}

      {meetings.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center italic">No meetings scheduled.</p>
      ) : (
        <ul className="space-y-6">
          {meetings.map((m) => {
            const dt = new Date(m.scheduled_at);
            const timeStr = dt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
            const monthStr = dt.toLocaleDateString(undefined, { month: "short" });
            const projectName = m.project_id ? projectMap.get(m.project_id)?.name : null;
            const clientName = m.client_id ? clientMap.get(m.client_id) : null;
            return (
              <li key={m.id} className="flex gap-5">
                <div className="shrink-0 w-14 text-center">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{monthStr}</div>
                  <div className="font-display text-2xl leading-none mt-1">{dt.getDate()}</div>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mt-1.5">{timeStr}</div>
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="font-display text-lg leading-tight">{m.title}</div>
                  <div className="text-[11px] text-muted-foreground mt-1.5">
                    {[clientName, projectName].filter(Boolean).join(" · ") || "—"}
                  </div>
                  {m.location && <div className="text-[11px] text-muted-foreground mt-0.5">{m.location}</div>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Fire Alerts
// ────────────────────────────────────────────────────────────────────────
function FireAlertsCard({ alerts }: { alerts: { project: DbProject; reason: string }[] }) {
  return (
    <section className="mb-7 rounded-[20px] bg-[#fbf3ef] p-7 md:p-9" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-[12px] bg-[#c4685a]/15 text-[#c4685a] flex items-center justify-center">
          <Flame className="h-4 w-4" />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-[#c4685a] mb-1">Fires</div>
          <h3 className="font-display text-2xl text-[#1a1612] leading-none">Needs you now</h3>
        </div>
      </div>
      <ul className="space-y-0.5">
        {alerts.slice(0, 6).map((a, i) => (
          <li key={`${a.project.id}-${i}`}>
            <Link to="/projects/$projectId" params={{ projectId: a.project.id }}
              className="flex items-center justify-between py-3 px-2 rounded-[12px] group hover:bg-white/60 transition-all">
              <div className="min-w-0">
                <div className="font-display text-lg truncate leading-tight">{a.project.name}</div>
                <div className="text-xs text-[#7a3a30] mt-1">{a.reason}</div>
              </div>
              <ArrowRight className="h-4 w-4 text-[#c4685a] opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Weekly Update (Studio Intelligence)
// ────────────────────────────────────────────────────────────────────────
function WeeklyUpdateCard({ updates }: { updates: { project: DbProject; completed: DbTask[]; planned: DbTask[] }[] }) {
  return (
    <section className="rounded-[20px] bg-card p-7 md:p-9" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-3 mb-7">
        <div className="h-10 w-10 rounded-[12px] bg-[#7a9e8a]/14 text-[#7a9e8a] flex items-center justify-center">
          <TrendingUp className="h-4 w-4" />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-1">This week</div>
          <h3 className="font-display text-2xl leading-none">Weekly site motion</h3>
        </div>
      </div>
      {updates.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center italic">No active projects yet.</p>
      ) : (
        <ul className="space-y-8">
          {updates.map((u) => (
            <li key={u.project.id}>
              <Link to="/projects/$projectId" params={{ projectId: u.project.id }} className="font-display text-xl leading-tight hover:text-[#c17f5a] transition-colors">
                {u.project.name}
              </Link>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-1.5">{u.project.phase}</div>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#7a9e8a] mb-2">Completed</div>
                  {u.completed.length === 0
                    ? <div className="text-muted-foreground text-xs italic">Nothing logged.</div>
                    : <ul className="space-y-1.5 text-xs">{u.completed.slice(0, 3).map((t) => <li key={t.id} className="truncate text-foreground/80">{t.title}</li>)}</ul>}
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#c17f5a] mb-2">Planned next</div>
                  {u.planned.length === 0
                    ? <div className="text-muted-foreground text-xs italic">Nothing scheduled.</div>
                    : <ul className="space-y-1.5 text-xs">{u.planned.slice(0, 3).map((t) => <li key={t.id} className="truncate text-foreground/80">{t.title}</li>)}</ul>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Financial Snapshot
// ────────────────────────────────────────────────────────────────────────
function FinancialSnapshot({
  finance, projectMap, clientMap,
}: {
  finance: { totalBudget: number; totalSpent: number; outstanding: number; overdue: any[]; recent: any[] };
  projectMap: Map<string, DbProject>;
  clientMap: Map<string, string>;
}) {
  const utilization = finance.totalBudget > 0 ? Math.min(100, (finance.totalSpent / finance.totalBudget) * 100) : 0;
  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-7">
      {/* Aggregate tile */}
      <div className="lg:col-span-2 rounded-[20px] bg-card p-7 md:p-9" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center gap-3 mb-7">
          <div className="h-10 w-10 rounded-[12px] bg-[#c17f5a]/12 text-[#c17f5a] flex items-center justify-center">
            <IndianRupee className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-1">Portfolio</div>
            <h3 className="font-display text-2xl leading-none">Budget &amp; spend</h3>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-6 mb-8">
          <FinanceFigure label="Total budget" value={inr(finance.totalBudget)} />
          <FinanceFigure label="Spent" value={inr(finance.totalSpent)} accent="#c17f5a" />
          <FinanceFigure label="Outstanding" value={inr(finance.outstanding)} accent={finance.overdue.length ? "#c4685a" : "#7a9e8a"} />
        </div>
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Portfolio utilization</span>
            <span className="font-display text-lg tabular-nums">{Math.round(utilization)}%</span>
          </div>
          <div className="h-[3px] rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${utilization}%`, background: utilization > 90 ? "#c4685a" : "#c17f5a" }} />
          </div>
          {finance.overdue.length > 0 && (
            <div className="text-xs text-[#c4685a] mt-3 italic">
              {finance.overdue.length} invoice{finance.overdue.length === 1 ? "" : "s"} overdue
            </div>
          )}
        </div>
      </div>

      {/* Recent invoices */}
      <div className="rounded-[20px] bg-card p-7 md:p-9" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-1">Invoices</div>
        <h3 className="font-display text-2xl leading-none mb-6">Recent</h3>
        {finance.recent.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center italic">No invoices yet.</p>
        ) : (
          <ul className="space-y-5">
            {finance.recent.map((inv: any) => {
              const project = inv.project_id ? projectMap.get(inv.project_id) : null;
              const client = inv.client_id ? clientMap.get(inv.client_id) : null;
              const statusColor = inv.status === "paid" ? "#7a9e8a"
                : inv.status === "overdue" ? "#c4685a"
                : inv.status === "sent" ? "#c17f5a"
                : "#6b5f58";
              return (
                <li key={inv.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-base leading-tight truncate">
                      {project?.name || inv.milestone || inv.number || "Invoice"}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1 truncate">
                      {client || "—"}{inv.due_at ? ` · due ${inv.due_at}` : ""}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-display text-base tabular-nums">{inr(Number(inv.amount || 0))}</div>
                    <div className="text-[10px] uppercase tracking-[0.15em] mt-1" style={{ color: statusColor }}>{inv.status}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function FinanceFigure({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-2">{label}</div>
      <div className="font-display text-[36px] leading-none tabular-nums" style={accent ? { color: accent } : undefined}>{value}</div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Recent Activity
// ────────────────────────────────────────────────────────────────────────
function RecentActivityFeed({
  items, projectMap,
}: {
  items: { id: string; ts: string; label: string; meta: string; projectId: string | null; tone: string; icon: any }[];
  projectMap: Map<string, DbProject>;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-[20px] bg-card p-12 text-center" style={{ boxShadow: "var(--shadow-card)" }}>
        <Activity className="h-6 w-6 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground italic">No activity recorded yet.</p>
      </div>
    );
  }
  return (
    <section className="rounded-[20px] bg-card p-7 md:p-10" style={{ boxShadow: "var(--shadow-card)" }}>
      <ul className="relative">
        {/* Vertical thread */}
        <div className="absolute left-[19px] top-2 bottom-2 w-px bg-border/60" aria-hidden />
        {items.map((it) => {
          const project = it.projectId ? projectMap.get(it.projectId) : null;
          const Icon = it.icon;
          const ts = it.ts ? new Date(it.ts) : null;
          const tsLabel = ts ? ts.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
          const inner = (
            <div className="relative flex items-start gap-5 py-4 group">
              <div className="relative z-10 h-10 w-10 rounded-full bg-card shrink-0 flex items-center justify-center"
                style={{ boxShadow: `inset 0 0 0 1px ${it.tone}33`, color: it.tone }}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <div className="text-sm leading-snug">{it.label}</div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  <span className="uppercase tracking-[0.15em]">{it.meta}</span>
                  {project && <> · <span className="font-display italic">{project.name}</span></>}
                  {tsLabel && <> · {tsLabel}</>}
                </div>
              </div>
            </div>
          );
          return (
            <li key={it.id}>
              {project ? (
                <Link to="/projects/$projectId" params={{ projectId: project.id }} className="block hover:bg-muted/30 -mx-2 px-2 rounded-[12px] transition-colors">
                  {inner}
                </Link>
              ) : (
                <div>{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Project Card — primary object of the application
// ────────────────────────────────────────────────────────────────────────
export function ProjectCard({
  project: p,
}: { project: DbProject & { health: HealthKey; clientName?: string | null; nextMilestone?: string | null } }) {
  const h = healthMap[p.health];
  const budget = Number(p.budget || 0);
  const spent = Number(p.spent || 0);
  const burn = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
  const budgetTone = burn > 100 ? "#c4685a" : burn > 90 ? "#d4882a" : "#7a9e8a";

  return (
    <Link
      to="/projects/$projectId"
      params={{ projectId: p.id }}
      className="group relative bg-card rounded-[20px] p-8 flex flex-col gap-7 overflow-hidden hover:-translate-y-[3px] transition-[transform,box-shadow] duration-300"
      style={{ boxShadow: "var(--shadow-card)" }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "var(--shadow-card-hover)")}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "var(--shadow-card)")}
    >
      {/* Top: health + phase */}
      <header className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: h.color }} />
        <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{h.label}</span>
        <span className="ml-auto text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{p.phase}</span>
      </header>

      {/* Identity: name + client */}
      <div>
        <h3 className="font-display text-[28px] leading-[1.05] tracking-[-0.01em]">{p.name}</h3>
        <p className="text-xs text-muted-foreground mt-2.5 italic font-display">
          {p.clientName || p.location || "—"}
        </p>
      </div>

      {/* Progress + budget pair */}
      <div className="grid grid-cols-2 gap-6 mt-auto">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-2">Progress</div>
          <div className="font-display text-[24px] leading-none tabular-nums mb-2">{p.completion}<span className="text-sm text-muted-foreground">%</span></div>
          <div className="h-[2px] rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${p.completion}%`, background: "#c17f5a" }} />
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-2">Budget</div>
          <div className="font-display text-[24px] leading-none tabular-nums mb-2" style={{ color: budgetTone }}>{Math.round(burn)}<span className="text-sm text-muted-foreground">%</span></div>
          <div className="h-[2px] rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${burn}%`, background: budgetTone }} />
          </div>
        </div>
      </div>

      {/* Next milestone */}
      {p.nextMilestone && (
        <div className="flex items-start gap-2.5 pt-1">
          <Flag className="h-3.5 w-3.5 text-[#c17f5a] mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Next milestone</div>
            <div className="text-sm font-display mt-0.5 truncate">{p.nextMilestone}</div>
          </div>
        </div>
      )}

      <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-[#c17f5a] opacity-70 group-hover:opacity-100 transition-opacity">
        Open project <ArrowUpRight className="h-3 w-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
      </span>
    </Link>
  );
}

function EmptyProjects() {
  return (
    <div className="rounded-[20px] bg-card p-20 text-center" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="h-16 w-16 mx-auto rounded-full bg-[#c17f5a]/10 flex items-center justify-center mb-6">
        <Sparkles className="h-6 w-6 text-[#c17f5a]" />
      </div>
      <h3 className="font-display text-3xl">Welcome to PMStudio</h3>
      <p className="text-muted-foreground mt-3 mb-8 max-w-md mx-auto">
        Create your first project — clients, vendors, finance and updates will all flow from here.
      </p>
      <Link
        to="/projects"
        className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-primary text-primary-foreground text-xs uppercase tracking-[0.18em] font-medium hover:brightness-95 transition"
      >
        <Plus className="h-4 w-4" /> Create your first project
      </Link>
    </div>
  );
}
