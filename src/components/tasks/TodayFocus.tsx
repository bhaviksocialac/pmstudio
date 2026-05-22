import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertCircle, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_META, PRIORITY_META, isUrgent } from "@/lib/task-flow";

type Row = {
  id: string; project_id: string | null; title: string;
  status: string | null; priority: string | null; area: string | null;
  due_date: string | null; done: boolean; action_required: boolean | null; action_label: string | null;
};

export function TodayFocus() {
  const q = useQuery({
    queryKey: ["today-focus"],
    queryFn: async () => {
      const [{ data: tasks }, { data: projects }] = await Promise.all([
        supabase.from("tasks")
          .select("id,project_id,title,status,priority,area,due_date,done,action_required,action_label")
          .neq("status", "done").eq("done", false)
          .limit(200),
        supabase.from("projects").select("id,name"),
      ]);
      const projMap = new Map<string, string>((projects ?? []).map((p) => [p.id, p.name]));
      const scored = (tasks ?? []).map((t) => {
        const urgent = isUrgent(t);
        let score = 0;
        if (t.action_required) score += 100;
        if (urgent) score += 80;
        if (t.priority === "Urgent") score += 60;
        if (t.priority === "High") score += 30;
        if (t.due_date) {
          const days = (new Date(t.due_date).getTime() - Date.now()) / 86400000;
          if (days < 0) score += 50;
          else if (days < 3) score += 25;
        }
        return { ...t, score, projectName: t.project_id ? projMap.get(t.project_id) : null };
      });
      return scored.filter((r) => r.score > 0).sort((a, b) => b.score - a.score).slice(0, 6) as Array<Row & { score: number; projectName: string | null }>;
    },
  });

  if (!q.data || q.data.length === 0) return null;

  return (
    <section className="mb-10">
      <div className="flex items-baseline justify-between mb-5">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-[#c4685a] mb-1 flex items-center gap-1.5">
            <Flame className="h-3 w-3" /> Needs Attention
          </div>
          <h2 className="font-display text-2xl">Today's Focus</h2>
        </div>
        
      </div>
      <div className="rounded-[16px] bg-card border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
        <ul className="divide-y divide-border">
          {q.data.map((t) => {
            const sc = STATUS_META[t.status ?? "not_started"] ?? STATUS_META.not_started;
            const pc = PRIORITY_META[t.priority ?? "Medium"] ?? PRIORITY_META.Medium;
            return (
              <li key={t.id} className="px-5 py-4 hover:bg-muted/20 transition-colors">
                <Link
                  to={t.project_id ? "/projects/$projectId" : "/tasks"}
                  params={t.project_id ? { projectId: t.project_id } : undefined as never}
                  className="flex items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{t.title}</span>
                      {t.action_required && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] bg-[#c4685a22] text-[#8a2a1f] text-[9px] font-medium uppercase tracking-wider">
                          <AlertCircle className="h-2.5 w-2.5" /> Action
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                      {t.projectName && <span>{t.projectName}</span>}
                      {t.area && <><span>·</span><span>{t.area}</span></>}
                      {t.action_label && <><span>·</span><span className="text-[#8a2a1f]">{t.action_label}</span></>}
                    </div>
                  </div>
                  <span className="inline-flex items-center px-2 py-1 rounded-[6px] text-[10px] uppercase tracking-wider font-mono whitespace-nowrap"
                    style={{ background: pc.bg, color: pc.fg }}>{t.priority ?? "Medium"}</span>
                  <span className="inline-flex items-center px-2 py-1 rounded-[6px] text-[10px] uppercase tracking-wider font-mono whitespace-nowrap"
                    style={{ background: sc.bg, color: sc.fg }}>{sc.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
