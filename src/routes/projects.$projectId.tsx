import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  ArrowLeft, Send, Calendar, MapPin, IndianRupee,
  Home as HomeIcon, Building2, Check, Sparkles, Phone, Mail,
  Image as ImageIcon, Truck, StickyNote, Wallet, CircleDot,
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

const vendorStatusMap: Record<string, { color: string; label: string }> = {
  confirmed: { color: "#7a9e8a", label: "Confirmed" },
  pending: { color: "#d4882a", label: "Pending" },
  delayed: { color: "#c4685a", label: "Delayed" },
  completed: { color: "#3d3530", label: "Completed" },
};

function ProjectDetail() {
  const { project: p } = Route.useLoaderData() as { project: Project };
  const h = healthMap[p.health];
  const phaseIdx = phases.indexOf(p.phase);
  const budgetPct = Math.round((p.spent / p.budget) * 100);
  const TypeIcon = p.type === "residential" ? HomeIcon : Building2;
  const initials = p.client.split(" ").map((w) => w[0]).slice(0, 2).join("");
  const totalAllocated = p.budgetBreakdown.reduce((s, b) => s + b.allocated, 0);
  const totalSpent = p.budgetBreakdown.reduce((s, b) => s + b.spent, 0);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Top bar */}
      <header className="h-16 border-b border-border bg-background/85 backdrop-blur sticky top-0 z-20 flex items-center px-4 md:px-8 gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-2 h-10 px-3 rounded-[10px] border border-border bg-card hover:bg-muted transition-colors text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <button className="h-10 px-4 inline-flex items-center gap-2 rounded-[6px] border border-border bg-card text-sm font-medium hover:bg-muted">
            <Send className="h-4 w-4" /> Send update
          </button>
        </div>
      </header>

      <main className="px-4 md:px-8 py-8 md:py-10 max-w-[1300px] mx-auto w-full pb-20">
        {/* Hero */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className={`inline-flex h-1.5 w-1.5 rounded-full ${h.pulse}`} style={{ background: h.color }} />
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
        </div>

        {/* Two-column: phase timeline (left), main content (right) */}
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          {/* LEFT — Phase timeline */}
          <aside className="lg:sticky lg:top-[88px] lg:self-start">
            <section className="rounded-[16px] bg-card border border-border p-6" style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-baseline justify-between mb-5">
                <h2 className="font-display text-xl">Phase Timeline</h2>
                <span className="text-[11px] font-mono tabular-nums text-muted-foreground">{p.completion}%</span>
              </div>
              <ol className="relative space-y-0">
                {phases.map((ph, i) => {
                  const done = i < phaseIdx;
                  const current = i === phaseIdx;
                  const dotColor = done ? "#7a9e8a" : current ? "#d4882a" : "#e5dfd6";
                  return (
                    <li key={ph} className="relative pl-8 pb-5 last:pb-0">
                      {i < phases.length - 1 && (
                        <span className="absolute left-[10px] top-5 bottom-0 w-px" style={{ background: done ? "#7a9e8a" : "#e5dfd6" }} />
                      )}
                      <span
                        className={`absolute left-0 top-0.5 inline-flex h-5 w-5 rounded-full items-center justify-center ${current ? "pulse-slow" : ""}`}
                        style={{ background: dotColor, boxShadow: current ? "0 0 0 4px rgba(212,136,42,0.18)" : "none" }}
                      >
                        {done && <Check className="h-3 w-3 text-white" />}
                        {current && <CircleDot className="h-3 w-3 text-white" />}
                      </span>
                      <div className={`font-display text-base ${current ? "text-foreground" : done ? "text-foreground/80" : "text-muted-foreground"}`}>
                        {ph}
                      </div>
                      <div className="text-[10px] uppercase tracking-[0.18em] mt-0.5" style={{ color: done ? "#7a9e8a" : current ? "#d4882a" : "#6b5f58" }}>
                        {done ? "Complete" : current ? "In Progress" : "Upcoming"}
                      </div>
                    </li>
                  );
                })}
              </ol>
              <div className="mt-5 pt-5 border-t border-border">
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1.5">Overall</div>
                <div className="relative rounded-full bg-muted overflow-hidden" style={{ height: "6px" }}>
                  <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${p.completion}%`, background: "linear-gradient(90deg, #c17f5a, #d49a7a)" }} />
                </div>
              </div>
            </section>
          </aside>

          {/* RIGHT — main content */}
          <div className="space-y-6 min-w-0">
            {/* Description */}
            <section className="rounded-[16px] bg-card border border-border p-6 md:p-7" style={{ boxShadow: "var(--shadow-card)" }}>
              <p className="text-base leading-relaxed text-foreground/85 italic font-display">"{p.description}"</p>
            </section>

            {/* Photo gallery by room */}
            <section className="rounded-[16px] bg-card border border-border p-6 md:p-7" style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-baseline justify-between mb-5">
                <h2 className="font-display text-2xl flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" style={{ color: "#c17f5a" }} /> Photo Gallery
                </h2>
                <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{p.gallery.length} rooms</span>
              </div>
              <div className="space-y-6">
                {p.gallery.map((room) => (
                  <div key={room.room}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="inline-block h-1 w-6 rounded-full" style={{ background: "#c17f5a" }} />
                      <h3 className="font-display text-lg">{room.room}</h3>
                      <span className="text-[10px] font-mono text-muted-foreground tabular-nums">{room.items.length}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {room.items.map((it) => (
                        <figure key={it.caption} className="group">
                          <div
                            className="aspect-[4/3] rounded-[10px] overflow-hidden relative border border-border"
                            style={{ background: it.tone }}
                          >
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-black/20" />
                          </div>
                          <figcaption className="mt-1.5 text-[11px] text-muted-foreground">{it.caption}</figcaption>
                        </figure>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Budget breakdown */}
            <section className="rounded-[16px] bg-card border border-border p-6 md:p-7" style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-baseline justify-between mb-5">
                <h2 className="font-display text-2xl flex items-center gap-2">
                  <Wallet className="h-5 w-5" style={{ color: "#c17f5a" }} /> Budget Breakdown
                </h2>
                <span className="text-sm font-mono tabular-nums text-muted-foreground">
                  <span className="text-foreground font-medium">₹{totalSpent}L</span> / ₹{totalAllocated}L
                </span>
              </div>
              <div className="relative rounded-full bg-muted overflow-hidden mb-6" style={{ height: "8px" }}>
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${Math.min(budgetPct, 100)}%`,
                    background: budgetPct > 95 ? "#c4685a" : budgetPct > 80 ? "#d4882a" : "#7a9e8a",
                  }}
                />
              </div>
              <div className="space-y-4">
                {p.budgetBreakdown.map((b) => {
                  const pct = Math.round((b.spent / b.allocated) * 100);
                  const over = b.spent > b.allocated;
                  const barColor = over ? "#c4685a" : pct > 85 ? "#d4882a" : "#3d3530";
                  return (
                    <div key={b.category}>
                      <div className="flex items-baseline justify-between gap-3 mb-1.5">
                        <span className="text-sm font-medium">{b.category}</span>
                        <span className="text-xs font-mono tabular-nums text-muted-foreground">
                          <span className={over ? "text-[#c4685a] font-medium" : "text-foreground"}>₹{b.spent}L</span>
                          <span className="text-muted-foreground/70"> / ₹{b.allocated}L</span>
                        </span>
                      </div>
                      <div className="relative rounded-full bg-muted overflow-hidden" style={{ height: "5px" }}>
                        <div
                          className="absolute inset-y-0 left-0 rounded-full"
                          style={{ width: `${Math.min(pct, 100)}%`, background: barColor }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 grid grid-cols-3 gap-4">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Allocated</div>
                  <div className="font-display text-xl tabular-nums mt-0.5">₹{totalAllocated}L</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Spent</div>
                  <div className="font-display text-xl tabular-nums mt-0.5">₹{totalSpent}L</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Remaining</div>
                  <div className="font-display text-xl tabular-nums mt-0.5" style={{ color: totalAllocated - totalSpent < 0 ? "#c4685a" : undefined }}>
                    ₹{totalAllocated - totalSpent}L
                  </div>
                </div>
              </div>
            </section>

            {/* Vendors */}
            <section className="rounded-[16px] bg-card border border-border p-6 md:p-7" style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-baseline justify-between mb-5">
                <h2 className="font-display text-2xl flex items-center gap-2">
                  <Truck className="h-5 w-5" style={{ color: "#c17f5a" }} /> Vendors
                </h2>
                <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{p.vendors.length} total</span>
              </div>
              <ul className="divide-y divide-border">
                {p.vendors.map((v) => {
                  const s = vendorStatusMap[v.status];
                  return (
                    <li key={v.name} className="py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{v.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{v.scope}</div>
                      </div>
                      <span
                        className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-[6px] whitespace-nowrap"
                        style={{ background: `${s.color}1a`, color: s.color, border: `1px solid ${s.color}40` }}
                      >
                        <span className="inline-flex h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
                        {s.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* Notes */}
            <section className="rounded-[16px] bg-card border border-border p-6 md:p-7" style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-baseline justify-between mb-5">
                <h2 className="font-display text-2xl flex items-center gap-2">
                  <StickyNote className="h-5 w-5" style={{ color: "#c17f5a" }} /> Notes
                </h2>
                <button className="text-[11px] uppercase tracking-[0.18em] text-[#c17f5a] hover:underline">+ Add note</button>
              </div>
              <ul className="space-y-4">
                {p.notes.map((n, i) => {
                  const init = n.author.split(" ").map((w) => w[0]).slice(0, 2).join("");
                  return (
                    <li key={i} className="flex gap-3">
                      <span className="inline-flex h-8 w-8 shrink-0 rounded-full items-center justify-center text-[10px] font-medium text-white" style={{ background: "#7a9e8a" }}>
                        {init}
                      </span>
                      <div className="flex-1 min-w-0 rounded-[10px] bg-muted/50 border border-border px-4 py-3">
                        <div className="flex items-baseline justify-between gap-3 mb-1">
                          <span className="text-sm font-medium">{n.author}</span>
                          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground whitespace-nowrap">{n.date}</span>
                        </div>
                        <p className="text-sm text-foreground/80 leading-relaxed">{n.text}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* Client contact */}
            <section className="rounded-[16px] bg-[#1a1612] text-white p-6 md:p-7 relative overflow-hidden">
              <div
                className="absolute top-0 right-0 w-[320px] h-[320px] pointer-events-none"
                style={{ background: "radial-gradient(circle at 70% 30%, rgba(193,127,90,0.22), transparent 60%)" }}
              />
              <div className="relative flex flex-wrap items-end justify-between gap-4">
                <div>
                  <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-[#c17f5a] mb-2">
                    <Sparkles className="h-3 w-3" /> Client Contact
                  </span>
                  <div className="font-display text-3xl">{p.client}</div>
                  <div className="text-xs text-white/55 mt-1">{p.location}</div>
                </div>
                <div className="flex gap-2">
                  <button className="h-10 px-4 inline-flex items-center justify-center gap-1.5 rounded-[6px] bg-[#c17f5a] text-white text-sm font-medium hover:brightness-95">
                    <Phone className="h-3.5 w-3.5" /> Call
                  </button>
                  <button className="h-10 px-4 inline-flex items-center justify-center gap-1.5 rounded-[6px] border border-white/25 text-white text-sm font-medium hover:bg-white/5">
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

function _UnusedKeepImport() {
  return <IndianRupee />;
}
