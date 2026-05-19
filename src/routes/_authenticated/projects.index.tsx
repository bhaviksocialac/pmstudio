import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { healthMap, type DbProject } from "@/lib/db-types";
import { openModal } from "@/lib/app-bus";
import { SharePortalButton } from "@/components/SharePortalButton";

export const Route = createFileRoute("/_authenticated/projects/")({
  head: () => ({
    meta: [
      { title: "Projects — PMStudio" },
      { name: "description", content: "Every project in your studio, with health, completion and budget at a glance." },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const [query, setQuery] = useState("");

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DbProject[];
    },
  });

  const filtered = projects.filter((p) =>
    !query || `${p.name} ${p.location ?? ""}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <AppShell>
      <main className="px-4 md:px-8 py-8 md:py-10 max-w-[1400px] w-full pb-24 md:pb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-3">Studio</div>
            <h1 className="font-display text-4xl md:text-5xl">Projects</h1>
            <p className="text-muted-foreground mt-2">
              {projects.length} project{projects.length === 1 ? "" : "s"} in your studio
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects…"
                className="h-10 pl-10 pr-3 rounded-[10px] bg-card border border-border text-sm w-56 focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
            </div>
            <button
              onClick={() => setCreating(true)}
              className="h-10 px-4 inline-flex items-center gap-2 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95"
            >
              <Plus className="h-4 w-4" /> New Project
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-[16px] bg-card border border-border h-56 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState onCreate={() => setCreating(true)} />
        ) : (
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {filtered.map((p) => (
              <ProjectRow key={p.id} project={p} />
            ))}
          </section>
        )}
      </main>
      {creating && <NewProjectWizard onClose={() => setCreating(false)} />}
    </AppShell>
  );
}

function ProjectRow({ project: p }: { project: DbProject }) {
  const h = healthMap[p.health];
  const budgetPct = p.budget > 0 ? Math.round((Number(p.spent) / Number(p.budget)) * 100) : 0;
  return (
    <div
      className="bg-card rounded-[16px] border border-border flex flex-col hover:-translate-y-[2px] transition-transform overflow-hidden"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <Link
        to="/projects/$projectId"
        params={{ projectId: p.id }}
        className="p-6 flex flex-col gap-4"
      >
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: h.color }} />
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{h.label}</span>
          <span className="ml-auto text-[10px] uppercase tracking-wider px-2 py-1 rounded-[6px] bg-muted">{p.phase}</span>
        </div>
        <div>
          <h3 className="font-display text-xl">{p.name}</h3>
          <p className="text-xs text-muted-foreground mt-1">{p.location || "—"}</p>
        </div>
        <div>
          <div className="flex justify-between text-[11px] mb-1.5">
            <span className="uppercase tracking-[0.18em] text-muted-foreground">Completion</span>
            <span className="font-mono">{p.completion}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${p.completion}%`, background: "#c17f5a" }} />
          </div>
        </div>
        <div className="text-xs font-mono text-muted-foreground">
          ₹{Number(p.spent).toFixed(1)}L / ₹{Number(p.budget).toFixed(1)}L · {budgetPct}% spent
        </div>
      </Link>
      <div className="border-t border-border px-3 py-2">
        <SharePortalButton projectId={p.id} variant="ghost" size="sm" label="Share Client Portal" className="w-full" />
      </div>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-[16px] border border-dashed border-border p-16 text-center">
      <div className="h-16 w-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
        <Plus className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="font-display text-2xl">No projects yet</h3>
      <p className="text-muted-foreground mt-2 mb-6">Create your first project to get started.</p>
      <button
        onClick={onCreate}
        className="h-10 px-5 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95"
      >
        + New Project
      </button>
    </div>
  );
}

