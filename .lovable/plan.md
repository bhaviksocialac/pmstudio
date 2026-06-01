# BOQ ↔ Tasks ↔ Vendors ↔ Budget Intelligence

This is a large feature. Below is the scoped plan so you can confirm before I build it.

## What exists already
- `parseBoqChecklist` AI server fn that reads BOQ PDF/Excel and creates tasks with `work_type`, `area`, status — but stores BOQ amount only inside a description string.
- `extractVendorQuotation` AI server fn that returns categorised quotation lines.
- `project_vendors` + `project_vendor_line_items` tables with quoted amounts.
- `vendor_invoices` + `vendor_invoice_payments` (with paid trigger).
- `budget_lines` table for per-category budget rollup.
- `tasks.vendor_id`, `tasks.agency`, `tasks.work_type`, `tasks.phase`.

## What's missing (this plan adds)

### 1. Schema (single migration)
- `tasks` → add `boq_amount numeric`, `quoted_amount numeric`, `invoiced_amount numeric`, `source text` (`boq` | `vendor` | `manual`), `auto_assigned boolean`, `manual_overrides jsonb` (track which fields the user changed).
- `projects` → add `boq_total numeric`, `quoted_total numeric` (denormalised rollups, kept in sync by trigger).
- New table `project_alerts` (project_id, kind, severity, payload jsonb, dismissed_at) for the dashboard alerts.
- Trigger: when `tasks.boq_amount` / `quoted_amount` / `invoiced_amount` changes, recompute `projects.boq_total`, `projects.quoted_total`, `projects.spent`, and per-category rows in `budget_lines`.

### 2. BOQ upload — upgrade `parseBoqChecklist`
- Persist `boq_amount` directly on each task (not just in description).
- Set `source='boq'`, infer `phase` from work_type (Civil/Electrical/Plumbing → Execution; Flooring/Tiles supply → Procurement; Paint/False ceiling → Finishing).
- Return preview payload `{tasks, totalsByWorkType, total}` so UI can show review screen.

### 3. BOQ preview/confirm UI
- New `BoqReviewSheet` opened after upload: groups proposed tasks by work_type, editable rows (title, work_type, amount, area), totals per group, "Confirm & Save" → calls a new server fn `saveBoqTasks` that does the insert in one transaction.
- Replaces the current silent insert in `BoqUploadButton`.

### 4. Vendor auto-assignment server fn (`assignVendorFromQuotation`)
Called right after a quotation is extracted and `project_vendor_line_items` saved.
For each quotation line:
- Fuzzy-match against existing project tasks (same `work_type` ∩ trigram similarity on title/description ≥ 0.35).
- If matched → set `tasks.vendor_id`, `tasks.agency = vendor.name`, `tasks.quoted_amount = line.amount`, `tasks.auto_assigned=true`. Compute variance vs `boq_amount`; push to `assignmentSummary`.
- If unmatched → create new task `source='vendor'`, vendor pre-assigned, `boq_amount=null`, `quoted_amount=line.amount`, `work_type` from category, phase inferred.
- For tasks in vendor's `scope_categories` that still have no vendor → also assign this vendor (bulk-assign by category).
- Return `{matched, created, conflicts, totalVariance, newScopeAmount}`.

### 5. Vendor assignment review UI
- `VendorAssignmentReviewDialog` shown after quotation extract. Lists matched tasks (with BOQ→Quote variance pill, amber ≥15%, red ≥30%), new tasks created, and any conflicts (multiple vendors covering same scope → per-task vendor dropdown). Designer confirms.

### 6. Budget reconciliation panel
- `BudgetReconciliationPanel` on the project Overview tab. Three layers: BOQ Estimate / Approved Quotes / Actual Invoiced. Toggle ex-GST ↔ incl-GST. Per work_type breakdown table (BOQ, Quoted, Variance, Invoiced, Remaining). Driven by SQL view `v_project_budget_rollup`.

### 7. Smart alerts
- New `evaluateProjectAlerts` server fn (also invoked from the BOQ/vendor flows) inserts into `project_alerts`:
  - Quote variance ≥15% per scope.
  - Quoted total > project.budget (client-approved).
  - Invoice > quoted line amount.
  - Work type has tasks but no vendor after 7 days.
  - Tasks without `boq_amount` after BOQ upload.
- `ProjectAlertsStrip` component on Project Overview + Dashboard Morning Briefing.

### 8. Manual override protection
- Any field changed in `TaskTable`/`TaskEditSheet` writes its key into `tasks.manual_overrides` (e.g. `{vendor_id: true, work_type: true}`).
- Auto-assign skips fields present in `manual_overrides`. Pencil icon shown next to overridden fields.

## Out of scope (not in this turn)
- New OCR / re-training of categorisation keywords beyond what the AI prompt already does (keyword list will be added as a fallback when AI returns "Other").
- Client portal budget update UI (data updates automatically; the existing portal will read new totals).
- Detailed GST input-credit ledger (we'll surface ex/incl toggle and per-invoice GST that already exists; full ITC report is a separate ask).

## Technical notes (for me, not user-facing)
- All server fns use `requireSupabaseAuth`.
- Fuzzy matching uses `pg_trgm` (`similarity()`), enable extension in migration.
- Triggers run as `SECURITY DEFINER` with `search_path = public`.
- `quoted_total` / `boq_total` updated via per-row trigger on `tasks` rather than recomputed in app code.
- No edits to `client.ts` / `types.ts` (auto-generated).

## Build order
1. Migration (schema + trigger + view + pg_trgm).
2. Upgrade `parseBoqChecklist` → return preview, persist `boq_amount`.
3. `BoqReviewSheet` + `saveBoqTasks`.
4. `assignVendorFromQuotation` + review dialog, hook into existing vendor add flow.
5. `BudgetReconciliationPanel` on Overview.
6. `evaluateProjectAlerts` + `ProjectAlertsStrip`.
7. Manual-override tracking in task editors.

Reply **yes** to build this, or tell me which parts to drop / add.