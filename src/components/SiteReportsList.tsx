import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileText } from "lucide-react";

export function SiteReportsList({ projectId }: { projectId: string }) {
  const { data: reports = [] } = useQuery({
    queryKey: ["site-reports", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_reports").select("*").eq("project_id", projectId)
        .order("report_date", { ascending: false }).limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (reports.length === 0) {
    return (
      <div className="rounded-[10px] border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No site reports yet. Use "Daily Report" above.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {reports.map((r) => {
        const photos = (r.photo_urls as string[]) ?? [];
        return (
          <div key={r.id} className="rounded-[10px] border border-border bg-card p-4">
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <div className="font-medium text-sm">{new Date(r.report_date).toLocaleDateString("en", { weekday: "short", day: "numeric", month: "short" })}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">{r.workers_present} workers</div>
            </div>
            {r.work_done && <p className="text-sm text-foreground/80 mb-1">{r.work_done}</p>}
            {r.issues && <p className="text-xs text-[#c4685a] flex items-start gap-1"><span>⚠</span><span>{r.issues}</span></p>}
            {photos.length > 0 && (
              <div className="flex gap-1.5 mt-2 overflow-x-auto">
                {photos.map((u, i) => (
                  <a key={i} href={u} target="_blank" rel="noreferrer"
                    className="h-14 w-14 rounded-[6px] bg-muted bg-cover bg-center flex-shrink-0"
                    style={{ backgroundImage: `url(${u})` }} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
