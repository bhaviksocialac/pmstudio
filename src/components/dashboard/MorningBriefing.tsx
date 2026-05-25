import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Sparkles, TrendingUp, TrendingDown, Minus, ArrowRight, AlertCircle, ShoppingCart, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { DbProject, DbTask } from "@/lib/db-types";
import {
  computeDoToday, computeWatchThisWeek, computeOrderNow, computeFasttrack,
  type BriefingItem, type FasttrackScore,
} from "@/lib/briefing";

export function MorningBriefing({
  projects, tasks, firstName,
}: {
  projects: DbProject[];
  tasks: DbTask[];
  firstName: string;
}) {
  const snagsQuery = useQuery({
    queryKey: ["briefing-snags"],
    queryFn: async () => {
      const { data } = await supabase
        .from("snags")
        .select("id,project_id,description,contractor_name,target_fix_date,status")
        .in("status", ["open", "in_progress", "reopened"]);
      return data ?? [];
    },
  });
  const invoicesQuery = useQuery({
    queryKey: ["briefing-invoices"],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("id,project_id,client_id,due_at,status,amount,milestone")
        .neq("status", "paid");
      return data ?? [];
    },
  });

  const doToday = useMemo(
    () => computeDoToday({ projects, tasks, snags: snagsQuery.data ?? [], invoices: (invoicesQuery.data ?? []) as any }),
    [projects, tasks, snagsQuery.data, invoicesQuery.data],
  );
  const watch = useMemo(
    () => computeWatchThisWeek({ projects, tasks, snags: (snagsQuery.data ?? []) as any }),
    [projects, tasks, snagsQuery.data],
  );
  const order = useMemo(() => computeOrderNow({ projects, tasks }), [projects, tasks]);
  const score = useMemo(
    () => computeFasttrack({ tasks, invoices: (invoicesQuery.data ?? []) as any }),
    [tasks, invoicesQuery.data],
  );

  const now = new Date();
  const today = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const hour = now.getHours();
  const partOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const greetingLabel = `Good ${partOfDay}`;
  const sectionLabel = partOfDay === "morning" ? "Morning Briefing" : partOfDay === "afternoon" ? "Afternoon Briefing" : "Evening Briefing";

  return (
    <section
      className="mb-10 rounded-[18px] p-6 md:p-8 text-[#f3ede3]"
      style={{
        background: "linear-gradient(135deg, #1f1a16 0%, #2a221c 100%)",
        boxShadow: "0 20px 60px -20px rgba(26,22,18,0.45)",
      }}
    >
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[#c17f5a] mb-2">
            <Sparkles className="h-3.5 w-3.5" /> {sectionLabel}
          </div>
          <h2 className="font-display text-3xl md:text-4xl text-[#f5ecdf]" style={{ fontFamily: "var(--font-display, 'Cormorant Garamond', serif)" }}>
            {greetingLabel}, {firstName}.
          </h2>
          <div className="text-xs text-[#c9b8a4] mt-1">{today}</div>
        </div>
        <FasttrackBadge score={score} />
      </div>

      <div className="h-px bg-[#3a302a] mb-5" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Section
          title="Do Today"
          accent="#c4685a"
          icon={<AlertCircle className="h-4 w-4" />}
          items={doToday}
          empty="All clear. Nothing burning today."
        />
        <Section
          title="Watch This Week"
          accent="#d4a574"
          icon={<Eye className="h-4 w-4" />}
          items={watch}
          empty="No risks predicted in the next 7 days."
        />
        <Section
          title="Order Now"
          accent="#7a9e8a"
          icon={<ShoppingCart className="h-4 w-4" />}
          items={order}
          empty="Procurement is ahead of schedule."
        />
      </div>
    </section>
  );
}

function FasttrackBadge({ score }: { score: FasttrackScore }) {
  const color = score.band === "green" ? "#7a9e8a" : score.band === "amber" ? "#d4a574" : "#c4685a";
  const TrendIcon = score.trend === "up" ? TrendingUp : score.trend === "down" ? TrendingDown : Minus;
  return (
    <div className="flex flex-col items-end">
      <div className="text-[10px] uppercase tracking-[0.2em] text-[#c9b8a4] mb-1">Fasttrack</div>
      <div className="flex items-baseline gap-1.5" style={{ color }}>
        <span className="font-display text-4xl leading-none">{score.score}</span>
        <span className="text-xs opacity-70">/100</span>
        <TrendIcon className="h-3.5 w-3.5 ml-1 opacity-70" />
      </div>
      <div className="text-[10px] text-[#c9b8a4] mt-1 capitalize">
        {score.band === "green" ? "On track" : score.band === "amber" ? "Some risks" : "Intervention needed"}
      </div>
    </div>
  );
}

function Section({
  title, accent, icon, items, empty,
}: { title: string; accent: string; icon: React.ReactNode; items: BriefingItem[]; empty: string }) {
  return (
    <div className="rounded-[14px] bg-[#26201b] border border-[#3a302a] p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-7 w-7 rounded-[8px] flex items-center justify-center" style={{ background: `${accent}22`, color: accent }}>
          {icon}
        </div>
        <div className="text-[11px] uppercase tracking-[0.18em] font-medium" style={{ color: accent }}>{title}</div>
        <div className="ml-auto text-[10px] text-[#c9b8a4]">{items.length}</div>
      </div>
      {items.length === 0 ? (
        <div className="text-xs text-[#c9b8a4] py-3 text-center italic">{empty}</div>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.id} className="group">
              <ItemRow item={it} accent={accent} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ItemRow({ item, accent }: { item: BriefingItem; accent: string }) {
  const to = item.action.projectId ? "/projects/$projectId" : "/projects";
  return (
    <Link
      to={to}
      params={item.action.projectId ? { projectId: item.action.projectId } : undefined as any}
      className="block rounded-[10px] bg-[#1f1a16] border border-transparent hover:border-[#3a302a] p-3 transition-colors"
    >
      <div className="flex items-start gap-2">
        {item.severity === "urgent" && (
          <span className="h-1.5 w-1.5 mt-1.5 rounded-full bg-[#c4685a] shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-sm text-[#f3ede3] leading-snug">{item.title}</div>
          {item.detail && <div className="text-[11px] text-[#c9b8a4] mt-0.5 leading-snug">{item.detail}</div>}
        </div>
      </div>
      <div className="flex items-center justify-end gap-1 mt-2 text-[11px] font-medium opacity-80 group-hover:opacity-100" style={{ color: accent }}>
        {item.action.label} <ArrowRight className="h-3 w-3" />
      </div>
    </Link>
  );
}
