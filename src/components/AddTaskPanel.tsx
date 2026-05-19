import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { X, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PHASES, type Phase } from "@/lib/db-types";
import { suggestPhaseTasks } from "@/lib/tasks-ai.functions";

type Priority = "High" | "Medium" | "Low";

export function AddTaskPanel({
  projectId,
  projectName,
  defaultPhase,
  onClose,
}: {
  projectId: string;
  projectName: string;
  defaultPhase: Phase;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<Priority>("Medium");
  const [phase, setPhase] = useState<Phase>(defaultPhase);

  const suggestFn = useServerFn(suggestPhaseTasks);
  const suggestions = useQuery({
    queryKey: ["task-suggestions", projectId, phase],
    queryFn: () => suggestFn({ data: { phase, projectName } }),
    staleTime: 5 * 60 * 1000,
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Title is required");
      // Encode priority + phase + description in title since columns don't exist
      const encoded = `[${priority}] [${phase}] ${title.trim()}${description.trim() ? ` — ${description.trim()}` : ""}`;
      const { error } = await supabase.from("tasks").insert({
        user_id: user!.id,
        project_id: projectId,
        title: encoded,
        assignee: assignee.trim() || null,
        due_date: dueDate || null,
        done: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      toast.success("Task added");
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="absolute right-0 top-0 bottom-0 w-full max-w-lg bg-card flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-border flex items-center justify-between flex-shrink-0">
          <h3 className="font-display text-2xl">Add Task</h3>
          <button onClick={onClose} className="h-9 w-9 rounded-[10px] hover:bg-muted flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* AI Suggestions */}
          <div className="rounded-[12px] border border-border bg-[#fff7eb] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-[#c17f5a]" />
              <span className="text-sm font-medium">AI Suggested Tasks for {phase}</span>
            </div>
            {suggestions.isLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking...
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(suggestions.data?.tasks ?? []).map((t, i) => (
                  <button
                    key={i}
                    onClick={() => setTitle(t)}
                    className="text-xs px-3 py-1.5 rounded-[6px] bg-white border border-border hover:border-[#c17f5a] hover:bg-[#fff2e0]"
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Field label="Task title" required>
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Follow up with tile vendor" />
          </Field>

          <Field label="Description">
            <textarea
              className={`${inputCls} h-20 py-2 resize-none`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional details..."
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Assigned to">
              <input className={inputCls} value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="e.g. Aditya" />
            </Field>
            <Field label="Due date">
              <input type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Priority">
              <select className={inputCls} value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </Field>
            <Field label="Phase">
              <select className={inputCls} value={phase} onChange={(e) => setPhase(e.target.value as Phase)}>
                {PHASES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </Field>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-end gap-2 flex-shrink-0">
          <button onClick={onClose} className="h-10 px-4 rounded-[6px] border border-border text-sm font-medium hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={() => create.mutate()}
            disabled={create.isPending}
            className="h-10 px-5 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95 inline-flex items-center gap-2 disabled:opacity-60"
          >
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Add Task
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
        {required && <span className="text-[#c17f5a] ml-1">*</span>}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

const inputCls =
  "w-full h-10 px-3 rounded-[10px] bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring/30";
