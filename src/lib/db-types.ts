import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type DbProfile = Tables<"profiles">;
export type DbProject = Tables<"projects">;
export type DbClient = Tables<"clients">;
export type DbVendor = Tables<"vendors">;
export type DbTask = Tables<"tasks">;
export type DbPhase = Tables<"project_phases">;
export type DbBudgetLine = Tables<"budget_lines">;
export type DbRoom = Tables<"project_rooms">;
export type DbRoomItem = Tables<"room_scope_items">;

export type ProjectInsert = TablesInsert<"projects">;
export type ClientInsert = TablesInsert<"clients">;
export type VendorInsert = TablesInsert<"vendors">;

export const PHASES = ["Survey", "Design", "Procurement", "Execution", "Finishing", "Handover"] as const;
export type Phase = typeof PHASES[number];

// Weeks per phase
export const PHASE_WEEKS: Record<Phase, number> = {
  Survey: 1,
  Design: 3,
  Procurement: 2,
  Execution: 8,
  Finishing: 2,
  Handover: 1,
};

export const DEFAULT_BUDGET_BREAKDOWN: { category: string; percentage: number }[] = [
  { category: "Civil", percentage: 25 },
  { category: "Electrical", percentage: 10 },
  { category: "Flooring", percentage: 20 },
  { category: "Furniture", percentage: 30 },
  { category: "Painting", percentage: 8 },
  { category: "Miscellaneous", percentage: 7 },
];

export const DEFAULT_ROOMS = [
  "Living Room",
  "Master Bedroom",
  "Bedroom 2",
  "Kitchen",
  "Bathrooms",
  "Dining",
  "Balcony",
] as const;

export const DEFAULT_ROOM_ITEMS = [
  "Flooring",
  "Walls",
  "Ceiling",
  "Electrical",
  "Furniture",
  "Accessories",
] as const;

export const healthMap = {
  "on-track": { color: "#7a9e8a", label: "On track", pulse: "", line: "#7a9e8a" },
  attention: { color: "#d4882a", label: "Watch closely", pulse: "pulse-slow", line: "#d4882a" },
  urgent: { color: "#c4685a", label: "Urgent", pulse: "pulse-fast", line: "#c4685a" },
} as const;

export type HealthKey = keyof typeof healthMap;

// Compute phase start/end dates from a project start date
export function computePhaseSchedule(startDate: Date): { phase: Phase; start: Date; end: Date }[] {
  const result: { phase: Phase; start: Date; end: Date }[] = [];
  let cursor = new Date(startDate);
  for (const phase of PHASES) {
    const start = new Date(cursor);
    const end = new Date(cursor);
    end.setDate(end.getDate() + PHASE_WEEKS[phase] * 7);
    result.push({ phase, start, end });
    cursor = new Date(end);
  }
  return result;
}

// Derive a health score from project state + tasks
export function computeHealth(
  project: Pick<DbProject, "budget" | "spent" | "expected_handover">,
  tasks: Pick<DbTask, "done" | "due_date">[],
): HealthKey {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const overdue = tasks.filter((t) => !t.done && t.due_date && t.due_date < todayStr).length;
  const budget = Number(project.budget || 0);
  const spent = Number(project.spent || 0);
  const overspent = budget > 0 && spent > budget;
  const nearBudget = budget > 0 && spent / budget > 0.9;

  const handoverSoon =
    project.expected_handover &&
    (new Date(project.expected_handover).getTime() - now.getTime()) / 86400000 < 7 &&
    (new Date(project.expected_handover).getTime() - now.getTime()) / 86400000 >= 0;

  if (overdue >= 3 || overspent) return "urgent";
  if (overdue >= 1 || nearBudget || handoverSoon) return "attention";
  return "on-track";
}

export function hoursUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return (new Date(dateStr).getTime() - Date.now()) / 3600000;
}
