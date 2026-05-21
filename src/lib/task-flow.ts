// Smart Task Intelligence — status flow + work types (pure helpers)

export const STATUS_ORDER = [
  "not_started",
  "selection_pending",
  "approval_pending",
  "quotation_pending",
  "order_placed",
  "payment_pending",
  "material_ordered",
  "material_delivered",
  "wip",
  "done",
] as const;
export type TaskStatus = typeof STATUS_ORDER[number] | "blocked" | "todo" | "in_progress";

export const STATUS_META: Record<string, { label: string; bg: string; fg: string; dot: string }> = {
  not_started:         { label: "Not Started",         bg: "#e8e3da55", fg: "#8a7d6e", dot: "#c4b8a6" },
  todo:                { label: "Not Started",         bg: "#e8e3da55", fg: "#8a7d6e", dot: "#c4b8a6" },
  selection_pending:   { label: "Selection Pending",   bg: "#d4882a22", fg: "#a86b1f", dot: "#d4882a" },
  approval_pending:    { label: "Approval Pending",    bg: "#d4882a30", fg: "#8a5a1a", dot: "#c4685a" },
  quotation_pending:   { label: "Quotation Pending",   bg: "#c17f5a22", fg: "#8a5a3f", dot: "#c17f5a" },
  order_placed:        { label: "Order Placed",        bg: "#c17f5a30", fg: "#7a4f37", dot: "#a86b4a" },
  payment_pending:     { label: "Payment Pending",     bg: "#c4685a22", fg: "#8a4a3f", dot: "#c4685a" },
  material_ordered:    { label: "Material Ordered",    bg: "#7a9e8a22", fg: "#4f6b5e", dot: "#7a9e8a" },
  material_delivered:  { label: "Material at Site",    bg: "#7a9e8a30", fg: "#3f5a4d", dot: "#5e8a76" },
  wip:                 { label: "Work in Progress",    bg: "#c17f5a40", fg: "#6a3f27", dot: "#c17f5a" },
  in_progress:         { label: "Work in Progress",    bg: "#c17f5a40", fg: "#6a3f27", dot: "#c17f5a" },
  blocked:             { label: "Blocked",             bg: "#c4685a40", fg: "#6a2a1f", dot: "#c4685a" },
  done:                { label: "Done",                bg: "#7a9e8a40", fg: "#2f4a3d", dot: "#5e8a76" },
};

export const PRIORITY_META: Record<string, { label: string; bg: string; fg: string }> = {
  Urgent: { label: "Urgent", bg: "#c4685a30", fg: "#8a2a1f" },
  High:   { label: "High",   bg: "#c4685a22", fg: "#a04a3f" },
  Medium: { label: "Medium", bg: "#c17f5a22", fg: "#8a5a3f" },
  Low:    { label: "Low",    bg: "#7a9e8a22", fg: "#4f6b5e" },
};

export const WORK_TYPES = [
  "Flooring", "Tiling", "Civil", "Electrical", "Painting",
  "False Ceiling", "Carpentry", "Plumbing", "HVAC", "Other",
] as const;
export type WorkType = typeof WORK_TYPES[number];

export const DEFAULT_ROOMS = [
  "Living Room", "Master Bedroom", "Bedroom 2", "Kitchen",
  "Bathroom", "Dining", "Balcony", "All",
] as const;

export function nextStatus(current: string | null | undefined): TaskStatus | null {
  const i = STATUS_ORDER.indexOf((current ?? "not_started") as typeof STATUS_ORDER[number]);
  if (i < 0 || i === STATUS_ORDER.length - 1) return null;
  return STATUS_ORDER[i + 1];
}

export function isTerminal(s: string | null | undefined) {
  return s === "done";
}

export function isUrgent(t: { priority?: string | null; due_date?: string | null; status?: string | null; done?: boolean | null }) {
  if (t.priority === "Urgent") return true;
  if (t.due_date && !t.done && t.status !== "done") {
    return t.due_date < new Date().toISOString().slice(0, 10);
  }
  return false;
}

// Auto-flag action_required based on time-in-status heuristics
export function deriveActionRequired(t: {
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  action_required?: boolean | null;
}): { required: boolean; label: string | null } {
  if (t.action_required) return { required: true, label: null };
  const ageH = t.updated_at ? (Date.now() - new Date(t.updated_at).getTime()) / 3.6e6 : 0;
  if (t.status === "approval_pending" && ageH > 24) {
    return { required: true, label: "Client approval pending >24h" };
  }
  if (t.status === "quotation_pending" && ageH > 72) {
    return { required: true, label: "Quotation overdue" };
  }
  if (t.status === "payment_pending") {
    return { required: true, label: "Payment pending" };
  }
  return { required: false, label: null };
}

// Given a task that just became done/material_delivered, find dependents that can now advance.
export function dependentsUnblocked<T extends { id: string; depends_on?: unknown; status?: string | null }>(
  finishedId: string,
  allTasks: T[],
): T[] {
  return allTasks.filter((t) => {
    const dep = Array.isArray(t.depends_on) ? (t.depends_on as string[]) : [];
    if (!dep.includes(finishedId)) return false;
    return t.status === "not_started" || t.status === "todo" || t.status === "blocked";
  });
}

export function rowTint(t: {
  priority?: string | null;
  due_date?: string | null;
  status?: string | null;
  done?: boolean | null;
  action_required?: boolean | null;
}): string {
  if (isUrgent(t)) return "bg-[#c4685a0f]"; // red wash
  if (t.action_required) return "bg-[#d4882a0f]"; // amber wash
  if (t.status === "done" || t.done) return "bg-[#7a9e8a0d]"; // sage wash
  if (!t.status || t.status === "not_started" || t.status === "todo") return "bg-[#e8e3da30]"; // grey wash
  return "";
}
