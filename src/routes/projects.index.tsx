import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Grid3x3, List, Eye, Send, Pencil, Plus, Home as HomeIcon, Building2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ProjectCard } from "./index";
import { projects, healthMap } from "@/lib/projects";
import { openModal } from "@/lib/app-bus";

export const Route = createFileRoute("/projects/")({
  head: () => ({
    meta: [
      { title: "Projects — StudioOS" },
      { name: "description", content: "Every project in your studio, with health, completion and budget at a glance." },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (query && !`${p.name} ${p.client} ${p.location}`.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [query, filter]);

  const stats = [
    { label: "Total Projects", value: projects.length },
    { label: "Active", value: projects.length },
    { label: "Completed This Year", value: 4 },
    { label: "Revenue Managed", value: "₹78L" },
  ];

  return (
    <AppShell>
      <main className="px-4 md:px-8 py-8 md:py-10 max-w-[1400px] w-full pb-24 md:pb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-3">Studio</div>
            <h1 className="font-display text-4xl md:text-5xl">Projects</h1>
            <p className="text-muted-foreground mt-2">{projects.length} projects in motion across Mumbai</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search projects…" className="h-10 pl-10 pr-3 rounded-[10px] bg-card border border-border text-sm w-56 focus:outline-none focus:ring-2 focus:ring-ring/30" />
            </div>
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-10 px-3 rounded-[10px] bg-card border border-border text-sm">
              {["All","Active","Completed","On Hold"].map((f) => <option key={f}>{f}</option>)}
            </select>
            <div className="flex rounded-[10px] border border-border overflow-hidden bg-card">
              <button onClick={() => setView("grid")} className={`h-10 w-10 flex items-center justify-center ${view === "grid" ? "bg-muted" : ""}`}><Grid3x3 className="h-4 w-4" /></button>
              <button onClick={() => setView("list")} className={`h-10 w-10 flex items-center justify-center ${view === "list" ? "bg-muted" : ""}`}><List className="h-4 w-4" /></button>
            </div>
            <button onClick={() => openModal("new-project")} className="h-10 px-4 inline-flex items-center gap-2 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95">
              <Plus className="h-4 w-4" /> New Project
            </button>
          </div>
        </div>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((s) => (
            <div key={s.label} className="rounded-[16px] bg-card border border-border p-5" style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{s.label}</div>
              <div className="font-display text-3xl mt-1 tabular-nums">{s.value}</div>
            </div>
          ))}
        </section>

        {filtered.length === 0 ? (
          <EmptyState />
        ) : view === "grid" ? (
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {filtered.map((p, i) => <ProjectCard key={p.id} project={p} delay={i * 0.06} />)}
          </section>
        ) : (
          <section className="rounded-[16px] bg-card border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <tr>
                  {["Project","Client","Location","Phase","Completion","Budget","Health","Updated","Actions"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((p) => {
                  const Icon = p.type === "residential" ? HomeIcon : Building2;
                  const h = healthMap[p.health];
                  return (
                    <tr key={p.id} className="hover:bg-muted/40">
                      <td className="px-4 py-3"><div className="flex items-center gap-2"><Icon className="h-3.5 w-3.5 text-muted-foreground" /><span className="font-medium">{p.name}</span></div></td>
                      <td className="px-4 py-3 text-muted-foreground">{p.client}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.location}</td>
                      <td className="px-4 py-3"><span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-[6px] bg-muted">{p.phase}</span></td>
                      <td className="px-4 py-3 font-mono tabular-nums">{p.completion}%</td>
                      <td className="px-4 py-3 font-mono tabular-nums">₹{p.spent}L / ₹{p.budget}L</td>
                      <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5 text-xs"><span className="h-2 w-2 rounded-full" style={{ background: h.color }} />{h.label}</span></td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">2h ago</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Link to="/projects/$projectId" params={{ projectId: p.id }} className="h-8 w-8 rounded-[6px] border border-border flex items-center justify-center hover:bg-muted"><Eye className="h-3.5 w-3.5" /></Link>
                          <button onClick={() => openModal("draft-update")} className="h-8 w-8 rounded-[6px] border border-border flex items-center justify-center hover:bg-muted"><Send className="h-3.5 w-3.5" /></button>
                          <button className="h-8 w-8 rounded-[6px] border border-border flex items-center justify-center hover:bg-muted"><Pencil className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}
      </main>
    </AppShell>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[16px] border border-dashed border-border p-16 text-center">
      <div className="h-16 w-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
        <Plus className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="font-display text-2xl">No projects yet</h3>
      <p className="text-muted-foreground mt-2 mb-6">Create your first project to get started.</p>
      <button onClick={() => openModal("new-project")} className="h-10 px-5 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95">+ New Project</button>
    </div>
  );
}
