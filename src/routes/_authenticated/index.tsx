import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, ArrowUpRight, IndianRupee, Clock, AlertTriangle, Clipboard, Sparkles,
  Flame, ListChecks, ArrowRight,
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

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Dashboard — PMStudio" },
      { name: "description", content: "Run every project, client, vendor and rupee from one premium command center." },
    ],
  }),
  component: Dashboard,
});

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
    queryKey: ["tasks", "open"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("done", false)
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as DbTask[];
    },
  });

  const projects = projectsQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];

  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  // Health derived from live tasks + budget
  const projectsWithHealth = useMemo(
    () =>
      projects.map((p) => {
        const t = tasks.filter((tk) => tk.project_id === p.id);
        return { ...p, health: computeHealth(p, t) as HealthKey };
      }),
    [projects, tasks],
  );

  const totalBudget = projects.reduce((s, p) => s + Number(p.budget || 0), 0);
  const totalSpent = projects.reduce((s, p) => s + Number(p.spent || 0), 0);
  const attention = projectsWithHealth.filter((p) => p.health !== "on-track").length;
  const firstName = profileQuery.data?.full_name?.split(" ")[0] ?? "there";

  // Fire alerts
  const todayStr = new Date().toISOString().slice(0, 10);
  const fireAlerts: { project: DbProject; reason: string }[] = [];
  projects.forEach((p) => {
    const overdueCount = tasks.filter(
      (t) => t.project_id === p.id && t.due_date && t.due_date < todayStr,
    ).length;
    if (overdueCount > 0) {
      fireAlerts.push({ project: p, reason: `${overdueCount} overdue task${overdueCount === 1 ? "" : "s"}` });
    }
    if (p.expected_handover) {
      const hrs = (new Date(p.expected_handover).getTime() - Date.now()) / 3600000;
      if (hrs >= 0 && hrs <= 48) {
        fireAlerts.push({ project: p, reason: `Handover in ${Math.round(hrs)}h` });
      } else if (hrs < 0) {
        fireAlerts.push({ project: p, reason: `Handover overdue by ${Math.round(-hrs / 24)}d` });
      }
    }
  });

  const todaysFocus = [...tasks]
    .sort((a, b) => {
      const aD = a.due_date || "9999";
      const bD = b.due_date || "9999";
      return aD.localeCompare(bD);
    })
    .slice(0, 3);

  return (
    <AppShell>
      <main className="px-4 md:px-8 py-8 md:py-10 max-w-[1400px] w-full pb-24 md:pb-10">
        <div className="mb-10">
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-3">Dashboard</div>
          <h1 className="text-4xl md:text-5xl font-display">Good morning, {firstName}.</h1>
          <p className="text-muted-foreground mt-2 max-w-xl">
            {projects.length === 0
              ? "Your studio is set up. Create your first project to get started."
              : `${projects.length} project${projects.length === 1 ? "" : "s"} in motion.`}
          </p>
        </div>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 mb-10">
          <StatCard icon={Clipboard} label="Active Projects" value={`${projects.length}`} accent="#c17f5a" />
          <StatCard icon={IndianRupee} label="Total Budget" value={`₹${totalBudget.toFixed(1)}L`} accent="#7a9e8a" />
          <StatCard icon={Clock} label="Total Spent" value={`₹${totalSpent.toFixed(1)}L`} accent="#d4882a" />
          <StatCard icon={AlertTriangle} label="Need Attention" value={`${attention}`} accent="#c4685a" />
        </section>

        <PhotoStaging />

        <PendingApprovals />

        {fireAlerts.length > 0 && (
          <FireAlertsCard alerts={fireAlerts} />
        )}

        <TodaysFocusCard tasks={todaysFocus} projectMap={projectMap} />

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
      qc.invalidateQueries({ queryKey: ["tasks", "open"] });
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
  const budgetPct = p.budget > 0 ? Math.round((Number(p.spent) / Number(p.budget)) * 100) : 0;
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
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Budget</span>
          <span className="text-xs font-mono">
            ₹{Number(p.spent).toFixed(1)}L / ₹{Number(p.budget).toFixed(1)}L
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.min(budgetPct, 100)}%`, background: budgetPct > 95 ? "#c4685a" : "#3d3530" }}
          />
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
