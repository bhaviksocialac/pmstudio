// Phase 1 helpers for the Proactive AI Morning Briefing.
// Pure functions — no I/O. Compute Do Today / Watch This Week / Order Now
// and the Fasttrack Score from already-fetched rows.

import type { DbProject, DbTask } from "@/lib/db-types";

export type BriefingAction = {
  kind: "open_task" | "open_project" | "open_vendor" | "open_invoice" | "open_snag" | "open_message";
  label: string;
  projectId?: string;
  taskId?: string;
  vendorId?: string;
  snagId?: string;
  invoiceId?: string;
};

export type BriefingItem = {
  id: string;
  title: string;
  detail?: string;
  severity: "info" | "warn" | "urgent";
  action: BriefingAction;
};

const today = () => new Date().toISOString().slice(0, 10);
const daysBetween = (a: string, b = today()) =>
  Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);

const projectName = (projects: DbProject[], id?: string | null) =>
  (id && projects.find((p) => p.id === id)?.name) || "Project";

// ─── Do Today ──────────────────────────────────────────────────────────────
export function computeDoToday(input: {
  projects: DbProject[];
  tasks: DbTask[];
  snags: Array<{ id: string; project_id: string; description: string; contractor_name: string | null; target_fix_date: string | null; status: string }>;
  invoices: Array<{ id: string; project_id: string | null; client_id: string | null; due_at: string | null; status: string; amount: number; milestone: string | null }>;
}): BriefingItem[] {
  const out: BriefingItem[] = [];
  const t = today();

  // 1) Approvals pending >3d (IFA stale)
  for (const tk of input.tasks) {
    if (tk.done) continue;
    if (tk.status !== "approval_pending") continue;
    const since = tk.ifa_date ?? tk.updated_at?.slice(0, 10);
    if (!since) continue;
    const d = daysBetween(since);
    if (d >= 3) {
      out.push({
        id: `appr-${tk.id}`,
        title: `Send follow-up — ${tk.title}`,
        detail: `${projectName(input.projects, tk.project_id)} · approval pending ${d}d`,
        severity: d >= 7 ? "urgent" : d >= 5 ? "urgent" : "warn",
        action: { kind: "open_task", label: "Send Follow-Up", projectId: tk.project_id ?? undefined, taskId: tk.id },
      });
    }
  }

  // 2) Invoices due today / overdue
  for (const inv of input.invoices) {
    if (!inv.due_at) continue;
    if (inv.status === "paid") continue;
    if (inv.due_at <= t) {
      out.push({
        id: `inv-${inv.id}`,
        title: `Invoice ${inv.due_at < t ? "overdue" : "due today"} — ${projectName(input.projects, inv.project_id)}`,
        detail: inv.milestone ? `${inv.milestone} · ₹${Math.round(inv.amount).toLocaleString("en-IN")}` : `₹${Math.round(inv.amount).toLocaleString("en-IN")}`,
        severity: inv.due_at < t ? "urgent" : "warn",
        action: { kind: "open_invoice", label: "Send Reminder", projectId: inv.project_id ?? undefined, invoiceId: inv.id },
      });
    }
  }

  // 3) Overdue snags
  for (const s of input.snags) {
    if (!s.target_fix_date) continue;
    if (s.target_fix_date >= t) continue;
    const d = daysBetween(s.target_fix_date);
    out.push({
      id: `snag-${s.id}`,
      title: `Follow up — ${s.contractor_name ?? "Snag"} (${d}d overdue)`,
      detail: `${projectName(input.projects, s.project_id)} · ${s.description.slice(0, 60)}`,
      severity: d >= 3 ? "urgent" : "warn",
      action: { kind: "open_snag", label: s.contractor_name ? `Call ${s.contractor_name.split(" ")[0]}` : "Open", projectId: s.project_id, snagId: s.id },
    });
  }

  // 4) IFC not issued after approval >2d (status moved past approval but no IFC date)
  for (const tk of input.tasks) {
    if (tk.done) continue;
    if (!tk.ifa_date || tk.ifc_date) continue;
    const stages = ["approval_pending", "quotation_pending", "order_placed", "material_ordered"];
    if (!stages.includes(tk.status ?? "")) continue;
    const d = daysBetween(tk.ifa_date);
    if (d >= 2) {
      out.push({
        id: `ifc-${tk.id}`,
        title: `Issue drawing — ${tk.title}`,
        detail: `${projectName(input.projects, tk.project_id)} · approved ${d}d ago, IFC pending`,
        severity: d >= 5 ? "urgent" : "warn",
        action: { kind: "open_task", label: "Issue IFC", projectId: tk.project_id ?? undefined, taskId: tk.id },
      });
    }
  }

  // Cap at 5, urgents first
  return out
    .sort((a, b) => sevRank(b.severity) - sevRank(a.severity))
    .slice(0, 5);
}

// ─── Watch This Week ───────────────────────────────────────────────────────
export function computeWatchThisWeek(input: {
  projects: DbProject[];
  tasks: DbTask[];
  snags: Array<{ project_id: string; status: string }>;
}): BriefingItem[] {
  const out: BriefingItem[] = [];
  const t = today();
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  // Handover ≤7d with open snags
  for (const p of input.projects) {
    if (!p.expected_handover) continue;
    if (p.expected_handover < t || p.expected_handover > in7) continue;
    const openSnags = input.snags.filter((s) => s.project_id === p.id && ["open", "in_progress", "reopened"].includes(s.status)).length;
    if (openSnags > 0) {
      out.push({
        id: `handover-${p.id}`,
        title: `${p.name} handover in ${daysBetween(t, p.expected_handover)}d — ${openSnags} snag${openSnags === 1 ? "" : "s"} open`,
        detail: "Close snags before handover",
        severity: "urgent",
        action: { kind: "open_project", label: "Open snags", projectId: p.id },
      });
    }
  }

  // Tasks starting in ≤7d that depend on a not-yet-done task → idle risk
  const taskById = new Map(input.tasks.map((tk) => [tk.id, tk]));
  for (const tk of input.tasks) {
    if (tk.done) continue;
    const start = tk.start_date ?? tk.planned_start;
    if (!start || start < t || start > in7) continue;
    const deps = Array.isArray(tk.depends_on) ? (tk.depends_on as string[]) : [];
    const blocking = deps
      .map((id) => taskById.get(id))
      .filter((d) => d && !d.done) as DbTask[];
    if (blocking.length > 0) {
      out.push({
        id: `risk-${tk.id}`,
        title: `${projectName(input.projects, tk.project_id)} — ${tk.title} starts in ${daysBetween(t, start)}d`,
        detail: `Blocked by: ${blocking.map((b) => b.title).slice(0, 2).join(", ")}`,
        severity: "warn",
        action: { kind: "open_task", label: "Resolve blocker", projectId: tk.project_id ?? undefined, taskId: blocking[0].id },
      });
    }
  }

  return out.sort((a, b) => sevRank(b.severity) - sevRank(a.severity)).slice(0, 3);
}

// ─── Order Now ─────────────────────────────────────────────────────────────
// Tasks of procurement nature starting soon without an order placed.
const ORDER_LEAD_DAYS = 10; // default vendor lead time buffer

export function computeOrderNow(input: {
  projects: DbProject[];
  tasks: DbTask[];
}): BriefingItem[] {
  const out: BriefingItem[] = [];
  const t = today();
  const procurementStatuses = new Set(["not_started", "selection_pending", "approval_pending", "quotation_pending"]);

  for (const tk of input.tasks) {
    if (tk.done) continue;
    const start = tk.start_date ?? tk.planned_start;
    if (!start) continue;
    const daysUntilStart = daysBetween(t, start);
    if (daysUntilStart < 0 || daysUntilStart > ORDER_LEAD_DAYS + 5) continue;
    // Needs ordering if still in early procurement statuses
    if (!procurementStatuses.has(tk.status ?? "")) continue;
    const overdueDays = Math.max(0, ORDER_LEAD_DAYS - daysUntilStart);
    const detail =
      overdueDays > 0
        ? `Reaches site in ${daysUntilStart}d · already ${overdueDays}d late to order`
        : `Reaches site in ${daysUntilStart}d · order before ${ORDER_LEAD_DAYS - daysUntilStart}d buffer ends`;
    out.push({
      id: `order-${tk.id}`,
      title: `Order ${tk.work_type ? `${tk.work_type.toLowerCase()} — ` : ""}${tk.title}`,
      detail: `${projectName(input.projects, tk.project_id)} · ${detail}`,
      severity: overdueDays > 0 ? "urgent" : "warn",
      action: { kind: "open_task", label: "Create PO", projectId: tk.project_id ?? undefined, taskId: tk.id },
    });
  }

  return out.sort((a, b) => sevRank(b.severity) - sevRank(a.severity)).slice(0, 3);
}

// ─── Fasttrack Score ───────────────────────────────────────────────────────
export type FasttrackScore = {
  score: number;
  band: "green" | "amber" | "red";
  trend: "up" | "down" | "flat";
  deltas: { approvals: number; deliveries: number; idle: number; payments: number };
};

export function computeFasttrack(input: {
  tasks: DbTask[];
  invoices: Array<{ due_at: string | null; status: string }>;
}): FasttrackScore {
  let score = 100;
  const t = today();
  const tasks = input.tasks;

  // Approval responsiveness: stale approvals reduce score
  const staleApprovals = tasks.filter((tk) => !tk.done && tk.status === "approval_pending" && tk.ifa_date && daysBetween(tk.ifa_date) >= 3).length;
  score -= Math.min(20, staleApprovals * 4);

  // Deliveries late / order-now urgent
  const orderUrgent = tasks.filter((tk) => {
    const s = tk.start_date ?? tk.planned_start;
    if (!s) return false;
    const d = daysBetween(t, s);
    return d >= 0 && d <= ORDER_LEAD_DAYS && ["not_started", "selection_pending", "approval_pending"].includes(tk.status ?? "");
  }).length;
  score -= Math.min(25, orderUrgent * 5);

  // Idle: overdue tasks not done
  const overdue = tasks.filter((tk) => !tk.done && tk.due_date && tk.due_date < t).length;
  score -= Math.min(25, overdue * 3);

  // Payment delays
  const overdueInv = input.invoices.filter((i) => i.status !== "paid" && i.due_at && i.due_at < t).length;
  score -= Math.min(15, overdueInv * 5);

  score = Math.max(0, Math.min(100, Math.round(score)));
  const band: FasttrackScore["band"] = score >= 80 ? "green" : score >= 60 ? "amber" : "red";

  return {
    score,
    band,
    trend: "flat",
    deltas: { approvals: staleApprovals, deliveries: orderUrgent, idle: overdue, payments: overdueInv },
  };
}

function sevRank(s: BriefingItem["severity"]) {
  return s === "urgent" ? 2 : s === "warn" ? 1 : 0;
}
