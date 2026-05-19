import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { generateWeeklyReport } from "@/lib/ai-drafts.functions";
import { DraftCard, type DraftRow } from "./DraftCard";

export function PendingApprovals() {
  const { data: drafts = [], isLoading } = useQuery({
    queryKey: ["ai_drafts", "pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_drafts")
        .select("id, kind, recipient_kind, recipient_name, recipient_phone, subject, body, project_id, status, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DraftRow[];
    },
  });

  const qc = useQueryClient();
  const genFn = useServerFn(generateWeeklyReport);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", "names"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id, name");
      return data ?? [];
    },
  });
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));

  const genWeekly = useMutation({
    mutationFn: async () => {
      if (projects.length === 0) throw new Error("No projects to report on");
      const results = await Promise.allSettled(
        projects.map((p) => genFn({ data: { projectId: p.id } })),
      );
      return results.filter((r) => r.status === "fulfilled").length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["ai_drafts"] });
      toast.success(`Generated ${n} weekly report${n === 1 ? "" : "s"}`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (isLoading) {
    return (
      <section className="mb-8 rounded-[16px] bg-card border border-border p-5 md:p-6">
        <div className="h-20 animate-pulse bg-muted rounded-[10px]" />
      </section>
    );
  }

  return (
    <section
      className="mb-8 rounded-[16px] bg-card border border-border p-5 md:p-6"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-center gap-2 mb-5">
        <div className="h-9 w-9 rounded-[10px] bg-[#c17f5a]/15 text-[#c17f5a] flex items-center justify-center">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <h2 className="font-display text-xl">Pending Approvals</h2>
          <p className="text-xs text-muted-foreground">
            AI-drafted messages waiting for your review. Nothing sends without your approval.
          </p>
        </div>
        <button
          onClick={() => genWeekly.mutate()}
          disabled={genWeekly.isPending || projects.length === 0}
          className="h-8 px-3 rounded-[6px] border border-border text-[11px] font-medium inline-flex items-center gap-1.5 hover:bg-muted disabled:opacity-50"
        >
          {genWeekly.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
          Generate Weekly Reports
        </button>
        <span className="text-[10px] uppercase tracking-[0.18em] font-mono px-2 py-1 rounded-[6px] bg-muted">
          {drafts.length} pending
        </span>
      </div>

      {drafts.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          No drafts waiting. New AI-generated messages will appear here.
        </p>
      ) : (
        <div className="space-y-3">
          {drafts.map((d) => (
            <DraftCard
              key={d.id}
              draft={d}
              projectName={d.project_id ? projectMap.get(d.project_id) : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}
