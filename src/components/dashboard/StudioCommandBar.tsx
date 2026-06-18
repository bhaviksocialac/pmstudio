import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Activity, Flame, IndianRupee, Sparkles, ArrowUpRight } from "lucide-react";
import type { DbProject, DbTask } from "@/lib/db-types";

const inr = (n: number) => {
  if (!n) return "₹0";
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(n >= 100000000 ? 0 : 1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(n >= 1000000 ? 0 : 1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}k`;
  return `₹${Math.round(n)}`;
};

interface Props {
  projects: DbProject[];
  tasks: DbTask[];
  firstName: string;
}

/**
 * StudioCommandBar — bold, editorial hero KPI band.
 * Dark neo-brutalist canvas with gradient accents, big typography,
 * and four tactile KPI tiles. Sits above the calm cream dashboard
 * to give the page a memorable, premium first impression.
 */
export function StudioCommandBar({ projects, tasks, firstName }: Props) {
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const live = projects.filter((p) => p.phase !== "Handover").length;
    const openTasks = tasks.filter((t) => !t.done);
    const overdue = openTasks.filter((t) => t.due_date && t.due_date < todayStr).length;
    const dueToday = openTasks.filter((t) => t.due_date === todayStr).length;
    const totalBudget = projects.reduce((s, p) => s + Number(p.budget || 0), 0);
    const totalSpent = projects.reduce((s, p) => s + Number(p.spent || 0), 0);
    const burnPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
    const onTrack = projects.length > 0
      ? Math.round(((projects.length - overdue) / Math.max(projects.length, 1)) * 100)
      : 100;
    return { live, overdue, dueToday, totalBudget, totalSpent, burnPct, onTrack };
  }, [projects, tasks]);

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateLabel = now.toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <section
      className="relative overflow-hidden rounded-[28px] mb-12 text-white"
      style={{
        background: "linear-gradient(135deg, #1a1410 0%, #2a1c14 50%, #1a1410 100%)",
        boxShadow: "0 30px 60px -20px rgba(26,20,16,0.45), 0 0 0 1px rgba(255,255,255,0.04) inset",
      }}
    >
      {/* Ambient gradient glows */}
      <div
        aria-hidden
        className="absolute -top-32 -left-32 w-[420px] h-[420px] rounded-full opacity-50 blur-[120px]"
        style={{ background: "radial-gradient(circle, #c17f5a 0%, transparent 70%)" }}
      />
      <div
        aria-hidden
        className="absolute -bottom-32 -right-20 w-[380px] h-[380px] rounded-full opacity-40 blur-[110px]"
        style={{ background: "radial-gradient(circle, #d4882a 0%, transparent 70%)" }}
      />

      <div className="relative p-8 md:p-12">
        {/* Header row */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
          <div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.32em] text-[#e0c4a0] mb-4">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live · {dateLabel}
            </div>
            <h1 className="font-display text-[44px] md:text-[58px] leading-[0.95] tracking-[-0.02em] font-light">
              {greeting},
              <br />
              <span className="text-[#e8a87c] italic">{firstName}.</span>
            </h1>
            <p className="text-sm text-white/60 mt-4 max-w-md italic font-display">
              {stats.overdue > 0
                ? `${stats.overdue} item${stats.overdue === 1 ? "" : "s"} need your attention before noon.`
                : "The studio is calm. A good day to make something beautiful."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/projects"
              className="group inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium transition-all"
            >
              All projects
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:rotate-45" />
            </Link>
            <Link
              to="/projects"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[#c17f5a] hover:bg-[#d4882a] text-white text-sm font-semibold shadow-lg shadow-[#c17f5a]/30 transition-all"
            >
              <Sparkles className="h-3.5 w-3.5" />
              New project
            </Link>
          </div>
        </div>

        {/* KPI tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPITile
            eyebrow="Portfolio"
            value={String(stats.live)}
            label="Live projects"
            accent="#e8a87c"
            icon={<Activity className="h-4 w-4" />}
          />
          <KPITile
            eyebrow="Today"
            value={String(stats.dueToday)}
            label="Due today"
            trailing={stats.overdue > 0 ? `${stats.overdue} overdue` : "All clear"}
            trailingTone={stats.overdue > 0 ? "warn" : "ok"}
            accent="#d4882a"
            icon={<Flame className="h-4 w-4" />}
          />
          <KPITile
            eyebrow="Health"
            value={`${stats.onTrack}%`}
            label="On track"
            progress={stats.onTrack}
            accent="#7fa890"
            icon={<Sparkles className="h-4 w-4" />}
          />
          <KPITile
            eyebrow="Finance"
            value={inr(stats.totalSpent)}
            label={`of ${inr(stats.totalBudget)} burn`}
            progress={stats.burnPct}
            accent="#c17f5a"
            icon={<IndianRupee className="h-4 w-4" />}
          />
        </div>
      </div>
    </section>
  );
}

function KPITile({
  eyebrow, value, label, trailing, trailingTone, accent, icon, progress,
}: {
  eyebrow: string;
  value: string;
  label: string;
  trailing?: string;
  trailingTone?: "ok" | "warn";
  accent: string;
  icon: React.ReactNode;
  progress?: number;
}) {
  return (
    <div
      className="group relative overflow-hidden rounded-[20px] p-5 transition-all hover:-translate-y-0.5"
      style={{
        background: "rgba(255,255,255,0.04)",
        backdropFilter: "blur(12px)",
        boxShadow: "0 0 0 1px rgba(255,255,255,0.06) inset",
      }}
    >
      <div
        aria-hidden
        className="absolute top-0 right-0 w-24 h-24 opacity-20 blur-2xl transition-opacity group-hover:opacity-40"
        style={{ background: `radial-gradient(circle, ${accent}, transparent 70%)` }}
      />
      <div className="relative flex items-start justify-between mb-4">
        <span className="text-[9px] uppercase tracking-[0.28em] text-white/50">{eyebrow}</span>
        <div
          className="h-8 w-8 rounded-[10px] flex items-center justify-center"
          style={{ background: `${accent}22`, color: accent }}
        >
          {icon}
        </div>
      </div>
      <div className="relative">
        <div className="font-display text-[34px] leading-none tracking-[-0.02em] font-light text-white">
          {value}
        </div>
        <div className="text-[11px] text-white/55 mt-2">{label}</div>
        {trailing && (
          <div
            className="text-[10px] uppercase tracking-[0.18em] mt-3 font-semibold"
            style={{ color: trailingTone === "warn" ? "#f4a86a" : "#7fc8a0" }}
          >
            {trailing}
          </div>
        )}
        {typeof progress === "number" && (
          <div className="mt-3 h-1 w-full rounded-full bg-white/8 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(100, progress)}%`,
                background: `linear-gradient(90deg, ${accent}, ${accent}cc)`,
                boxShadow: `0 0 12px ${accent}66`,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
