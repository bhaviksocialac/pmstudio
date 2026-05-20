import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function DailyReportModal({
  projectId,
  defaultLocation,
  onClose,
}: {
  projectId: string;
  defaultLocation?: string;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState(defaultLocation ?? "");
  const [workDone, setWorkDone] = useState("");
  const [workers, setWorkers] = useState<number>(0);
  const [issues, setIssues] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const submit = useMutation({
    mutationFn: async () => {
      setUploading(true);
      const urls: string[] = [];
      for (const f of files) {
        const ext = f.name.split(".").pop() || "jpg";
        const path = `${user!.id}/${projectId}/reports/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from("project-photos").upload(path, f);
        if (!error) {
          const { data } = supabase.storage.from("project-photos").getPublicUrl(path);
          urls.push(data.publicUrl);
        }
      }
      setUploading(false);
      const { error } = await supabase.from("site_reports").insert({
        user_id: user!.id,
        project_id: projectId,
        report_date: date,
        location,
        work_done: workDone,
        workers_present: workers,
        issues,
        photo_urls: urls,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["site-reports", projectId] });
      toast.success("Report submitted");
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-card rounded-t-[20px] sm:rounded-[16px] w-full max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-card">
          <h2 className="font-display text-2xl">Daily Site Report</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={ic} />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Workers present</span>
              <input type="number" min={0} value={workers} onChange={(e) => setWorkers(+e.target.value)} className={ic} />
            </label>
          </div>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Site location</span>
            <input value={location} onChange={(e) => setLocation(e.target.value)} className={ic} />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Work done today</span>
            <textarea rows={3} value={workDone} onChange={(e) => setWorkDone(e.target.value)} className={ic + " py-2 h-auto"} placeholder="What got done on site today…" />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Issues / delays</span>
            <textarea rows={2} value={issues} onChange={(e) => setIssues(e.target.value)} className={ic + " py-2 h-auto"} placeholder="Anything blocking progress?" />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Photos</span>
            <div className="mt-1 flex items-center gap-2">
              <label className="h-10 px-3 rounded-[6px] border border-dashed border-border inline-flex items-center gap-1.5 text-xs cursor-pointer hover:bg-muted">
                <Upload className="h-3.5 w-3.5" />
                Add photos
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
              </label>
              {files.length > 0 && <span className="text-xs text-muted-foreground">{files.length} selected</span>}
            </div>
          </label>
        </div>
        <div className="px-5 py-4 border-t border-border flex justify-end gap-2 sticky bottom-0 bg-card">
          <button onClick={onClose} className="h-10 px-4 rounded-[6px] border border-border text-sm font-medium hover:bg-muted">Cancel</button>
          <button onClick={() => submit.mutate()} disabled={submit.isPending || !workDone.trim()}
            className="h-10 px-5 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95 inline-flex items-center gap-2 disabled:opacity-60">
            {(submit.isPending || uploading) && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit Report
          </button>
        </div>
      </div>
    </div>
  );
}

const ic = "w-full h-10 px-3 rounded-[10px] bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 mt-1";
