import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Send, Loader2, X, AlertTriangle, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { processNarrative, confirmNarrative, type ProcessResult } from "@/lib/task-narrative.functions";
import { parsePhaseUpdate } from "@/lib/phase-ai.functions";
import { parseSiteEvent } from "@/lib/site-event.functions";
import { looksLikeSnag } from "@/lib/snags-shared";
import { SnagFromNarrativeButton } from "@/components/snags/SnagFromNarrativeButton";

export function AINarrativeBar({ projectId, teamMembers = [] }: { projectId: string; teamMembers?: { name: string; role?: string }[] }) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ProcessResult | null>(null);
  const processFn = useServerFn(processNarrative);
  const confirmFn = useServerFn(confirmNarrative);
  const phaseFn = useServerFn(parsePhaseUpdate);
  const eventFn = useServerFn(parseSiteEvent);
  const qc = useQueryClient();

  const process = useMutation({
    mutationFn: async (msg: string) => {
      const [res] = await Promise.all([
        processFn({ data: { projectId, text: msg, teamMembers } }),
        phaseFn({ data: { projectId, message: msg } }).catch(() => null),
        eventFn({ data: { projectId, message: msg } }).catch(() => null),
      ]);
      return res;
    },
    onSuccess: (res) => {
      setPreview(res);
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["phase-subs", projectId] });
      qc.invalidateQueries({ queryKey: ["project-phases", projectId] });
      qc.invalidateQueries({ queryKey: ["project-activity", projectId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const confirm = useMutation({
    mutationFn: (res: ProcessResult) => confirmFn({ data: { projectId, tasks: res.tasks } }),
    onSuccess: ({ created, updated, groupUpdates, firedMilestones }) => {
      toast.success(`Created ${created} task${created === 1 ? "" : "s"}${updated ? `, updated ${updated}` : ""}`);
      (groupUpdates ?? []).slice(0, 3).forEach((g) => {
        const arrow = g.delta > 0 ? "▲" : "▼";
        toast(`${g.group} updated — now ${g.pct}% ${arrow}${Math.abs(g.delta)}%`, { duration: 4500 });
      });
      (firedMilestones ?? []).forEach((m) => {
        const amt = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(m.invoice_amount);
        toast.success(`◆ Milestone reached — ${m.name}. Invoice ${amt} drafted, client update ready.`, { duration: 7000 });
      });
      setPreview(null);
      setText("");
      qc.invalidateQueries({ queryKey: ["project-milestones", projectId] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["ai-drafts"] });
      qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      qc.invalidateQueries({ queryKey: ["project-tasks-progress", projectId] });
      qc.invalidateQueries({ queryKey: ["project-tasks-rollup", projectId] });
      qc.invalidateQueries({ queryKey: ["project-tasks-overview", projectId] });
      qc.invalidateQueries({ queryKey: ["project-tasks-autophase", projectId] });
      qc.invalidateQueries({ queryKey: ["projects-task-completion"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="rounded-[16px] bg-[#fff7eb] border border-[#e8d9c9] p-4 mb-6" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="h-4 w-4 text-[#c17f5a]" />
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#c17f5a] font-medium">AI Update</span>
        <span className="text-[10px] text-muted-foreground ml-2">English · हिन्दी · Hinglish</span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">Updates Tasks, Timeline, Phases, and Overview automatically</p>

      <div className="flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste a site update — multiple events, multiple rooms, any language. AI will extract tasks…"
          rows={Math.min(6, Math.max(1, text.split("\n").length))}
          className="flex-1 px-4 py-3 rounded-[10px] bg-white border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 resize-none"
        />
        <button
          onClick={() => text.trim() && process.mutate(text.trim())}
          disabled={process.isPending || !text.trim() || confirm.isPending}
          className="h-11 self-start px-4 rounded-[10px] bg-[#c17f5a] text-white text-sm font-medium hover:brightness-95 inline-flex items-center gap-2 disabled:opacity-50"
        >
          {process.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Process
        </button>
      </div>

      {text.trim() && looksLikeSnag(text) && !preview && (
        <SnagFromNarrativeButton projectId={projectId} text={text.trim()} onDismiss={() => { /* dismissed */ }} />
      )}

      {preview && (
        <div className="mt-4 rounded-[12px] bg-white border border-[#e8d9c9] p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-[#c17f5a] font-medium mb-1">Preview</div>
              <div className="text-sm font-medium">
                Will create <span className="text-[#c17f5a]">{preview.summary.create_count}</span> task{preview.summary.create_count === 1 ? "" : "s"}
                {preview.summary.update_count > 0 && <> and update <span className="text-[#c17f5a]">{preview.summary.update_count}</span></>}
              </div>
            </div>
            <button onClick={() => setPreview(null)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-xs">
            <Stat label="Agencies" values={preview.summary.agencies} />
            <Stat label="Rooms" values={preview.summary.rooms} />
            <Stat label="Delays" values={preview.summary.delays ? [`${preview.summary.delays}`] : []} warn />
            <Stat label="Dependencies" values={preview.summary.dependencies ? [`${preview.summary.dependencies}`] : []} />
          </div>

          <div className="max-h-[280px] overflow-y-auto rounded-[8px] border border-border divide-y divide-border">
            {preview.tasks.map((t, i) => {
              const isDelayed = t.planned_end && t.actual_end && t.actual_end > t.planned_end;
              return (
                <div key={i} className="px-3 py-2 text-xs flex items-start gap-2 hover:bg-muted/30">
                  {t.duplicate_of
                    ? <span className="mt-0.5 text-[9px] uppercase tracking-wider text-[#8a5a1a] bg-[#d4882a30] px-1.5 py-0.5 rounded">Upd</span>
                    : <span className="mt-0.5 text-[9px] uppercase tracking-wider text-[#2f4a3d] bg-[#7a9e8a30] px-1.5 py-0.5 rounded">New</span>}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{t.description}</div>
                    <div className="text-muted-foreground text-[11px] mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                      {t.agency && <span>{t.agency}</span>}
                      {t.areas.length > 0 && <span>{t.areas.join(", ")}</span>}
                      {t.work_type && <span>{t.work_type}</span>}
                      <span className="text-[#c17f5a]">{t.status}</span>
                      {t.actual_end && <span>done {t.actual_end}</span>}
                      {isDelayed && <span className="text-[#8a2a1f] inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3" />delayed</span>}
                      {t.blocked_by.length > 0 && <span>↳ depends on {t.blocked_by.length}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-end gap-2 mt-4">
            <button
              onClick={() => setPreview(null)}
              className="h-10 px-4 rounded-[10px] border border-border text-sm font-medium hover:bg-muted"
            >
              Review & Edit
            </button>
            <button
              onClick={() => preview && confirm.mutate(preview)}
              disabled={confirm.isPending}
              className="h-10 px-4 rounded-[10px] bg-[#c17f5a] text-white text-sm font-medium hover:brightness-95 inline-flex items-center gap-2 disabled:opacity-50"
            >
              {confirm.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Confirm & Save
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, values, warn = false }: { label: string; values: string[]; warn?: boolean }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground mb-1">{label}</div>
      {values.length > 0 ? (
        <div className={`text-xs leading-snug ${warn ? "text-[#8a2a1f] font-medium" : ""}`}>
          {values.join(", ")}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">—</div>
      )}
    </div>
  );
}
