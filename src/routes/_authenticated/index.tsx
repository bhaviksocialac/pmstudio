import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, ArrowUpRight, IndianRupee, Clock, AlertTriangle, Clipboard, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { healthMap, type DbProject } from "@/lib/db-types";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Dashboard — StudioOS" },
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

  const projects = projectsQuery.data ?? [];
  const totalBudget = projects.reduce((s, p) => s + Number(p.budget || 0), 0);
  const totalSpent = projects.reduce((s, p) => s + Number(p.spent || 0), 0);
  const attention = projects.filter((p) => p.health !== "on-track").length;
  const firstName = profileQuery.data?.full_name?.split(" ")[0] ?? "there";

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

        <div className="flex items-baseline justify-between mb-5">
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
            {projects.slice(0, 6).map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </section>
        )}
      </main>
    </AppShell>
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

export function ProjectCard({ project: p }: { project: DbProject }) {
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
      <h3 className="font-display text-2xl">Welcome to StudioOS</h3>
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
