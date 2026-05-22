// Phase sync: tasks → 6 lifecycle project phases (parallel, room-wise, fully task-driven).
// One source of truth used by Tasks, Phases, Timeline, Overview, Dashboard.

export const EXECUTION_PHASE_GROUPS = [
  "Survey",
  "Design",
  "Procurement",
  "Execution",
  "Finishing",
  "Handover",
] as const;
export type ExecutionPhaseGroup = typeof EXECUTION_PHASE_GROUPS[number];

// WORK_TYPE → lifecycle phase.
export const WORK_TYPE_GROUP: Record<string, ExecutionPhaseGroup> = {
  Survey: "Survey",
  Design: "Design",
  Procurement: "Procurement",
  Civil: "Execution",
  Electrical: "Execution",
  Plumbing: "Execution",
  HVAC: "Execution",
  Flooring: "Execution",
  Tiling: "Execution",
  Carpentry: "Execution",
  Painting: "Finishing",
  "False Ceiling": "Finishing",
  Snags: "Finishing",
  Finishing: "Finishing",
  Handover: "Handover",
  Other: "Execution",
};

const PROCUREMENT_STATUSES = new Set([
  "selection_pending", "approval_pending", "quotation_pending",
  "order_placed", "payment_pending", "material_ordered", "material_delivered",
]);

export function groupOfWorkType(wt: string | null | undefined): ExecutionPhaseGroup | null {
  if (!wt) return null;
  return WORK_TYPE_GROUP[wt] ?? null;
}

export function phaseOfTask(t: TaskLite): ExecutionPhaseGroup {
  const p = (t.phase ?? "").trim();
  if ((EXECUTION_PHASE_GROUPS as readonly string[]).includes(p)) return p as ExecutionPhaseGroup;
  for (const wt of workTypesOf(t)) {
    const g = WORK_TYPE_GROUP[wt];
    if (g) return g;
  }
  if (t.ifc_date || t.ifa_date || t.ifr_date) return "Design";
  if (PROCUREMENT_STATUSES.has(t.status ?? "")) return "Procurement";
  return "Execution";
}

export type TaskLite = {
  id?: string;
  status?: string | null;
  done?: boolean | null;
  work_type?: string | null;
  work_types?: unknown;
  areas?: unknown;
  area?: string | null;
  room?: string | null;
  completion_pct?: number | null;
  notes?: string | null;
  planned_end?: string | null;
  actual_end?: string | null;
  due_date?: string | null;
  phase?: string | null;
  ifr_date?: string | null;
  ifa_date?: string | null;
  ifc_date?: string | null;
};

export function isDone(t: TaskLite): boolean {
  return t.status === "done" || !!t.done;
}

export function taskPct(t: TaskLite): number {
  if (isDone(t)) return 100;
  const c = typeof t.completion_pct === "number" ? t.completion_pct : 0;
  if (c > 0) return Math.min(100, c);
  if (t.status === "wip" || t.status === "in_progress") return 50;
  return 0;
}

export function roomsOf(t: TaskLite): string[] {
  if (t.room) return [t.room];
  const a = Array.isArray(t.areas) ? (t.areas as unknown[]).map(String).filter(Boolean) : [];
  if (a.length) return a;
  if (t.area) return [t.area];
  return [];
}

export function workTypesOf(t: TaskLite): string[] {
  const wts = Array.isArray(t.work_types) ? (t.work_types as unknown[]).map(String).filter(Boolean) : [];
  if (wts.length) return wts;
  if (t.work_type) return [t.work_type];
  return [];
}

// ---------- Rollups ----------

export type RoomCell = {
  room: string;
  pct: number;
  status: "done" | "wip" | "pending";
  note?: string | null;
};

export type WorkTypeRollup = {
  workType: string;
  rooms: RoomCell[];
  pct: number;
  done: number;
  total: number;
};

export type GroupRollup = {
  group: ExecutionPhaseGroup;
  workTypes: WorkTypeRollup[];
  pct: number;
  done: number;
  total: number;
  blocker: string | null;       // human-readable blocker if not 100%
};

function aggregateRoom(tasks: TaskLite[]): RoomCell[] {
  // Group by room, average pct.
  const byRoom = new Map<string, TaskLite[]>();
  tasks.forEach((t) => {
    const rms = roomsOf(t);
    if (rms.length === 0) {
      const arr = byRoom.get("(unspecified)") ?? [];
      arr.push(t);
      byRoom.set("(unspecified)", arr);
      return;
    }
    rms.forEach((r) => {
      const arr = byRoom.get(r) ?? [];
      arr.push(t);
      byRoom.set(r, arr);
    });
  });
  return Array.from(byRoom.entries()).map(([room, ts]) => {
    const avg = Math.round(ts.reduce((s, t) => s + taskPct(t), 0) / ts.length);
    const status: RoomCell["status"] = avg >= 100 ? "done" : avg > 0 ? "wip" : "pending";
    const noteTask = ts.find((t) => t.notes && taskPct(t) < 100);
    return { room, pct: avg, status, note: noteTask?.notes ?? null };
  }).sort((a, b) => a.room.localeCompare(b.room));
}

export function computeRollup(tasks: TaskLite[]): GroupRollup[] {
  const byGroup = new Map<ExecutionPhaseGroup, Map<string, TaskLite[]>>();
  tasks.forEach((t) => {
    workTypesOf(t).forEach((wt) => {
      const grp = groupOfWorkType(wt);
      if (!grp) return;
      const wtMap = byGroup.get(grp) ?? new Map<string, TaskLite[]>();
      const arr = wtMap.get(wt) ?? [];
      arr.push(t);
      wtMap.set(wt, arr);
      byGroup.set(grp, wtMap);
    });
  });

  return EXECUTION_PHASE_GROUPS.map((group): GroupRollup => {
    const wtMap = byGroup.get(group);
    if (!wtMap) return { group, workTypes: [], pct: 0, done: 0, total: 0, blocker: null };
    const workTypes: WorkTypeRollup[] = Array.from(wtMap.entries()).map(([wt, ts]) => {
      const rooms = aggregateRoom(ts);
      const done = ts.filter(isDone).length;
      const total = ts.length;
      const pct = Math.round(ts.reduce((s, t) => s + taskPct(t), 0) / Math.max(1, total));
      return { workType: wt, rooms, pct, done, total };
    }).sort((a, b) => a.workType.localeCompare(b.workType));

    const allTasks = workTypes.flatMap((w) => wtMap.get(w.workType) ?? []);
    const total = allTasks.length;
    const done = allTasks.filter(isDone).length;
    const pct = total ? Math.round(allTasks.reduce((s, t) => s + taskPct(t), 0) / total) : 0;

    let blocker: string | null = null;
    if (pct < 100) {
      const pending = workTypes.find((w) => w.pct < 100);
      if (pending) {
        const pendingRoom = pending.rooms.find((r) => r.pct < 100);
        if (pendingRoom) {
          blocker = `${pending.workType} pending in ${pendingRoom.room}${pendingRoom.note ? ` — ${pendingRoom.note}` : ""}`;
        } else {
          blocker = `${pending.workType} pending`;
        }
      }
    }
    return { group, workTypes, pct, done, total, blocker };
  });
}

export function overallProjectPct(tasks: TaskLite[]): number {
  if (!tasks.length) return 0;
  const total = tasks.reduce((s, t) => s + taskPct(t), 0);
  return Math.round(total / tasks.length);
}

export function diffRollup(before: GroupRollup[], after: GroupRollup[]): string[] {
  const map = new Map(before.map((g) => [g.group, g.pct]));
  const msgs: string[] = [];
  after.forEach((g) => {
    const b = map.get(g.group) ?? 0;
    if (g.pct !== b && g.total > 0) {
      msgs.push(`${g.group} — now ${g.pct}% (was ${b}%)`);
    }
  });
  return msgs;
}
