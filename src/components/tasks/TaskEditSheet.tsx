import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_ORDER, STATUS_META, PRIORITY_META, WORK_TYPES } from "@/lib/task-flow";
import type { TaskRow } from "./TaskTable";
import { asWorkTypes } from "./TaskTable";
import { AgencyPicker, AreaPicker, DependencyPicker, DateField, WorkTypePicker } from "./TaskInlineEditors";

export function TaskEditSheet({
  task, open, onClose, onChanged, allTasks, vendors, teamMembers = [], rooms, onAddRoom,
}: {
  task: TaskRow | null;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
  allTasks: TaskRow[];
  vendors: { id: string; name: string }[];
  teamMembers?: { name: string; role?: string }[];
  rooms: string[];
  onAddRoom: (r: string) => void;
}) {
  const [draft, setDraft] = useState<TaskRow | null>(task);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => { setDraft(task); }, [task]);

  if (!draft) return null;

  const patch = (p: Partial<TaskRow>) => setDraft({ ...draft, ...p } as TaskRow);

  const save = async () => {
    if (!draft) return;
    const areasArr = (Array.isArray(draft.areas) ? (draft.areas as string[]) : (draft.area ? [draft.area] : [])) as string[];
    const payload = {
      title: draft.title,
      description: draft.description,
      work_type: (Array.isArray((draft as TaskRow).work_types) ? ((draft as TaskRow).work_types as string[])[0] : draft.work_type) ?? null,
      work_types: (Array.isArray((draft as TaskRow).work_types) ? (draft as TaskRow).work_types : (draft.work_type ? [draft.work_type] : [])) as unknown as string[],
      agency: draft.agency,
      contractor: draft.agency,
      status: draft.status ?? "not_started",
      done: draft.status === "done",
      priority: draft.priority ?? "Medium",
      area: areasArr[0] ?? null,
      areas: areasArr as unknown as string[],
      planned_start: draft.planned_start,
      planned_end: draft.planned_end,
      actual_start: draft.actual_start,
      actual_end: draft.actual_end,
      ifr_date: draft.ifr_date,
      ifa_date: draft.ifa_date,
      ifc_date: draft.ifc_date,
      start_date: draft.actual_start ?? draft.planned_start,
      due_date: draft.actual_end ?? draft.planned_end,
      depends_on: (Array.isArray(draft.depends_on) ? (draft.depends_on as string[]) : []) as unknown as string[],
      notes: draft.notes,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("tasks").update(payload).eq("id", draft.id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    onChanged();
    onClose();
  };

  const del = async () => {
    const { error } = await supabase.from("tasks").delete().eq("id", draft.id);
    if (error) return toast.error(error.message);
    toast.success("Task deleted");
    setConfirmDelete(false);
    onChanged();
    onClose();
  };

  const otherTasks = allTasks.filter((t) => t.id !== draft.id && !t.parent_task_id);
  const blockingIds = otherTasks
    .filter((t) => Array.isArray(t.depends_on) && (t.depends_on as string[]).includes(draft.id))
    .map((t) => t.id);

  const setBlocking = async (ids: string[]) => {
    // Update other tasks' depends_on arrays
    const adds = ids.filter((i) => !blockingIds.includes(i));
    const removes = blockingIds.filter((i) => !ids.includes(i));
    for (const id of adds) {
      const t = otherTasks.find((x) => x.id === id);
      const cur = Array.isArray(t?.depends_on) ? (t!.depends_on as string[]) : [];
      await supabase.from("tasks").update({ depends_on: [...cur, draft.id] }).eq("id", id);
    }
    for (const id of removes) {
      const t = otherTasks.find((x) => x.id === id);
      const cur = Array.isArray(t?.depends_on) ? (t!.depends_on as string[]) : [];
      await supabase.from("tasks").update({ depends_on: cur.filter((d) => d !== draft.id) }).eq("id", id);
    }
    onChanged();
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <SheetContent className="w-full sm:max-w-[520px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-display text-xl">Edit Task</SheetTitle>
          </SheetHeader>

          <div className="space-y-5 mt-6">
            <Field label="Description">
              <Textarea value={draft.title} onChange={(e) => patch({ title: e.target.value })} rows={2} />
            </Field>

            <Field label="Work Type">
              <WorkTypePicker
                value={asWorkTypes(draft)}
                options={WORK_TYPES as unknown as readonly string[]}
                onChange={(v) => patch({ work_types: v as unknown, work_type: v[0] ?? null })}
              />
            </Field>

            <Field label="Agency">
              <AgencyPicker
                value={draft.agency}
                vendors={vendors}
                teamMembers={teamMembers}
                onChange={(v) => patch({ agency: v })}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Status">
                <select
                  value={draft.status ?? "not_started"}
                  onChange={(e) => patch({ status: e.target.value })}
                  className="w-full h-9 px-3 rounded-[8px] bg-white border border-border text-sm"
                >
                  {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                </select>
              </Field>
              <Field label="Priority">
                <select
                  value={draft.priority ?? "Medium"}
                  onChange={(e) => patch({ priority: e.target.value })}
                  className="w-full h-9 px-3 rounded-[8px] bg-white border border-border text-sm"
                >
                  {Object.keys(PRIORITY_META).map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Area">
              <AreaPicker
                value={Array.isArray(draft.areas) ? (draft.areas as string[]) : (draft.area ? [draft.area] : [])}
                rooms={rooms}
                onChange={(v) => patch({ areas: v })}
                onAddRoom={onAddRoom}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Planned Start"><DateField value={draft.planned_start} onChange={(v) => patch({ planned_start: v })} /></Field>
              <Field label="Planned End"><DateField value={draft.planned_end} onChange={(v) => patch({ planned_end: v })} /></Field>
              <Field label="Actual Start"><DateField value={draft.actual_start} onChange={(v) => patch({ actual_start: v })} /></Field>
              <Field label="Actual End"><DateField value={draft.actual_end} onChange={(v) => patch({ actual_end: v })} /></Field>
              <Field label="IFR Date"><DateField value={draft.ifr_date} onChange={(v) => patch({ ifr_date: v })} /></Field>
              <Field label="IFA Date"><DateField value={draft.ifa_date ?? null} onChange={(v) => patch({ ifa_date: v })} /></Field>
              <Field label="IFC Date"><DateField value={draft.ifc_date ?? null} onChange={(v) => patch({ ifc_date: v })} /></Field>
            </div>

            <Field label="Blocked By">
              <DependencyPicker
                allTasks={otherTasks}
                selected={Array.isArray(draft.depends_on) ? (draft.depends_on as string[]) : []}
                onChange={(ids) => patch({ depends_on: ids })}
              />
            </Field>

            <Field label="Blocking">
              <DependencyPicker
                allTasks={otherTasks}
                selected={blockingIds}
                onChange={setBlocking}
              />
            </Field>

            <Field label="Notes">
              <Textarea value={draft.notes ?? ""} onChange={(e) => patch({ notes: e.target.value })} rows={4} />
            </Field>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <Button
                variant="ghost"
                onClick={() => setConfirmDelete(true)}
                className="text-[#8a2a1f] hover:text-[#8a2a1f] hover:bg-[#c4685a18]"
              >
                <Trash2 className="h-4 w-4 mr-2" /> Delete Task
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                <Button onClick={save} className="bg-[#c17f5a] hover:bg-[#a86b4a]">Save</Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove "{draft.title}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={del} className="bg-[#c4685a] hover:bg-[#a04a3f]">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium">{label}</Label>
      {children}
    </div>
  );
}
