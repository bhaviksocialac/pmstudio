import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, ChevronDown, ChevronRight, Trash2, Loader2, Sparkles, X as XIcon, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { generateSubcategoryChecklist } from "@/lib/checklist-ai.functions";


const PROCUREMENT_DEFAULTS = [
  "Civil Materials", "Carpentry Materials", "Electrical Materials", "Plumbing Materials",
  "Flooring Materials", "Painting Materials", "Furniture and Fixtures", "Lighting", "Hardware", "Other",
];
const EXECUTION_DEFAULTS = [
  "Civil Work", "Carpentry Work", "Electrical Work", "Plumbing Work",
  "Flooring Work", "Painting Work", "Furniture Installation", "False Ceiling", "Tiling", "Other",
];

const STATUSES = ["planned", "in_progress", "delayed", "done"] as const;
const statusColor: Record<string, string> = {
  planned: "#6b5f58",
  in_progress: "#c17f5a",
  delayed: "#c4685a",
  done: "#7a9e8a",
};

type ChecklistItem = { label: string; done: boolean };
type Sub = {
  id: string;
  name: string;
  vendor_id: string | null;
  contractor_name: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  checklist: ChecklistItem[] | null;
};
type SubVendor = { id: string; subcategory_id: string; vendor_id: string; scope: string | null; amount: number };


export function PhaseSubcategoriesPanel({
  projectId,
  phase,
}: {
  projectId: string;
  phase: "Procurement" | "Execution";
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const { data: subs = [], isLoading } = useQuery({
    queryKey: ["phase-subs", projectId, phase],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("phase_subcategories")
        .select("*")
        .eq("project_id", projectId)
        .eq("phase", phase)
        .order("order_index");
      if (error) throw error;
      return (data ?? []) as Sub[];
    },
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors-light"],
    queryFn: async () => {
      const { data } = await supabase.from("vendors").select("id,name").order("name");
      return data ?? [];
    },
  });

  const { data: tasksByName = {} } = useQuery({
    queryKey: ["tasks-by-sub", projectId, phase],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks").select("id,title,done").eq("project_id", projectId);
      const map: Record<string, { id: string; title: string; done: boolean }[]> = {};
      (data ?? []).forEach((t) => {
        // tasks are encoded "[Priority] [Phase/Sub] title"
        const m = t.title.match(/\[(.+?)\]\s*\[(.+?)\]\s*(.+)/);
        if (m) {
          const subName = m[2];
          if (!map[subName]) map[subName] = [];
          map[subName].push({ id: t.id, title: m[3], done: t.done });
        }
      });
      return map;
    },
  });

  const seed = useMutation({
    mutationFn: async () => {
      const defaults = phase === "Procurement" ? PROCUREMENT_DEFAULTS : EXECUTION_DEFAULTS;
      const rows = defaults.map((name, i) => ({
        user_id: user!.id, project_id: projectId, phase, name, order_index: i, status: "planned",
      }));
      const { error } = await supabase.from("phase_subcategories").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["phase-subs", projectId, phase] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const addOne = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("phase_subcategories").insert({
        user_id: user!.id, project_id: projectId, phase, name, order_index: subs.length, status: "planned",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["phase-subs", projectId, phase] });
      setNewName(""); setAdding(false);
      toast.success("Subcategory added");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const updateSub = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Sub> }) => {
      const { error } = await supabase.from("phase_subcategories").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["phase-subs", projectId, phase] }),
  });

  const deleteSub = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("phase_subcategories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["phase-subs", projectId, phase] }),
  });

  if (isLoading) return <div className="text-xs text-muted-foreground">Loading…</div>;

  if (subs.length === 0) {
    return (
      <div className="rounded-[10px] border border-dashed border-border p-6 text-center">
        <p className="text-sm text-muted-foreground mb-3">No {phase} subcategories yet.</p>
        <button
          onClick={() => seed.mutate()}
          disabled={seed.isPending}
          className="h-9 px-4 rounded-[6px] bg-primary text-primary-foreground text-xs font-medium hover:brightness-95 inline-flex items-center gap-2 disabled:opacity-60"
        >
          {seed.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Add default subcategories
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {subs.map((s) => {
        const open = expanded[s.id];
        const tasks = tasksByName[s.name] ?? [];
        return (
          <div key={s.id} className="rounded-[10px] border border-border bg-card overflow-hidden">
            <button
              onClick={() => setExpanded((e) => ({ ...e, [s.id]: !open }))}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted/40 text-left"
            >
              {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              <span className="font-medium text-sm flex-1">{s.name}</span>
              {s.contractor_name && <span className="text-xs text-muted-foreground hidden sm:inline">{s.contractor_name}</span>}
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-[6px]"
                style={{ background: `${statusColor[s.status]}22`, color: statusColor[s.status] }}>
                {s.status.replace("_", " ")}
              </span>
            </button>
            {open && (
              <div className="px-4 pb-4 pt-2 border-t border-border space-y-3 bg-[#faf8f5]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Vendor</span>
                    <select
                      className={ic}
                      value={s.vendor_id ?? ""}
                      onChange={(e) => updateSub.mutate({ id: s.id, patch: { vendor_id: e.target.value || null } })}
                    >
                      <option value="">— none —</option>
                      {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Contractor</span>
                    <input
                      className={ic}
                      defaultValue={s.contractor_name ?? ""}
                      onBlur={(e) => updateSub.mutate({ id: s.id, patch: { contractor_name: e.target.value || null } })}
                      placeholder="e.g. Ramesh & Co."
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Start date</span>
                    <input type="date" className={ic} defaultValue={s.start_date ?? ""}
                      onBlur={(e) => updateSub.mutate({ id: s.id, patch: { start_date: e.target.value || null } })} />
                  </label>
                  <label className="block">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">End date</span>
                    <input type="date" className={ic} defaultValue={s.end_date ?? ""}
                      onBlur={(e) => updateSub.mutate({ id: s.id, patch: { end_date: e.target.value || null } })} />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</span>
                    <select className={ic} value={s.status}
                      onChange={(e) => updateSub.mutate({ id: s.id, patch: { status: e.target.value } })}>
                      {STATUSES.map((st) => <option key={st} value={st}>{st.replace("_", " ")}</option>)}
                    </select>
                  </label>
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Tasks</div>
                  {tasks.length === 0 ? (
                    <div className="text-xs text-muted-foreground italic">No tasks yet. Add via "Add Task" with this subcategory as phase.</div>
                  ) : (
                    <ul className="space-y-1">
                      {tasks.map((t) => (
                        <li key={t.id} className="text-xs flex items-center gap-2">
                          <span className={`h-1.5 w-1.5 rounded-full ${t.done ? "bg-[#7a9e8a]" : "bg-[#c17f5a]"}`} />
                          <span className={t.done ? "line-through text-muted-foreground" : ""}>{t.title}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <button onClick={() => deleteSub.mutate(s.id)}
                  className="text-xs text-[#c4685a] inline-flex items-center gap-1 hover:underline">
                  <Trash2 className="h-3 w-3" /> Remove subcategory
                </button>
              </div>
            )}
          </div>
        );
      })}

      {adding ? (
        <div className="flex gap-2">
          <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Subcategory name…"
            className={ic} onKeyDown={(e) => { if (e.key === "Enter" && newName.trim()) addOne.mutate(newName.trim()); }} />
          <button onClick={() => newName.trim() && addOne.mutate(newName.trim())}
            className="h-10 px-4 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium">Add</button>
          <button onClick={() => { setAdding(false); setNewName(""); }}
            className="h-10 px-3 rounded-[6px] border border-border text-sm">Cancel</button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="h-9 px-3 rounded-[6px] border border-dashed border-border text-xs font-medium hover:bg-muted inline-flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add Subcategory
        </button>
      )}
    </div>
  );
}

const ic = "w-full h-10 px-3 rounded-[10px] bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 mt-1";
