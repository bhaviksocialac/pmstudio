import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileText, CheckCircle2, IndianRupee, Truck, ClipboardCheck, Flag, ListChecks } from "lucide-react";
import { phaseOfTask, PROJECT_PHASES, type ProjectPhase } from "@/lib/task-flow";

type Event = {
  ts: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  tone: string;
  phase: ProjectPhase;
  group: string; // agency or work type
};

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export function ProjectActivityFeed({ projectId }: { projectId: string }) {
  const { data: events = [] } = useQuery({
    queryKey: ["project-activity", projectId],
    queryFn: async (): Promise<Event[]> => {
      const [appr, pay, deliv, taskRows, phaseRows, drafts, subs] = await Promise.all([
        supabase.from("approvals").select("title,status,approved_at,updated_at,created_at").eq("project_id", projectId),
        supabase.from("payment_requests").select("amount,scope,vendor_id,status,created_at,updated_at").eq("project_id", projectId),
        supabase.from("vendor_deliveries").select("item,status,expected_date,vendor_id,updated_at,created_at").eq("project_id", projectId),
        supabase.from("tasks").select("title,done,status,work_type,agency,contractor,updated_at,created_at").eq("project_id", projectId).eq("done", true).order("updated_at", { ascending: false }).limit(50),
        supabase.from("project_phases").select("phase,status,end_date,updated_at").eq("project_id", projectId).eq("status", "done"),
        supabase.from("ai_drafts").select("kind,recipient_name,subject,created_at").eq("project_id", projectId).in("kind", ["boq" as never, "po" as never] as never),
        supabase.from("phase_subcategories").select("name,phase,status,end_date,updated_at").eq("project_id", projectId).eq("status", "done"),
      ]);

      const vendorIds = Array.from(new Set([
        ...((pay.data ?? []).map((p) => p.vendor_id).filter(Boolean) as string[]),
        ...((deliv.data ?? []).map((d) => d.vendor_id).filter(Boolean) as string[]),
      ]));
      const vendorMap = new Map<string, string>();
      if (vendorIds.length) {
        const { data } = await supabase.from("vendors").select("id,name,company_name").in("id", vendorIds);
        (data ?? []).forEach((v) => vendorMap.set(v.id, (v as { company_name?: string; name: string }).company_name || v.name));
      }

      const ev: Event[] = [];

      (appr.data ?? []).forEach((a) => {
        if (a.status === "approved") {
          ev.push({ ts: a.approved_at ?? a.updated_at, icon: ClipboardCheck, label: `Client approved — ${a.title}`, tone: "#7a9e8a", phase: "Design", group: "Approvals" });
        } else if (a.status === "pending") {
          ev.push({ ts: a.created_at, icon: ClipboardCheck, label: `Approval requested — ${a.title}`, tone: "#d4882a", phase: "Design", group: "Approvals" });
        }
      });

      (pay.data ?? []).forEach((p) => {
        const vname = p.vendor_id ? vendorMap.get(p.vendor_id) : null;
        ev.push({
          ts: p.created_at, icon: IndianRupee,
          label: `Payment ₹${Number(p.amount).toLocaleString("en-IN")}${vname ? ` to ${vname}` : ""}${p.scope ? ` (${p.scope})` : ""}`,
          tone: "#c17f5a", phase: "Procurement", group: vname || "Vendor payments",
        });
      });

      (deliv.data ?? []).forEach((d) => {
        const vname = d.vendor_id ? vendorMap.get(d.vendor_id) : null;
        const verb = d.status === "delivered" ? "Delivered" : d.status === "delayed" ? "Delivery delayed" : "Delivery scheduled";
        ev.push({
          ts: d.updated_at ?? d.created_at, icon: Truck,
          label: `${verb} — ${d.item}${vname ? ` from ${vname}` : ""}`,
          tone: d.status === "delayed" ? "#c4685a" : "#7a9e8a",
          phase: "Procurement", group: vname || "Deliveries",
        });
      });

      (taskRows.data ?? []).forEach((t) => {
        const m = t.title.match(/\[(.+?)\]\s*\[(.+?)\]\s*(.+)/);
        const label = m ? m[3] : t.title;
        const phase = phaseOfTask(t as never);
        const group = t.work_type || t.agency || t.contractor || "Tasks";
        ev.push({ ts: t.updated_at, icon: CheckCircle2, label: `Task complete — ${label}`, tone: "#7a9e8a", phase, group });
      });

      (phaseRows.data ?? []).forEach((p) => {
        ev.push({ ts: p.end_date ?? p.updated_at, icon: Flag, label: `${p.phase} phase complete`, tone: "#7a9e8a", phase: p.phase as ProjectPhase, group: "Milestones" });
      });

      (subs.data ?? []).forEach((s) => {
        ev.push({ ts: s.end_date ?? s.updated_at, icon: ListChecks, label: `${s.phase} → ${s.name} marked done`, tone: "#7a9e8a", phase: s.phase as ProjectPhase, group: s.name });
      });

      (drafts.data ?? []).forEach((d) => {
        ev.push({ ts: d.created_at, icon: FileText, label: `${d.kind === "boq" ? "BOQ" : "PO"} ${d.subject ? `— ${d.subject}` : ""}${d.recipient_name ? ` (${d.recipient_name})` : ""}`, tone: "#c17f5a", phase: "Procurement", group: d.recipient_name || "Documents" });
      });

      return ev.filter((e) => e.ts).sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
    },
  });

  const grouped = useMemo(() => {
    const phaseMap = new Map<ProjectPhase, Map<string, Event[]>>();
    events.forEach((e) => {
      if (!phaseMap.has(e.phase)) phaseMap.set(e.phase, new Map());
      const g = phaseMap.get(e.phase)!;
      const arr = g.get(e.group) ?? [];
      arr.push(e);
      g.set(e.group, arr);
    });
    return PROJECT_PHASES.filter((p) => phaseMap.has(p)).map((p) => ({
      phase: p,
      groups: Array.from(phaseMap.get(p)!.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([group, items]) => ({ group, items })),
    }));
  }, [events]);

  return (
    <div className="rounded-[16px] border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display text-xl">Activity</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Grouped by phase, then by agency or work type.</p>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{events.length} events</span>
      </div>
      {events.length === 0 ? (
        <div className="text-xs text-muted-foreground italic py-6 text-center">No activity yet. Events appear here as work happens.</div>
      ) : (
        <div className="space-y-6 max-h-[520px] overflow-y-auto pr-2">
          {grouped.map(({ phase, groups }) => (
            <section key={phase}>
              <h4 className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold mb-3 pb-1.5 border-b border-border">
                {phase}
              </h4>
              <div className="space-y-4">
                {groups.map(({ group, items }) => (
                  <div key={group}>
                    <div className="text-[11px] font-medium text-foreground mb-2">{group}</div>
                    <ul className="relative pl-5 space-y-2">
                      <div className="absolute left-1.5 top-1 bottom-1 w-px bg-border" />
                      {items.map((e, i) => {
                        const Icon = e.icon;
                        return (
                          <li key={i} className="relative">
                            <span className="absolute -left-[14px] top-1 h-2.5 w-2.5 rounded-full border-2 border-card" style={{ background: e.tone }} />
                            <div className="flex items-start gap-2 text-xs">
                              <Icon className="h-3.5 w-3.5 mt-[1px] shrink-0" style={{ color: e.tone }} />
                              <div className="flex-1">
                                <div className="text-foreground">{e.label}</div>
                                <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{fmt(e.ts)}</div>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
