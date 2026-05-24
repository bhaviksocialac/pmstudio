import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Loader2, RefreshCw, Send, MessageCircle, Mail, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { generateDailyReport, sendReportToClient } from "@/lib/daily-reports.functions";

type Report = {
  id: string;
  report_date: string;
  pdf_url: string | null;
  summary: {
    workersTotal?: number;
    tasksCompleted?: number;
    photos?: number;
    snags?: number;
    tomorrow?: number;
  } | null;
  workers_present: number | null;
  work_done: string | null;
  issues: string | null;
  sent_to_client_at: string | null;
  auto_generated: boolean;
};

export function SiteReportsList({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const generateFn = useServerFn(generateDailyReport);
  const sendFn = useServerFn(sendReportToClient);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["site-reports", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_reports")
        .select(
          "id, report_date, pdf_url, summary, workers_present, work_done, issues, sent_to_client_at, auto_generated",
        )
        .eq("project_id", projectId)
        .order("report_date", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as Report[];
    },
  });

  const generate = useMutation({
    mutationFn: () => generateFn({ data: { projectId } }),
    onSuccess: (r) => {
      if ("skipped" in r && r.skipped) {
        toast.message("Already generated for today.");
      } else if (r.ok) {
        toast.success("Today's report generated.");
      } else {
        toast.error("error" in r ? r.error ?? "Failed" : "Failed");
      }
      qc.invalidateQueries({ queryKey: ["site-reports", projectId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  async function handleSend(id: string) {
    setSendingId(id);
    try {
      const r = await sendFn({ data: { reportId: id } });
      if (!r.ok) {
        toast.error("error" in r ? r.error ?? "Failed to send" : "Failed");
        return;
      }
      if (r.emailSent) toast.success("Emailed to client.");
      else if (r.emailError) toast.warning(`Email skipped: ${r.emailError}`);
      if (r.whatsappUrl) window.open(r.whatsappUrl, "_blank", "noopener");
      qc.invalidateQueries({ queryKey: ["site-reports", projectId] });
    } finally {
      setSendingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[12px] border border-[#e8d9c9] bg-[#fff7eb] p-4 flex items-start gap-3">
        <div className="h-9 w-9 rounded-full bg-white border border-[#e8d9c9] flex items-center justify-center text-[#c17f5a]">
          <FileText className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">Auto-generated daily reports</div>
          <p className="text-xs text-muted-foreground mt-0.5">
            A formal PDF report is compiled automatically every evening from today's tasks,
            attendance, photos and snags. Tap <b>Send to client</b> to share via email and WhatsApp.
          </p>
        </div>
        <button
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
          className="h-9 px-3 rounded-[8px] border border-[#c17f5a]/40 bg-white text-[#c17f5a] text-xs font-medium inline-flex items-center gap-1.5 hover:bg-[#c17f5a]/5 disabled:opacity-50"
        >
          {generate.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Generate now
        </button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground p-6 text-center">Loading…</div>
      ) : reports.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No reports yet. The first one will be generated automatically this evening, or tap "Generate now".
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => {
            const dateLabel = new Date(r.report_date).toLocaleDateString("en-IN", {
              weekday: "short",
              day: "numeric",
              month: "short",
            });
            const s = r.summary ?? {};
            return (
              <div key={r.id} className="rounded-[12px] border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-sm">{dateLabel}</div>
                      {r.sent_to_client_at && (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-[#7a9e8a]">
                          <CheckCircle2 className="h-3 w-3" /> Sent
                        </span>
                      )}
                      {!r.pdf_url && (
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          legacy
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                      <span>{s.workersTotal ?? r.workers_present ?? 0} workers</span>
                      <span>•</span>
                      <span>{s.tasksCompleted ?? 0} tasks done</span>
                      <span>•</span>
                      <span>{s.photos ?? 0} photos</span>
                      {(s.snags ?? 0) > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-[#c4685a]">{s.snags} snag(s)</span>
                        </>
                      )}
                    </div>
                    {r.work_done && (
                      <p className="text-xs text-foreground/70 mt-1.5 line-clamp-2">{r.work_done}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {r.pdf_url && (
                      <a
                        href={r.pdf_url}
                        target="_blank"
                        rel="noreferrer"
                        className="h-9 px-3 rounded-[6px] border border-border text-xs font-medium hover:bg-muted inline-flex items-center gap-1.5"
                      >
                        <FileText className="h-3.5 w-3.5" /> View PDF
                      </a>
                    )}
                    {r.pdf_url && (
                      <button
                        onClick={() => handleSend(r.id)}
                        disabled={sendingId === r.id}
                        className="h-9 px-3 rounded-[6px] bg-[#c17f5a] text-white text-xs font-medium inline-flex items-center gap-1.5 hover:brightness-95 disabled:opacity-50"
                      >
                        {sendingId === r.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                        Send to client
                      </button>
                    )}
                  </div>
                </div>
                {r.sent_to_client_at && (
                  <div className="mt-2 pt-2 border-t border-border/60 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Mail className="h-3 w-3" /> emailed
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle className="h-3 w-3" /> WhatsApp ready
                    </span>
                    <span className="ml-auto">
                      Sent {new Date(r.sent_to_client_at).toLocaleString("en-IN")}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
