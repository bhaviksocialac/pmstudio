import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  ArrowLeft, Send, Calendar, MapPin, Users, Truck, IndianRupee,
  Home as HomeIcon, Building2, Check, Sparkles, Phone, Mail,
} from "lucide-react";
import { getProjectById, phases, healthMap, type Project } from "@/lib/projects";

export const Route = createFileRoute("/projects/$projectId")({
  head: ({ params }) => {
    const p = getProjectById(params.projectId);
    const title = p ? `${p.name} — StudioOS` : "Project — StudioOS";
    const desc = p ? `${p.client} · ${p.location} · ${p.phase}` : "Project details";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
      ],
    };
  },
  loader: ({ params }) => {
    const project = getProjectById(params.projectId);
    if (!project) throw notFound();
    return { project };
  },
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4">
      <div className="text-center max-w-md">
        <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-3">404</div>
        <h1 className="font-display text-4xl mb-3">Project not found</h1>
        <p className="text-muted-foreground mb-6">We couldn't find that project in your studio.</p>
        <Link to="/" className="inline-flex items-center gap-2 h-10 px-5 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>
      </div>
    </div>
  ),
  component: ProjectDetail,
});

function ProjectDetail() {
  const { project: p } = Route.useLoaderData() as { project: Project };
  const h = healthMap[p.health];
  const phaseIdx = phases.indexOf(p.phase);
  const budgetPct = Math.round((p.spent / p.budget) * 100);
  const TypeIcon = p.type === "residential" ? HomeIcon : Building2;
  const initials = p.client.split(" ").map((w) => w[0]).slice(0, 2).join("");

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Top bar */}
      <header className="h-16 border-b border-border bg-background/85 backdrop-blur sticky top-0 z-10 flex items-center px-4 md:px-8 gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-2 h-10 px-3 rounded-[10px] border border-border bg-card hover:bg-muted transition-colors text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <button className="h-10 px-4 inline-flex items-center gap-2 rounded-[6px] border border-border bg-card text-sm font-medium hover:bg-muted">
            <Send className="h-4 w-4" /> Send update
          </button>
        </div>
      </header>

      <main className="px-4 md:px-8 py-8 md:py-10 max-w-[1200px] mx-auto w-full pb-20">
        {/* Hero */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <span
              className={`inline-flex h-1.5 w-1.5 rounded-full ${h.pulse}`}
              style={{ background: h.color }}
            />
            <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{h.label}</span>
            <span className="text-muted-foreground/50">·</span>
            <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{p.type}</span>
          </div>
          <h1 className="font-display text-5xl md:text-6xl leading-tight">{p.name}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex h-6 w-6 rounded-full items-center justify-center text-[10px] font-medium text-white" style={{ background: "#c17f5a" }}>{initials}</span>
              {p.client}
            </span>
            <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {p.location}</span>
            <span className="inline-flex items-center gap-1.5"><TypeIcon className="h-3.5 w-3.5" /> {p.phase}</span>
            <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Handover {p.expectedHandover}</span>
          </div>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-foreground/80 italic font-display">
            "{p.description}"
          </p>
        </div>

        {/* Top stats */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 mb-10">
          <Stat label="Completion" value={`${p.completion}%`} accent="#c17f5a" />
          <Stat label="Phase" value={p.phase} accent="#7a9e8a" />
          <Stat label="Spent" value={`₹${p.spent}L`} sub={`of ₹${p.budget}L`} accent="#d4882a" />
          <Stat label="Start date" value={p.startDate} accent="#3d3530" />
        </section>

        {/* Progress */}
        <section className="rounded-[16px] bg-card border border-border p-6 md:p-8 mb-6" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-display text-2xl">Progress</h2>
            <span className="font-display text-4xl tabular-nums">
              {p.completion}<span className="text-base text-muted-foreground font-mono">%</span>
            </span>
          </div>
          <div className="relative rounded-full bg-muted overflow-hidden" style={{ height: "8px" }}>
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${p.completion}%`, background: "linear-gradient(90deg, #c17f5a, #d49a7a)" }}
            />
          </div>
          <div className="mt-5 flex flex-wrap gap-1.5">
            {phases.map((ph, i) => {
              const done = i < phaseIdx;
              const current = i === phaseIdx;
              return (
                <span
                  key={ph}
                  className={`inline-flex items-center gap-1 text-[11px] uppercase tracking-wider px-2.5 py-1.5 rounded-[6px] ${
                    current ? "text-white" : done ? "text-white" : "text-muted-foreground border border-border"
                  }`}
                  style={{ background: current ? "#d4882a" : done ? "#7a9e8a" : "transparent" }}
                >
                  {done && <Check className="h-2.5 w-2.5" />}
                  {ph}
                </span>
              );
            })}
          </div>
        </section>

        {/* Budget */}
        <section className="rounded-[16px] bg-card border border-border p-6 md:p-8 mb-6" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-display text-2xl flex items-center gap-2"><IndianRupee className="h-5 w-5" /> Budget</h2>
            <span className="text-sm font-mono tabular-nums text-muted-foreground">
              <span className="text-foreground font-medium">₹{p.spent}L</span> / ₹{p.budget}L
            </span>
          </div>
          <div className="relative rounded-full bg-muted overflow-hidden" style={{ height: "8px" }}>
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${Math.min(budgetPct, 100)}%`,
                background: budgetPct > 95 ? "#c4685a" : budgetPct > 80 ? "#d4882a" : "#3d3530",
              }}
            />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Spent</div>
              <div className="font-display text-2xl tabular-nums mt-1">₹{p.spent}L</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Remaining</div>
              <div className="font-display text-2xl tabular-nums mt-1">₹{p.budget - p.spent}L</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Used</div>
              <div className="font-display text-2xl tabular-nums mt-1">{budgetPct}%</div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Milestones */}
          <section className="lg:col-span-2 rounded-[16px] bg-card border border-border p-6 md:p-8" style={{ boxShadow: "var(--shadow-card)" }}>
            <h2 className="font-display text-2xl mb-5">Milestones</h2>
            <ol className="relative border-l border-border ml-2 space-y-5">
              {p.milestones.map((m, i) => (
                <li key={i} className="pl-5 relative">
                  <span
                    className="absolute -left-[7px] top-1 inline-flex h-3 w-3 rounded-full border-2 border-card"
                    style={{ background: m.done ? "#7a9e8a" : "#e5dfd6" }}
                  />
                  <div className="flex items-baseline justify-between gap-3">
                    <div className={`text-sm font-medium ${m.done ? "text-foreground" : "text-muted-foreground"}`}>
                      {m.label}
                    </div>
                    <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                      {m.date}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* Side panels */}
          <div className="space-y-6">
            <section className="rounded-[16px] bg-card border border-border p-6" style={{ boxShadow: "var(--shadow-card)" }}>
              <h3 className="font-display text-xl flex items-center gap-2 mb-4"><Users className="h-4 w-4" /> Team</h3>
              <ul className="space-y-3">
                {p.team.map((person) => {
                  const init = person.split(" ").map((w) => w[0]).slice(0, 2).join("");
                  return (
                    <li key={person} className="flex items-center gap-3">
                      <span className="inline-flex h-8 w-8 rounded-full items-center justify-center text-[11px] font-medium text-white" style={{ background: "#7a9e8a" }}>
                        {init}
                      </span>
                      <span className="text-sm">{person}</span>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="rounded-[16px] bg-card border border-border p-6" style={{ boxShadow: "var(--shadow-card)" }}>
              <h3 className="font-display text-xl flex items-center gap-2 mb-4"><Truck className="h-4 w-4" /> Vendors</h3>
              <ul className="space-y-2 text-sm">
                {p.vendors.map((v) => (
                  <li key={v} className="px-3 py-2 rounded-[6px] bg-muted/60">{v}</li>
                ))}
              </ul>
            </section>

            <section className="rounded-[16px] bg-[#1a1612] text-white p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-[260px] h-[260px] pointer-events-none"
                   style={{ background: "radial-gradient(circle at 70% 30%, rgba(193,127,90,0.22), transparent 60%)" }} />
              <div className="relative">
                <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-[#c17f5a] mb-3">
                  <Sparkles className="h-3 w-3" /> Client
                </span>
                <div className="font-display text-2xl">{p.client}</div>
                <div className="text-xs text-white/55 mt-1">{p.location}</div>
                <div className="mt-5 flex gap-2">
                  <button className="flex-1 h-9 inline-flex items-center justify-center gap-1.5 rounded-[6px] bg-[#c17f5a] text-white text-xs font-medium hover:brightness-95">
                    <Phone className="h-3.5 w-3.5" /> Call
                  </button>
                  <button className="flex-1 h-9 inline-flex items-center justify-center gap-1.5 rounded-[6px] border border-white/25 text-white text-xs font-medium hover:bg-white/5">
                    <Mail className="h-3.5 w-3.5" /> Email
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <article className="relative overflow-hidden rounded-[16px] bg-card border border-border p-5" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="font-display text-[28px] leading-tight mt-1 tabular-nums">{value}</div>
      {sub && <div className="text-[11px] mt-1 font-mono text-muted-foreground">{sub}</div>}
      <div className="absolute bottom-0 inset-x-0 h-[3px]" style={{ background: accent }} />
    </article>
  );
}
