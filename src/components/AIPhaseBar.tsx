import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Send, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { parsePhaseUpdate } from "@/lib/phase-ai.functions";
import { parseSiteEvent } from "@/lib/site-event.functions";
import { interpretTaskUpdate } from "@/lib/task-ai.functions";

export function AIPhaseBar({ projectId }: { projectId: string }) {
  const [text, setText] = useState("");
  const [lastReply, setLastReply] = useState<string | null>(null);
  const parseFn = useServerFn(parsePhaseUpdate);
  const eventFn = useServerFn(parseSiteEvent);
  const taskFn = useServerFn(interpretTaskUpdate);
  const qc = useQueryClient();

  const submit = useMutation({
    mutationFn: async (message: string) => {
      const [phaseRes, eventRes, taskRes] = await Promise.all([
        parseFn({ data: { projectId, message } }),
        eventFn({ data: { projectId, message } }),
        taskFn({ data: { projectId, text: message } }).catch(() => null),
      ]);
      return { phaseRes, eventRes, taskRes };
    },
    onSuccess: ({ phaseRes, eventRes, taskRes }) => {
      const parts = [
        taskRes?.matched ? taskRes.reply : null,
        phaseRes.reply,
        eventRes.applied.length ? eventRes.reply : null,
      ].filter(Boolean);
      const combined = parts.join(" ");
      setLastReply(combined || phaseRes.reply);
      setText("");
      toast.success(combined || phaseRes.reply);
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["phase-subs", projectId] });
      qc.invalidateQueries({ queryKey: ["project-phases", projectId] });
      qc.invalidateQueries({ queryKey: ["payment_requests"] });
      qc.invalidateQueries({ queryKey: ["vendor_deliveries"] });
      qc.invalidateQueries({ queryKey: ["approvals"] });
      qc.invalidateQueries({ queryKey: ["project-activity", projectId] });
      qc.invalidateQueries({ queryKey: ["all-tasks"] });
      qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      qc.invalidateQueries({ queryKey: ["project-tasks-progress", projectId] });
      qc.invalidateQueries({ queryKey: ["project-tasks-rollup", projectId] });
      qc.invalidateQueries({ queryKey: ["project-tasks-overview", projectId] });
      qc.invalidateQueries({ queryKey: ["project-tasks-autophase", projectId] });
      qc.invalidateQueries({ queryKey: ["projects-task-completion"] });
      qc.invalidateQueries({ queryKey: ["project-tasks-grid", projectId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });


  return (
    <div className="rounded-[16px] bg-[#fff7eb] border border-[#e8d9c9] p-4 mb-6" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-4 w-4 text-[#c17f5a]" />
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#c17f5a] font-medium">AI Site Update</span>
      </div>
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && text.trim() && !submit.isPending) submit.mutate(text.trim()); }}
          placeholder="Tell AI what happened on site today..."
          className="flex-1 h-11 px-4 rounded-[10px] bg-white border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
        />
        <button
          onClick={() => text.trim() && submit.mutate(text.trim())}
          disabled={submit.isPending || !text.trim()}
          className="h-11 px-4 rounded-[10px] bg-[#c17f5a] text-white text-sm font-medium hover:brightness-95 inline-flex items-center gap-2 disabled:opacity-50"
        >
          {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Update
        </button>
      </div>
      {lastReply && (
        <div className="mt-2 text-xs text-foreground flex items-start gap-2">
          <span className="text-[#7a9e8a]">✓</span>
          <span>{lastReply}</span>
          <button onClick={() => setLastReply(null)} className="ml-auto text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
        </div>
      )}
    </div>
  );
}
