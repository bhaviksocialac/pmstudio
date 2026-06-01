import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Auto-assigns a project_vendor to matching tasks in the same project.
 *
 * Matching rules:
 *  - Task work_type ∈ vendor.scope_categories (case-insensitive)
 *  - Task vendor_id IS NULL  (don't steal already-assigned tasks)
 *  - Task manual_overrides does NOT include "vendor_id"
 *  - Task not done / not deleted
 *
 * Each matched task is updated with vendor_id, agency = vendor display name,
 * source remains as-is, auto_assigned-style flag stored via manual_overrides
 * (we record { auto_assigned: true } so the UI can show a "linked by AI" hint).
 *
 * quoted_amount is split across matched tasks proportionally to boq_amount;
 * tasks without boq_amount get an equal share of the remainder.
 */

const inputSchema = z.object({
  projectId: z.string().uuid(),
  projectVendorId: z.string().uuid(),
});

type AssignResult = {
  matchedTaskIds: string[];
  matchedCount: number;
  totalQuoted: number;
  scopeCategories: string[];
  vendorName: string;
  byCategory: Record<string, number>;
};


export const assignVendorToProjectTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data, context }): Promise<AssignResult> => {
    const { supabase } = context;
    const { projectId, projectVendorId } = data;

    // 1. Read the project_vendor link
    const { data: pv, error: pvErr } = await supabase
      .from("project_vendors")
      .select("id, vendor_id, scope_categories, po_amount, scope")
      .eq("id", projectVendorId)
      .single();
    if (pvErr || !pv) throw new Error("Project vendor not found");

    const { data: vendor, error: vErr } = await supabase
      .from("vendors")
      .select("id, name, company_name")
      .eq("id", pv.vendor_id)
      .single();
    if (vErr || !vendor) throw new Error("Vendor not found");

    const vendorName = vendor.company_name?.trim() || vendor.name?.trim() || "Vendor";
    const cats = (pv.scope_categories ?? []).map((c) => c.toLowerCase().trim()).filter(Boolean);
    if (cats.length === 0) {
      return { matchedTaskIds: [], matchedCount: 0, totalQuoted: 0, scopeCategories: [], vendorName };
    }

    // 2. Find candidate tasks
    const { data: tasksRaw, error: tErr } = await supabase
      .from("tasks")
      .select("id, work_type, boq_amount, vendor_id, manual_overrides, done, deleted_at, status")
      .eq("project_id", projectId);
    if (tErr) throw new Error(tErr.message);

    const candidates = (tasksRaw ?? []).filter((t) => {
      if (t.deleted_at) return false;
      if (t.done) return false;
      if (t.status === "done") return false;
      if (t.vendor_id) return false;
      const overrides = (t.manual_overrides ?? {}) as Record<string, boolean>;
      if (overrides.vendor_id) return false;
      const wt = (t.work_type ?? "").toLowerCase().trim();
      return cats.includes(wt);
    });

    if (candidates.length === 0) {
      return { matchedTaskIds: [], matchedCount: 0, totalQuoted: 0, scopeCategories: cats, vendorName };
    }

    // 3. Split po_amount across matched tasks (boq_amount weighted)
    const poAmount = Number(pv.po_amount ?? 0);
    const totalBoq = candidates.reduce((s, t) => s + Number(t.boq_amount ?? 0), 0);
    const equalShare = poAmount > 0 ? Math.round(poAmount / candidates.length) : 0;

    const updates = candidates.map((t) => {
      let quoted = 0;
      if (poAmount > 0) {
        if (totalBoq > 0 && t.boq_amount) {
          quoted = Math.round((Number(t.boq_amount) / totalBoq) * poAmount);
        } else {
          quoted = equalShare;
        }
      }
      const overrides = (t.manual_overrides ?? {}) as Record<string, boolean>;
      return {
        id: t.id,
        vendor_id: pv.vendor_id,
        agency: vendorName,
        quoted_amount: quoted,
        manual_overrides: { ...overrides, auto_assigned: true },
      };
    });

    // 4. Bulk-update by id (one round-trip per task — simpler & safe under RLS)
    let totalQuoted = 0;
    for (const u of updates) {
      const { error } = await supabase
        .from("tasks")
        .update({
          vendor_id: u.vendor_id,
          agency: u.agency,
          quoted_amount: u.quoted_amount,
          manual_overrides: u.manual_overrides,
        })
        .eq("id", u.id);
      if (!error) totalQuoted += u.quoted_amount;
    }

    return {
      matchedTaskIds: updates.map((u) => u.id),
      matchedCount: updates.length,
      totalQuoted,
      scopeCategories: cats,
      vendorName,
    };
  });

/**
 * Lightweight read for the Budget Reconciliation panel — returns the 3 rollups
 * per work_type so the UI can render BOQ vs Quoted vs Invoiced.
 */
const rollupInput = z.object({ projectId: z.string().uuid() });

export type BudgetRollupRow = {
  work_type: string;
  boq: number;
  quoted: number;
  invoiced: number;
  taskCount: number;
};

export const getProjectBudgetRollup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => rollupInput.parse(input))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ rows: BudgetRollupRow[]; totals: { boq: number; quoted: number; invoiced: number } }> => {
      const { supabase } = context;
      const { data: rows, error } = await supabase
        .from("tasks")
        .select("work_type, boq_amount, quoted_amount, invoiced_amount")
        .eq("project_id", data.projectId)
        .is("deleted_at", null);
      if (error) throw new Error(error.message);

      const grouped = new Map<string, BudgetRollupRow>();
      let tBoq = 0,
        tQuoted = 0,
        tInvoiced = 0;
      for (const r of rows ?? []) {
        const wt = r.work_type || "Other";
        const cur = grouped.get(wt) ?? { work_type: wt, boq: 0, quoted: 0, invoiced: 0, taskCount: 0 };
        const b = Number(r.boq_amount ?? 0);
        const q = Number(r.quoted_amount ?? 0);
        const i = Number(r.invoiced_amount ?? 0);
        cur.boq += b;
        cur.quoted += q;
        cur.invoiced += i;
        cur.taskCount += 1;
        grouped.set(wt, cur);
        tBoq += b;
        tQuoted += q;
        tInvoiced += i;
      }
      return {
        rows: [...grouped.values()].sort((a, b) => b.boq - a.boq),
        totals: { boq: tBoq, quoted: tQuoted, invoiced: tInvoiced },
      };
    },
  );
