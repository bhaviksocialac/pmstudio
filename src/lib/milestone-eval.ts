// Pure helpers shared by client (UI progress display) and server (trigger evaluation).
import { isDone, roomsOf, workTypesOf, phaseOfTask, type TaskLite } from "@/lib/phase-sync";

export type MilestoneKind = "room" | "phase" | "work_type" | "custom";
export type MilestoneStatus = "pending" | "triggered" | "invoice_sent" | "paid";

export type MilestoneTrigger = {
  room?: string;
  phase?: string;
  work_type?: string;
  task_ids?: string[];
};

export type MilestoneLite = {
  id: string;
  name: string;
  kind: MilestoneKind;
  trigger: MilestoneTrigger;
  invoice_amount: number;
  status: MilestoneStatus;
  triggered_at: string | null;
};

export function tasksForMilestone(m: { kind: MilestoneKind; trigger: MilestoneTrigger }, all: TaskLite[]): TaskLite[] {
  const trg = m.trigger ?? {};
  switch (m.kind) {
    case "room": {
      const room = (trg.room ?? "").toLowerCase().trim();
      if (!room) return [];
      return all.filter((t) => roomsOf(t).some((r) => r.toLowerCase().trim() === room));
    }
    case "phase": {
      const ph = (trg.phase ?? "").trim();
      if (!ph) return [];
      return all.filter((t) => phaseOfTask(t) === ph);
    }
    case "work_type": {
      const wt = (trg.work_type ?? "").toLowerCase().trim();
      if (!wt) return [];
      return all.filter((t) => workTypesOf(t).some((w) => w.toLowerCase().trim() === wt));
    }
    case "custom": {
      const ids = new Set(trg.task_ids ?? []);
      if (!ids.size) return [];
      return all.filter((t) => t.id && ids.has(t.id));
    }
  }
}

export function milestoneProgress(
  m: { kind: MilestoneKind; trigger: MilestoneTrigger },
  all: TaskLite[],
): { done: number; total: number; pct: number; complete: boolean; delayed: boolean; remaining: TaskLite[] } {
  const set = tasksForMilestone(m, all);
  const total = set.length;
  const doneList = set.filter(isDone);
  const done = doneList.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const today = new Date().toISOString().slice(0, 10);
  const delayed = set.some((t) => !isDone(t) && t.planned_end && t.planned_end < today);
  return {
    done,
    total,
    pct,
    complete: total > 0 && done === total,
    delayed,
    remaining: set.filter((t) => !isDone(t)),
  };
}

export function triggerLatestDoneDate(
  m: { kind: MilestoneKind; trigger: MilestoneTrigger },
  all: TaskLite[],
): string | null {
  const set = tasksForMilestone(m, all).filter(isDone);
  if (!set.length) return null;
  const dates = set
    .map((t) => t.actual_end ?? t.due_date ?? t.planned_end ?? null)
    .filter((d): d is string => !!d)
    .sort();
  return dates[dates.length - 1] ?? new Date().toISOString().slice(0, 10);
}
