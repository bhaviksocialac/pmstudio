import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/studio-data";

type Alert = { id: string; kind: "danger" | "warn" | "info"; title: string; body?: string };

type Props = { projectId: string; projectBudget: number };

/**
 * Computes alerts on the fly from tasks + project data — no separate evaluator
 * server fn needed. Surfaces:
 *  - Quoted total exceeds project budget
 *  - Tasks with >15% cost variance (quoted vs BOQ)
 *  - Tasks with no vendor 7+ days after creation
 *  - Tasks missing boq_amount after BOQ upload
 *  - Invoiced exceeds quoted (overbilled)
 */
export function ProjectAlertsStrip({ projectId, projectBudget }: Props) {
  const { data: tasks = [] } = useQuery({
    queryKey: ["alerts-tasks", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select(
          "id,title,work_type,boq_amount,quoted_amount,invoiced_amount,vendor_id,source,created_at,deleted_at,done,status",
        )
        .eq("project_id", projectId)
        .is("deleted_at", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const alerts: Alert[] = [];
  const now = Date.now();

  // Totals
  const quotedTotal = tasks.reduce((s, t) => s + Number(t.quoted_amount ?? 0), 0);
  const invoicedTotal = tasks.reduce((s, t) => s + Number(t.invoiced_amount ?? 0), 0);

  if (projectBudget > 0 && quotedTotal > projectBudget) {
    alerts.push({
      id: "budget-exceeded",
      kind: "danger",
      title: `Quoted total exceeds budget by ${formatINR(quotedTotal - projectBudget)}`,
      body: "Review approved quotes or revise project budget.",
    });
  }

  // Per-task variance
  const highVar = tasks.filter((t) => {
    const b = Number(t.boq_amount ?? 0);
    const q = Number(t.quoted_amount ?? 0);
    if (b <= 0 || q <= 0) return false;
    return Math.abs(q - b) / b > 0.15;
  });
  if (highVar.length > 0) {
    alerts.push({
      id: "variance",
      kind: "warn",
      title: `${highVar.length} task${highVar.length > 1 ? "s" : ""} ${highVar.length > 1 ? "have" : "has"} >15% cost variance vs BOQ`,
      body: highVar
        .slice(0, 3)
        .map((t) => t.title)
        .join(" · "),
    });
  }

  // Overbilled
  const over = tasks.filter(
    (t) => Number(t.invoiced_amount ?? 0) > Number(t.quoted_amount ?? 0) && Number(t.quoted_amount ?? 0) > 0,
  );
  if (over.length > 0) {
    alerts.push({
      id: "overbilled",
      kind: "danger",
      title: `${over.length} task${over.length > 1 ? "s" : ""} invoiced above quoted amount`,
    });
  }

  // No vendor after 7 days
  const stale = tasks.filter(
    (t) =>
      !t.vendor_id &&
      !t.done &&
      t.source !== "manual" &&
      now - new Date(t.created_at).getTime() > 7 * 86_400_000,
  );
  if (stale.length > 0) {
    alerts.push({
      id: "no-vendor",
      kind: "warn",
      title: `${stale.length} BOQ task${stale.length > 1 ? "s" : ""} still without a vendor after 7+ days`,
    });
  }

  // Missing BOQ amount
  const missingBoq = tasks.filter((t) => t.source === "boq" && !t.boq_amount);
  if (missingBoq.length > 0) {
    alerts.push({
      id: "missing-boq",
      kind: "info",
      title: `${missingBoq.length} BOQ task${missingBoq.length > 1 ? "s" : ""} missing budget amount`,
      body: "Edit tasks to add an estimate.",
    });
  }

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((a) => (
        <div
          key={a.id}
          className={`flex items-start gap-2 rounded-[10px] border px-3 py-2 text-xs ${
            a.kind === "danger"
              ? "border-[#c4685a] bg-[#fff0ee] text-[#8a2a1f]"
              : a.kind === "warn"
                ? "border-[#d4882a] bg-[#fff7eb] text-[#8a5a1a]"
                : "border-border bg-muted/30 text-muted-foreground"
          }`}
        >
          {a.kind === "info" ? (
            <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          )}
          <div className="flex-1">
            <div className="font-medium">{a.title}</div>
            {a.body && <div className="opacity-80 mt-0.5">{a.body}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
