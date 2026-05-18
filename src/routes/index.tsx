import { createFileRoute } from "@tanstack/react-router";
import { Search, Plus, LayoutDashboard, FolderKanban, Users, Truck, Wallet, MessageSquare, ArrowUpRight, Send } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "StudioOS — Project management for interior designers" },
      { name: "description", content: "Run every project, client, vendor and rupee from one premium command center built for interior design studios." },
    ],
  }),
  component: Dashboard,
});

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, active: true },
  { label: "Projects", icon: FolderKanban },
  { label: "Clients", icon: Users },
  { label: "Vendors", icon: Truck },
  { label: "Finance", icon: Wallet },
  { label: "Messages", icon: MessageSquare },
];

const phases = ["Survey", "Design", "Procurement", "Execution", "Finishing", "Handover"] as const;

type Health = "on-track" | "attention" | "urgent";

const projects: Array<{
  name: string;
  client: string;
  location: string;
  phase: typeof phases[number];
  completion: number;
  spent: number;
  budget: number;
  health: Health;
}> = [
  { name: "Banyan House", client: "Mehra Family", location: "Bandra, Mumbai", phase: "Execution", completion: 62, spent: 48, budget: 85, health: "on-track" },
  { name: "Atelier 14", client: "Kapoor & Co.", location: "Defence Colony, Delhi", phase: "Procurement", completion: 38, spent: 26, budget: 54, health: "attention" },
  { name: "Coral Studio", client: "Iyer Residence", location: "Koregaon Park, Pune", phase: "Finishing", completion: 89, spent: 71, budget: 72, health: "urgent" },
];

const healthStyles: Record<Health, { dot: string; label: string; ring: string }> = {
  "on-track": { dot: "bg-[var(--success)]", label: "On track", ring: "ring-[var(--success)]/30" },
  attention: { dot: "bg-[var(--warning)]", label: "Needs attention", ring: "ring-[var(--warning)]/30" },
  urgent: { dot: "bg-[var(--danger)]", label: "Urgent", ring: "ring-[var(--danger)]/30" },
};

function Dashboard() {
  return (
    <div className="min-h-screen flex bg-background text-foreground font-sans">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border">
        <div className="px-6 pt-8 pb-10">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-display font-semibold">S</div>
            <div>
              <div className="font-display text-lg leading-none">StudioOS</div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-sidebar-foreground/50 mt-1">Design Studio</div>
            </div>
          </div>
        </div>
        <nav className="px-3 space-y-1 flex-1">
          {navItems.map((n) => (
            <button
              key={n.label}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                n.active
                  ? "bg-sidebar-accent text-white border-l-2 border-primary"
                  : "text-sidebar-foreground/70 hover:text-white hover:bg-sidebar-accent/60"
              }`}
            >
              <n.icon className="h-4 w-4" />
              <span>{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 m-3 rounded-xl bg-sidebar-accent/60 border border-sidebar-border">
          <div className="text-xs text-sidebar-foreground/60">Studio</div>
          <div className="text-sm font-medium text-white mt-1">Bhavik Studio</div>
          <div className="text-[11px] text-sidebar-foreground/50 mt-2">12 active · 4 vendors</div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <header className="h-16 border-b border-border bg-background/80 backdrop-blur flex items-center px-8 gap-4 sticky top-0 z-10">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search projects, clients, vendors…"
              className="w-full h-10 pl-10 pr-4 rounded-lg bg-card border border-border text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden md:inline">Mon, 18 May</span>
            <button
              aria-label="Add new project"
              className="h-10 px-4 inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-sm hover:opacity-95 transition"
            >
              <Plus className="h-4 w-4" />
              <span>New project</span>
            </button>
          </div>
        </header>

        <main className="flex-1 px-8 py-10 max-w-[1400px] w-full">
          {/* Hero */}
          <div className="flex items-end justify-between mb-10">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">Dashboard</div>
              <h1 className="text-4xl md:text-5xl font-display font-medium">Good morning, Bhavik.</h1>
              <p className="text-muted-foreground mt-2 max-w-xl">Three projects in motion this week. One needs a quick call.</p>
            </div>
            <div className="hidden md:flex gap-8 pb-2">
              <Stat label="Active projects" value="3" />
              <Stat label="Budget in play" value="₹2.11 Cr" />
              <Stat label="This week" value="14 tasks" />
            </div>
          </div>

          {/* Phase legend */}
          <div className="mb-8 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
            <span className="mr-2">Phases</span>
            {phases.map((p, i) => (
              <span key={p} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-foreground/30" />
                <span>{p}</span>
                {i < phases.length - 1 && <span className="text-foreground/20">·</span>}
              </span>
            ))}
          </div>

          {/* Project cards */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {projects.map((p) => (
              <ProjectCard key={p.name} project={p} />
            ))}
          </section>
        </main>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="text-2xl font-display font-medium mt-1">{value}</div>
    </div>
  );
}

function ProjectCard({ project: p }: { project: typeof projects[number] }) {
  const h = healthStyles[p.health];
  const phaseIdx = phases.indexOf(p.phase);
  const budgetPct = Math.round((p.spent / p.budget) * 100);

  return (
    <article className="group relative bg-card rounded-2xl border border-border p-6 flex flex-col gap-6 hover:shadow-[0_20px_50px_-25px_rgba(80,40,20,0.25)] transition-shadow">
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className={`h-2 w-2 rounded-full ${h.dot} ring-4 ${h.ring}`} aria-label={h.label} />
            <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{h.label}</span>
          </div>
          <h2 className="text-2xl font-display font-medium leading-tight truncate">{p.name}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {p.client} · <span className="text-foreground/60">{p.location}</span>
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Phase</div>
          <div className="text-sm font-medium mt-1">{p.phase}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{phaseIdx + 1} / {phases.length}</div>
        </div>
      </header>

      {/* Completion */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Completion</span>
          <span className="font-display text-3xl font-medium tabular-nums">{p.completion}<span className="text-base text-muted-foreground">%</span></span>
        </div>
        <div className="relative h-2 rounded-full bg-muted overflow-hidden">
          <div className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all" style={{ width: `${p.completion}%` }} />
        </div>
        {/* Phase pips */}
        <div className="mt-3 grid grid-cols-6 gap-1">
          {phases.map((_, i) => (
            <div key={i} className={`h-1 rounded-full ${i <= phaseIdx ? "bg-primary/70" : "bg-muted"}`} />
          ))}
        </div>
      </div>

      {/* Budget */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Budget</span>
          <span className="text-sm text-muted-foreground tabular-nums">
            <span className="text-foreground font-medium">₹{p.spent}L</span> / ₹{p.budget}L
          </span>
        </div>
        <div className="relative h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`absolute inset-y-0 left-0 rounded-full ${budgetPct > 95 ? "bg-[var(--danger)]" : budgetPct > 80 ? "bg-[var(--warning)]" : "bg-foreground/70"}`}
            style={{ width: `${Math.min(budgetPct, 100)}%` }}
          />
        </div>
        <div className="text-[11px] text-muted-foreground mt-1.5 tabular-nums">{budgetPct}% spent</div>
      </div>

      {/* Actions */}
      <div className="mt-auto flex gap-2 pt-2">
        <button className="flex-1 h-10 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-95 transition">
          View project <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
        <button className="flex-1 h-10 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background text-sm font-medium hover:bg-muted transition">
          <Send className="h-3.5 w-3.5" /> Send update
        </button>
      </div>
    </article>
  );
}
