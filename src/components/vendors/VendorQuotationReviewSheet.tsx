import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, X, Sparkles, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { confirmVendorTasks, type VendorParseResult, type VendorTaskMatch } from "@/lib/vendor-quotation-ai.functions";
import { WORK_TYPES } from "@/lib/task-flow";

function inr(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

type Row = VendorTaskMatch & { _id: string };

export function VendorQuotationReviewSheet({
  projectId, projectVendorId, vendorId, vendorName, parseResult, onClose,
}: {
  projectId: string;
  projectVendorId: string;
  vendorId: string;
  vendorName: string;
  parseResult: VendorParseResult;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const fn = useServerFn(confirmVendorTasks);

  const [rows, setRows] = useState<Row[]>(() =>
    parseResult.matches.map((m, i) => ({ ...m, _id: `${i}` })),
  );
  const [editing, setEditing] = useState(false);

  const updates = rows.filter((r) => r.kind === "update");
  const creates = rows.filter((r) => r.kind === "create");
  const total = useMemo(() => rows.reduce((s, r) => s + (r.item.amount || 0), 0), [rows]);

  const updateRow = (id: string, patch: Partial<Row["item"]>) =>
    setRows((rs) => rs.map((r) => (r._id === id ? { ...r, item: { ...r.item, ...patch } } : r)));
  const removeRow = (id: string) => setRows((rs) => rs.filter((r) => r._id !== id));

  const save = useMutation({
    mutationFn: () =>
      fn({
        data: {
          projectId, projectVendorId, vendorId, vendorName,
          items: rows.map((r) => ({
            kind: r.kind,
            existing_task_id: r.existingTask?.id ?? null,
            description: r.item.description,
            work_type: r.item.work_type,
            phase: r.item.phase,
            amount: r.item.amount || 0,
          })),
        },
      }),
    onSuccess: (res) => {
      toast.success(
        `${res.vendorName} added · ${res.created} created · ${res.updated} updated · ${inr(res.total)}`,
      );
      qc.invalidateQueries({ queryKey: ["project_vendors", projectId] });
      qc.invalidateQueries({ queryKey: ["vendor-documents", projectId] });
      qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["budget-rollup", projectId] });
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["project-activity", projectId] });
      window.dispatchEvent(new CustomEvent("pmstudio:goto-tab", { detail: { tab: "tasks", projectId, vendor: vendorName } }));
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  return (
    <Sheet open onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-3xl p-0 flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border">
          <SheetTitle className="text-base inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#c17f5a]" />
            AI read {parseResult.filename} — found {parseResult.items.length} line items
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            {updates.length} tasks will be updated · {creates.length} new tasks created ·{" "}
            <span className="font-medium">{vendorName}</span> assigned as agency · Total {inr(total)}
          </p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {updates.length > 0 && (
            <section>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium mb-2">
                Tasks to Update · {updates.length}
              </div>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="text-left px-2.5 py-1.5">Task</th>
                      <th className="text-left px-2.5 py-1.5 w-32">Old agency → New</th>
                      <th className="text-right px-2.5 py-1.5 w-40">Old budget → New</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {updates.map((r) => {
                      const oldAmt = r.existingTask?.boq_amount ?? 0;
                      const variance = r.item.amount - Number(oldAmt);
                      return (
                        <tr key={r._id} className="border-t border-border">
                          <td className="px-2.5 py-2">
                            <div className="font-medium truncate">{r.existingTask?.title}</div>
                            <div className="text-[10px] text-muted-foreground truncate">↳ {r.item.description}</div>
                          </td>
                          <td className="px-2.5 py-2 text-[11px]">
                            <span className="text-muted-foreground">{r.existingTask?.contractor || "—"}</span>
                            <ArrowRight className="inline h-3 w-3 mx-1 text-muted-foreground" />
                            <span className="font-medium">{vendorName}</span>
                          </td>
                          <td className="px-2.5 py-2 text-right font-mono text-[11px]">
                            <span className="text-muted-foreground">{inr(Number(oldAmt))}</span>
                            <ArrowRight className="inline h-3 w-3 mx-1 text-muted-foreground" />
                            <span className="font-medium">{inr(r.item.amount)}</span>
                            {variance !== 0 && (
                              <div className={`text-[10px] ${variance > 0 ? "text-[#c4685a]" : "text-[#4f6b5e]"}`}>
                                {variance > 0 ? "+" : ""}{inr(variance)}
                              </div>
                            )}
                          </td>
                          <td className="px-1 py-2 text-right">
                            <button onClick={() => removeRow(r._id)} className="text-muted-foreground hover:text-[#c4685a]"><X className="h-3 w-3" /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {creates.length > 0 && (
            <section>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium mb-2">
                New Tasks to Create · {creates.length}
              </div>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="text-left px-2.5 py-1.5">Task</th>
                      <th className="text-left px-2.5 py-1.5 w-32">Work type</th>
                      <th className="text-left px-2.5 py-1.5 w-28">Agency</th>
                      <th className="text-right px-2.5 py-1.5 w-28">Budget</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {creates.map((r) => (
                      <tr key={r._id} className="border-t border-border">
                        <td className="px-2.5 py-1.5">
                          {editing ? (
                            <input
                              value={r.item.description}
                              onChange={(e) => updateRow(r._id, { description: e.target.value })}
                              className="w-full bg-transparent outline-none focus:bg-muted rounded px-1 py-0.5"
                            />
                          ) : r.item.description}
                        </td>
                        <td className="px-2.5 py-1.5">
                          {editing ? (
                            <select
                              value={r.item.work_type}
                              onChange={(e) => updateRow(r._id, { work_type: e.target.value })}
                              className="w-full bg-transparent outline-none"
                            >
                              {WORK_TYPES.map((w) => <option key={w} value={w}>{w}</option>)}
                              {!WORK_TYPES.includes(r.item.work_type as typeof WORK_TYPES[number]) && (
                                <option value={r.item.work_type}>{r.item.work_type}</option>
                              )}
                            </select>
                          ) : r.item.work_type}
                        </td>
                        <td className="px-2.5 py-1.5 font-medium">{vendorName}</td>
                        <td className="px-2.5 py-1.5 text-right">
                          {editing ? (
                            <input
                              type="number"
                              value={r.item.amount || ""}
                              onChange={(e) => updateRow(r._id, { amount: Number(e.target.value) || 0 })}
                              className="w-full text-right bg-transparent outline-none focus:bg-muted rounded px-1 py-0.5 font-mono"
                            />
                          ) : <span className="font-mono">{inr(r.item.amount)}</span>}
                        </td>
                        <td className="px-1 py-1.5 text-right">
                          <button onClick={() => removeRow(r._id)} className="text-muted-foreground hover:text-[#c4685a]"><X className="h-3 w-3" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {rows.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-12">No items selected.</div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border flex items-center justify-between gap-3 bg-card">
          <button
            onClick={() => setEditing((e) => !e)}
            className="h-9 px-3 rounded-[6px] text-xs font-medium border border-border hover:bg-muted"
          >{editing ? "Done editing" : "Review & Edit"}</button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="h-9 px-3 rounded-[6px] text-xs text-muted-foreground hover:bg-muted">Cancel</button>
            <button
              disabled={save.isPending || rows.length === 0}
              onClick={() => save.mutate()}
              className="h-9 px-4 rounded-[6px] bg-[#c17f5a] text-white text-xs font-medium hover:brightness-95 inline-flex items-center gap-1.5 disabled:opacity-60"
            >
              {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Confirm & Save · {rows.length} tasks · {inr(total)}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
