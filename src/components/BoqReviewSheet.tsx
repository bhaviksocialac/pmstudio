import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { saveBoqTasks, type BoqPreviewItem } from "@/lib/boq-checklist.functions";
import { WORK_TYPES } from "@/lib/task-flow";

function inr(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export function BoqReviewSheet({
  projectId, open, onOpenChange, initialItems,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialItems: BoqPreviewItem[];
}) {
  const [items, setItems] = useState<BoqPreviewItem[]>(initialItems);
  const qc = useQueryClient();
  const fn = useServerFn(saveBoqTasks);

  // Reset when reopened with new items
  useMemo(() => setItems(initialItems), [initialItems]);

  const totalsByType = useMemo(() => {
    const m: Record<string, number> = {};
    let total = 0;
    for (const it of items) {
      const a = it.amount ?? 0;
      total += a;
      m[it.work_type] = (m[it.work_type] ?? 0) + a;
    }
    return { groups: m, total };
  }, [items]);

  const grouped = useMemo(() => {
    const map = new Map<string, BoqPreviewItem[]>();
    for (const it of items) {
      if (!map.has(it.work_type)) map.set(it.work_type, []);
      map.get(it.work_type)!.push(it);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  const save = useMutation({
    mutationFn: () =>
      fn({ data: { projectId, items: items.map((it) => ({ ...it, amount: it.amount ?? null })) } }),
    onSuccess: (res) => {
      toast.success(`Saved ${res.created} BOQ tasks (${inr(res.total)}).`);
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["phase-subs", projectId] });
      qc.invalidateQueries({ queryKey: ["tasks-by-sub", projectId] });
      qc.invalidateQueries({ queryKey: ["project-activity", projectId] });
      qc.invalidateQueries({ queryKey: ["project-budget-rollup", projectId] });
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to save"),
  });

  const updateAt = (idx: number, patch: Partial<BoqPreviewItem>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const removeAt = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl p-0 flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-[#e8e3da]">
          <SheetTitle className="text-base">Review BOQ — {items.length} tasks · {inr(totalsByType.total)}</SheetTitle>
          <p className="text-xs text-muted-foreground">
            AI categorised your BOQ. Edit anything below, then Save to create tasks with budget amounts.
          </p>
        </SheetHeader>

        <div className="px-5 py-3 border-b border-[#e8e3da] flex flex-wrap gap-2">
          {Object.entries(totalsByType.groups)
            .sort((a, b) => b[1] - a[1])
            .map(([wt, amt]) => (
              <span key={wt} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#c17f5a18] text-[11px] text-[#6a3f27]">
                <span className="font-medium">{wt}</span>
                <span className="text-[#8a5a3f]">{inr(amt)}</span>
              </span>
            ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {grouped.map(([wt, rows]) => (
            <div key={wt}>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium mb-1.5">
                {wt} · {rows.length} · {inr(rows.reduce((s, r) => s + (r.amount ?? 0), 0))}
              </div>
              <div className="rounded-lg border border-[#e8e3da] overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-[#faf8f4] text-[10px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="text-left px-2.5 py-1.5 font-medium">Task</th>
                      <th className="text-left px-2.5 py-1.5 font-medium w-28">Work type</th>
                      <th className="text-left px-2.5 py-1.5 font-medium w-24">Area</th>
                      <th className="text-right px-2.5 py-1.5 font-medium w-28">Amount (₹)</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((it) => {
                      const idx = items.indexOf(it);
                      return (
                        <tr key={idx} className="border-t border-[#f0ebe3]">
                          <td className="px-2.5 py-1.5">
                            <input
                              value={it.title}
                              onChange={(e) => updateAt(idx, { title: e.target.value })}
                              className="w-full bg-transparent outline-none focus:bg-white focus:border focus:border-[#c17f5a] rounded px-1 py-0.5"
                            />
                          </td>
                          <td className="px-2.5 py-1.5">
                            <select
                              value={it.work_type}
                              onChange={(e) => updateAt(idx, { work_type: e.target.value })}
                              className="w-full bg-transparent outline-none border border-transparent hover:border-[#e8e3da] rounded px-1 py-0.5"
                            >
                              {WORK_TYPES.map((w) => <option key={w} value={w}>{w}</option>)}
                              {!WORK_TYPES.includes(it.work_type as typeof WORK_TYPES[number]) && (
                                <option value={it.work_type}>{it.work_type}</option>
                              )}
                            </select>
                          </td>
                          <td className="px-2.5 py-1.5">
                            <input
                              value={it.room ?? ""}
                              onChange={(e) => updateAt(idx, { room: e.target.value || null })}
                              placeholder="—"
                              className="w-full bg-transparent outline-none focus:bg-white focus:border focus:border-[#c17f5a] rounded px-1 py-0.5"
                            />
                          </td>
                          <td className="px-2.5 py-1.5">
                            <input
                              type="number"
                              value={it.amount ?? ""}
                              onChange={(e) => updateAt(idx, { amount: e.target.value === "" ? null : Number(e.target.value) })}
                              placeholder="—"
                              className="w-full text-right bg-transparent outline-none focus:bg-white focus:border focus:border-[#c17f5a] rounded px-1 py-0.5"
                            />
                          </td>
                          <td className="px-1 py-1.5 text-right">
                            <button onClick={() => removeAt(idx)} className="text-muted-foreground hover:text-[#c4685a]">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-12">No BOQ items extracted.</div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-[#e8e3da] flex items-center justify-between gap-3 bg-white">
          <button
            onClick={() => onOpenChange(false)}
            className="h-9 px-3 rounded-[6px] text-xs font-medium text-muted-foreground hover:bg-[#e8e3da55] inline-flex items-center gap-1.5"
          >
            <X className="h-3 w-3" /> Cancel
          </button>
          <button
            disabled={save.isPending || items.length === 0}
            onClick={() => save.mutate()}
            className="h-9 px-4 rounded-[6px] bg-[#c17f5a] text-white text-xs font-medium hover:brightness-95 inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Confirm &amp; Save · {items.length} tasks · {inr(totalsByType.total)}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
