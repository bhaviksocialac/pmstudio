import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

type TaskShape = {
  id: string;
  project_id: string | null;
  area: string | null;
  areas: unknown;
};
type RoomShape = { id: string; project_id: string; name: string; created_at: string };

export function RoomCleanupPanel() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<string | null>(null);

  const run = async () => {
    if (!user) return;
    setBusy(true);
    setReport(null);
    try {
      // 1) project_rooms: dedupe case-insensitively per project
      const { data: rooms, error: rErr } = await supabase
        .from("project_rooms")
        .select("id,project_id,name,created_at")
        .eq("user_id", user.id);
      if (rErr) throw rErr;

      let roomsRemoved = 0;
      let roomsRenamed = 0;
      // canonical name per (project_id, lower(name))
      const canon = new Map<string, string>(); // key=`${project}|${lower}` => canonical name
      const byProject = new Map<string, RoomShape[]>();
      (rooms ?? []).forEach((r) => {
        const arr = byProject.get(r.project_id) ?? [];
        arr.push(r as RoomShape);
        byProject.set(r.project_id, arr);
      });
      for (const [projectId, list] of byProject) {
        // sort by created_at asc — first one wins
        list.sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
        const seen = new Map<string, RoomShape>();
        for (const r of list) {
          const k = r.name.trim().toLowerCase();
          if (!seen.has(k)) {
            seen.set(k, r);
            canon.set(`${projectId}|${k}`, r.name.trim());
          } else {
            // delete duplicate row
            const { error } = await supabase.from("project_rooms").delete().eq("id", r.id);
            if (!error) roomsRemoved++;
          }
        }
        // Normalize casing on kept rows to the canonical
        for (const r of seen.values()) {
          const c = canon.get(`${projectId}|${r.name.trim().toLowerCase()}`) ?? r.name;
          if (r.name !== c) {
            await supabase.from("project_rooms").update({ name: c }).eq("id", r.id);
            roomsRenamed++;
          }
        }
      }

      // 2) Tasks: rewrite area + areas to use canonical casing per project
      const { data: tasks, error: tErr } = await supabase
        .from("tasks")
        .select("id,project_id,area,areas")
        .eq("user_id", user.id);
      if (tErr) throw tErr;

      let tasksUpdated = 0;
      for (const t of (tasks ?? []) as TaskShape[]) {
        if (!t.project_id) continue;
        const arr = Array.isArray(t.areas) && (t.areas as string[]).length
          ? (t.areas as string[])
          : (t.area ? [t.area] : []);
        if (arr.length === 0) continue;
        const seen = new Set<string>();
        const next: string[] = [];
        for (const a of arr) {
          const k = a.trim().toLowerCase();
          if (!k || seen.has(k)) continue;
          seen.add(k);
          const c = canon.get(`${t.project_id}|${k}`) ?? a.trim();
          next.push(c);
        }
        const sameArr = next.length === arr.length && next.every((v, i) => v === arr[i]);
        const newPrimary = next[0] ?? null;
        if (!sameArr || newPrimary !== t.area) {
          const { error } = await supabase.from("tasks").update({
            area: newPrimary,
            areas: next as unknown as string[],
          }).eq("id", t.id);
          if (!error) tasksUpdated++;
        }
      }

      setReport(
        `Removed ${roomsRemoved} duplicate room${roomsRemoved === 1 ? "" : "s"}, ` +
        `normalised ${roomsRenamed} room name${roomsRenamed === 1 ? "" : "s"}, ` +
        `updated ${tasksUpdated} task${tasksUpdated === 1 ? "" : "s"}.`,
      );
      toast.success("Rooms cleaned up");
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cleanup failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-[16px] border border-border bg-card p-5 md:p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="h-9 w-9 rounded-[10px] bg-[#c17f5a] text-white flex items-center justify-center shrink-0">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <h2 className="font-display text-xl">Remove duplicate rooms</h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-lg">
            Merges room tags that differ only in casing or spacing
            (e.g. "Master Bedroom" and "master bedroom") across every project,
            and updates the tasks that reference them.
          </p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <button
          onClick={run}
          disabled={busy}
          className="h-10 px-4 rounded-[8px] bg-[#1a1612] text-white text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {busy ? "Cleaning…" : "Remove duplicate rooms"}
        </button>
        {report && <span className="text-xs text-muted-foreground">{report}</span>}
      </div>
    </section>
  );
}
