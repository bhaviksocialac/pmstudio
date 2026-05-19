import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowUpRight, Send, Clipboard, IndianRupee, Clock, AlertTriangle, Sparkles,
  Home as HomeIcon, Building2, Check,
} from "lucide-react";
import { projects, phases, healthMap, type Project } from "@/lib/projects";
import { AppShell } from "@/components/AppShell";
import { openModal } from "@/lib/app-bus";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Dashboard — StudioOS" },
      { name: "description", content: "Run every project, client, vendor and rupee from one premium command center built for interior design studios." },
    ],
  }),
  component: Dashboard,
});

function useCountUp(target: number, duration = 1500, decimals = 0) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf: number; const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min((t - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return decimals === 0 ? Math.round(val) : val.toFixed(decimals);
}

function Dashboard() {
  return (
    <AppShell>
      <main className="px-4 md:px-8 py-8 md:py-10 max-w-[1400px] w-full pb-24 md:pb-10">
        <div className="mb-10">
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-3">Dashboard</div>
          <h1 className="text-4xl md:text-5xl font-display">Good morning, Bhavik.</h1>
          <p className="text-muted-foreground mt-2 max-w-xl">Three projects in motion this week. One needs a quick call.</p>
        </div>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 mb-8">
          <StatCard idx={0} icon={Clipboard} label="Active Projects" value={3} sub="1 added this month" subTone="success" accent="#c17f5a" />
          <StatCard idx={1} icon={IndianRupee} label="Collected This Month" value={8.4} suffix="L" prefix="₹" decimals={1} sub="↑ 18% vs last month" subTone="success" accent="#7a9e8a" />
          <StatCard idx={2} icon={Clock} label="Pending Collection" value={5.2} suffix="L" prefix="₹" decimals={1} sub="2 invoices overdue" subTone="danger" accent="#d4882a" />
          <StatCard idx={3} icon={AlertTriangle} label="Items Need Attention" value={6} sub="3 urgent today" subTone="danger" accent="#c4685a" />
        </section>

        <section
          className="relative overflow-hidden rounded-[16px] bg-[#1a1612] text-white p-7 md:p-9 mb-10 animate-fade-up"
          style={{ animationDelay: "0.32s" }}
        >
          <div className="absolute top-0 right-0 w-[400px] h-[400px] pointer-events-none"
               style={{ background: "radial-gradient(circle at 70% 30%, rgba(193,127,90,0.18), transparent 60%)" }} />
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-[#c17f5a] mb-4">
              <Sparkles className="h-3 w-3" /> AI Insight
            </span>
            <h2 className="font-display text-3xl md:text-4xl text-white">Good morning, Bhavik</h2>
            <p className="italic text-white/65 mt-3 max-w-2xl leading-relaxed">
              Mehta project tiles are delayed 3 days. Flooring shifts to 18th May. Client update recommended today before she calls.
            </p>
            <div className="flex flex-wrap gap-3 mt-6">
              <button
                onClick={() => openModal("draft-update")}
                className="h-10 px-5 rounded-[6px] bg-[#c17f5a] text-white text-sm font-medium hover:brightness-95 transition-[filter] duration-150"
              >
                Draft Client Update
              </button>
              <button
                onClick={() => openModal("view-impact")}
                className="h-10 px-5 rounded-[6px] border border-white/25 text-white text-sm font-medium hover:bg-white/5 transition-colors duration-150"
              >
                View Impact
              </button>
            </div>
          </div>
        </section>

        <div className="flex items-baseline justify-between mb-5">
          <h2 className="font-display text-2xl">Active Projects</h2>
          <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{projects.length} in motion</span>
        </div>
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {projects.map((p, i) => (
            <ProjectCard key={p.name} project={p} delay={0.4 + i * 0.08} />
          ))}
        </section>
      </main>
    </AppShell>
  );
}

function StatCard({
  idx, icon: Icon, label, value, prefix = "", suffix = "", decimals = 0, sub, subTone, accent,
}: {
  idx: number; icon: React.ComponentType<{ className?: string }>;
  label: string; value: number; prefix?: string; suffix?: string; decimals?: number;
  sub: string; subTone: "success" | "danger"; accent: string;
}) {
  const count = useCountUp(value, 1500, decimals);
  return (
    <article
      className="relative overflow-hidden rounded-[16px] bg-card border border-border p-5 md:p-6 animate-fade-up transition-[transform,box-shadow] duration-200 hover:-translate-y-[3px]"
      style={{ animationDelay: `${idx * 0.08}s`, boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="h-9 w-9 rounded-[10px] flex items-center justify-center" style={{ background: `${accent}18`, color: accent }}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="font-display text-[32px] leading-tight mt-1 tabular-nums">
        {prefix}{count}{suffix}
      </div>
      <div className="text-[11px] mt-2 font-mono" style={{ color: subTone === "success" ? "#7a9e8a" : "#c4685a" }}>
        {sub}
      </div>
      <div className="absolute bottom-0 inset-x-0 h-[3px]" style={{ background: accent }} />
    </article>
  );
}

export function ProjectCard({ project: p, delay = 0 }: { project: Project; delay?: number }) {
  const h = healthMap[p.health];
  const phaseIdx = phases.indexOf(p.phase);
  const budgetPct = Math.round((p.spent / p.budget) * 100);
  const completion = useCountUp(p.completion, 1000);
  const TypeIcon = p.type === "residential" ? HomeIcon : Building2;
  const initials = p.client.split(" ").map((w) => w[0]).slice(0, 2).join("");
  const navigate = useNavigate();

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={() => navigate({ to: "/projects/$projectId", params: { projectId: p.id } })}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate({ to: "/projects/$projectId", params: { projectId: p.id } });
        }
      }}
      className="group relative bg-card rounded-[16px] border border-border p-7 md:p-8 flex flex-col gap-6 overflow-hidden animate-fade-up transition-[transform,box-shadow] duration-200 hover:-translate-y-[3px] hover:shadow-lg cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      style={{ animationDelay: `${delay}s`, boxShadow: "var(--shadow-card)" }}
    >
      <div className="absolute top-0 right-0 w-48 h-48 pointer-events-none"
           style={{ background: "radial-gradient(circle at 80% 20%, rgba(193,127,90,0.10), transparent 60%)" }} />

      <header className="relative flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-3">
            <span className={`inline-flex h-1.5 w-1.5 rounded-full ${h.pulse}`} style={{ background: h.color, color: h.color }} aria-label={h.label} />
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{h.label}</span>
            <span className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded-[6px] bg-muted text-muted-foreground">
              <TypeIcon className="h-3.5 w-3.5" />
            </span>
          </div>
          <h3 className="font-display leading-tight" style={{ fontSize: "20px" }}>{p.name}</h3>
          <div className="flex items-center gap-2 mt-2">
            <span className="inline-flex h-6 w-6 rounded-full items-center justify-center text-[10px] font-medium text-white" style={{ background: "#c17f5a" }}>{initials}</span>
            <p className="text-xs text-muted-foreground truncate">{p.client} · {p.location}</p>
          </div>
        </div>
      </header>

      <div className="relative">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Completion</span>
          <span className="font-display text-3xl tabular-nums">{completion}<span className="text-base text-muted-foreground font-mono">%</span></span>
        </div>
        <div className="relative rounded-full bg-muted overflow-hidden" style={{ height: "6px" }}>
          <div className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000 ease-out"
               style={{ width: `${completion}%`, background: "linear-gradient(90deg, #c17f5a, #d49a7a)" }} />
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {phases.map((ph, i) => {
            const done = i < phaseIdx;
            const current = i === phaseIdx;
            return (
              <span key={ph}
                className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded-[6px] ${current ? "text-white" : done ? "text-white" : "text-muted-foreground border border-border"}`}
                style={{ background: current ? "#d4882a" : done ? "#7a9e8a" : "transparent" }}>
                {done && <Check className="h-2.5 w-2.5" />}{ph}
              </span>
            );
          })}
        </div>
      </div>

      <div className="relative">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Budget</span>
          <span className="text-xs text-muted-foreground tabular-nums font-mono"><span className="text-foreground font-medium">₹{p.spent}L</span> / ₹{p.budget}L</span>
        </div>
        <div className="relative rounded-full bg-muted overflow-hidden" style={{ height: "6px" }}>
          <div className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000 ease-out"
               style={{ width: `${Math.min(budgetPct, 100)}%`, background: budgetPct > 95 ? "#c4685a" : budgetPct > 80 ? "#d4882a" : "#3d3530" }} />
        </div>
        <div className="text-[10px] text-muted-foreground mt-1.5 tabular-nums font-mono uppercase tracking-wider">{budgetPct}% spent</div>
      </div>

      <div className="relative mt-auto flex gap-2 pt-2">
        <Link to="/projects/$projectId" params={{ projectId: p.id }} onClick={(e) => e.stopPropagation()}
              className="flex-1 h-10 inline-flex items-center justify-center gap-1.5 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95 transition-[filter] duration-150">
          View Project <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
        <button onClick={(e) => { e.stopPropagation(); openModal("draft-update"); }}
                className="flex-1 h-10 inline-flex items-center justify-center gap-1.5 rounded-[6px] border border-border bg-card text-sm font-medium hover:bg-muted transition-colors duration-150">
          <Send className="h-3.5 w-3.5" /> Send Update
        </button>
      </div>
      <div className="absolute bottom-0 inset-x-0" style={{ height: "3px", background: h.line }} />
    </article>
  );
}
