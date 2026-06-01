import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { getProjectBudgetRollup } from "@/lib/vendor-assignment.functions";
import { formatINR } from "@/lib/studio-data";

type Props = { projectId: string; projectBudget: number };

export function BudgetReconciliationPanel({ projectId, projectBudget }: Props) {
  const fn = useServerFn(getProjectBudgetRollup);
  const [withGst, setWithGst] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["budget-rollup", projectId],
    queryFn: () => fn({ data: { projectId } }),
  });

  const factor = withGst ? 1.18 : 1;
  const totals = data?.totals ?? { boq: 0, quoted: 0, invoiced: 0 };
  const rows = data?.rows ?? [];

  const boq = totals.boq * factor;
  const quoted = totals.quoted * factor;
  const invoiced = totals.invoiced * factor;

  const variance = boq > 0 ? ((quoted - boq) / boq) * 100 : 0;
  const overBudget = projectBudget > 0 && quoted > projectBudget * factor;

  return (
    <div
      className="rounded-[16px] bg-card border border-border p-6"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="font-display text-xl">Budget Reconciliation</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            BOQ estimate vs vendor quotes vs invoices received
          </p>
        </div>
        <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={withGst}
            onChange={(e) => setWithGst(e.target.checked)}
            className="accent-[#c17f5a]"
          />
          Incl. GST 18%
        </label>
      </div>

      {isLoading ? (
        <div className="h-32 animate-pulse bg-muted/30 rounded-[8px]" />
      ) : (
        <>
          {/* Three layers */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <Stat label="BOQ Estimate" value={boq} accent="#8a7d6e" sub={`${rows.length} categories`} />
            <Stat
              label="Approved Quotes"
              value={quoted}
              accent="#c17f5a"
              sub={
                variance === 0
                  ? "—"
                  : variance > 0
                    ? `+${variance.toFixed(1)}% vs BOQ`
                    : `${variance.toFixed(1)}% vs BOQ`
              }
              variance={variance}
            />
            <Stat
              label="Invoiced"
              value={invoiced}
              accent={invoiced > quoted && quoted > 0 ? "#c4685a" : "#7a9e8a"}
              sub={quoted > 0 ? `${Math.round((invoiced / quoted) * 100)}% of quoted` : "—"}
            />
          </div>

          {overBudget && (
            <div className="mb-4 text-xs rounded-[8px] border border-[#c4685a] bg-[#fff0ee] px-3 py-2 text-[#8a2a1f]">
              Quoted total ({formatINR(quoted)}) exceeds project budget ({formatINR(projectBudget * factor)}).
            </div>
          )}

          {/* Breakdown table */}
          {rows.length > 0 && (
            <div className="rounded-[10px] border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Work Type</th>
                    <th className="text-right px-3 py-2 font-medium">BOQ</th>
                    <th className="text-right px-3 py-2 font-medium">Quoted</th>
                    <th className="text-right px-3 py-2 font-medium">Invoiced</th>
                    <th className="text-right px-3 py-2 font-medium w-20">Δ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r) => {
                    const rb = r.boq * factor;
                    const rq = r.quoted * factor;
                    const ri = r.invoiced * factor;
                    const v = rb > 0 ? ((rq - rb) / rb) * 100 : 0;
                    return (
                      <tr key={r.work_type}>
                        <td className="px-3 py-2 font-medium">{r.work_type}</td>
                        <td className="px-3 py-2 text-right font-mono">{rb ? formatINR(rb) : "—"}</td>
                        <td className="px-3 py-2 text-right font-mono">{rq ? formatINR(rq) : "—"}</td>
                        <td className="px-3 py-2 text-right font-mono">{ri ? formatINR(ri) : "—"}</td>
                        <td
                          className="px-3 py-2 text-right font-mono"
                          style={{ color: v > 5 ? "#c4685a" : v < -5 ? "#7a9e8a" : "#8a7d6e" }}
                        >
                          {rb > 0 && rq > 0 ? `${v > 0 ? "+" : ""}${v.toFixed(0)}%` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  sub,
  variance,
}: {
  label: string;
  value: number;
  accent: string;
  sub: string;
  variance?: number;
}) {
  const Icon =
    variance === undefined ? null : Math.abs(variance) < 1 ? Minus : variance > 0 ? TrendingUp : TrendingDown;
  return (
    <div className="rounded-[12px] border border-border bg-muted/20 px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-display text-2xl mt-1 font-mono" style={{ color: accent }}>
        {value > 0 ? formatINR(value) : "—"}
      </div>
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
        {Icon && <Icon className="h-3 w-3" />}
        <span>{sub}</span>
      </div>
    </div>
  );
}
