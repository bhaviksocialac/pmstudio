import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, X, ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";

type Row = {
  id: string; room: string | null; caption: string | null;
  storage_path: string | null; project_id: string | null; created_at: string;
};

export function PhotoStaging() {
  const qc = useQueryClient();
  const { data: photos = [], isLoading } = useQuery({
    queryKey: ["photos", "pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("photos")
        .select("id, room, caption, storage_path, project_id, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", "names"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id, name");
      return data ?? [];
    },
  });
  const pmap = new Map(projects.map((p) => [p.id, p.name]));

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("photos").update({ status: "approved" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["photos"] }); toast.success("Photo approved · moved to client portal"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const reject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("photos").update({ status: "rejected" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["photos"] }); toast.success("Photo discarded"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (isLoading) return null;
  if (photos.length === 0) return null;

  return (
    <section className="mb-8 rounded-[16px] bg-card border border-border p-5 md:p-6" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-2 mb-4">
        <div className="h-9 w-9 rounded-[10px] bg-[#d4882a]/15 text-[#d4882a] flex items-center justify-center">
          <ImageIcon className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <h2 className="font-display text-xl">Photo Staging</h2>
          <p className="text-xs text-muted-foreground">Review before they hit the client portal</p>
        </div>
        <span className="text-[10px] uppercase tracking-[0.18em] font-mono px-2 py-1 rounded-[6px] bg-muted">
          {photos.length} awaiting
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {photos.map((p) => (
          <div key={p.id} className="rounded-[12px] border border-border bg-background p-3">
            <div className="aspect-video rounded-[8px] bg-muted mb-3 flex items-center justify-center text-muted-foreground">
              <ImageIcon className="h-6 w-6 opacity-40" />
            </div>
            <div className="mb-3 min-h-[40px]">
              <div className="text-sm font-medium truncate">{p.caption || "Untitled"}</div>
              <div className="text-[11px] text-muted-foreground truncate">
                {p.room ?? "Unspecified room"}
                {p.project_id && pmap.get(p.project_id) ? ` · ${pmap.get(p.project_id)}` : ""}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => approve.mutate(p.id)}
                disabled={approve.isPending}
                className="h-9 rounded-[6px] bg-[#7a9e8a] text-white text-xs font-medium inline-flex items-center justify-center gap-1.5 hover:brightness-110 disabled:opacity-60"
              >
                {approve.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Approve
              </button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="h-9 rounded-[6px] border border-border text-xs font-medium inline-flex items-center justify-center gap-1.5 hover:bg-muted text-muted-foreground">
                    <X className="h-3.5 w-3.5" /> Reject
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Discard this photo?</AlertDialogTitle>
                    <AlertDialogDescription>
                      The photo will be removed from the staging queue and never shown to the client.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => reject.mutate(p.id)}>Discard</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
