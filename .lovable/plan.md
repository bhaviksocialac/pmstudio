# Vendor System Rebuild

A 3-phase rebuild covering master vendors, project-scoped vendor scope, and per-project vendor detail. Phases ship sequentially so each is verifiable.

## Phase 1 — Schema additions (one migration)

Extend existing tables (no destructive changes — current data preserved):

**vendors** (master list):
- `vendor_type TEXT NOT NULL DEFAULT 'company'` ('individual' | 'company')
- `whatsapp TEXT`, `designation TEXT`, `bank_name TEXT`
- `work_categories TEXT[] DEFAULT '{}'`
- `payment_terms TEXT`
- (already has: name, company_name, phone, email, gst, pan, bank_account, ifsc, address fields, notes)

**vendor_custom_categories** (new): per-user custom work category strings
- `id`, `user_id`, `name`, `created_at`. RLS by user_id. GRANTs to authenticated + service_role.

**project_vendors** (extend — already exists):
- `scope_categories TEXT[] DEFAULT '{}'` (subset of vendor's work_categories for this project)
- `contract_type TEXT DEFAULT 'lump_sum'` ('lump_sum' | 'rate_based' | 'mixed')
- `quotation_storage_path TEXT`, `quotation_url TEXT`

**project_vendor_line_items** (new):
- `id`, `user_id`, `project_vendor_id`, `category TEXT`, `description TEXT`, `scope_tag TEXT` ('supply_fix' | 'supply_only' | 'labour_only' | 'provisional' | 'excluded'), `rate_type TEXT` ('lump_sum' | 'rate_based'), `quantity NUMERIC`, `unit TEXT`, `rate NUMERIC`, `amount NUMERIC`, `invoiced_amount NUMERIC DEFAULT 0`, `status TEXT DEFAULT 'pending'`, `order_index INT`, `deleted_at`, timestamps. RLS by user_id. GRANTs.

**project_vendor_milestones** (new):
- `id`, `user_id`, `project_vendor_id`, `name TEXT`, `trigger TEXT` ('on_signing' | 'on_start' | 'on_completion' | 'on_delivery' | 'custom'), `trigger_note TEXT`, `percentage NUMERIC`, `amount NUMERIC`, `status TEXT DEFAULT 'pending'` ('pending' | 'invoiced' | 'paid'), `paid_at TIMESTAMPTZ`, `order_index INT`, `deleted_at`, timestamps. RLS by user_id. GRANTs.

## Phase 2 — Master vendor list (`/vendors` page)

- Rewrite `src/routes/_authenticated/vendors.tsx` Add/Edit sheet:
  - Top toggle: Individual / Company → swaps field set
  - Multi-select `work_categories` chips (defaults + saved custom + "+ Add custom" inline)
  - Bank Name field added; WhatsApp "same as phone" checkbox
  - Payment Terms free text
- Vendor card: type tag, work-category pills, WhatsApp icon next to phone, last-used project + total projects (computed from `project_vendors`)
- 3-dot menu: Edit, Move to Trash (uses existing soft-delete `deleted_at`)
- Performance block on detail: totals from `project_vendors` + `vendor_invoices` + `snags`

## Phase 3 — Add Vendor to Project (2-step flow)

Replace current "Add Vendor" in `src/components/vendors/ProjectVendorsTab.tsx`:

**Step 1** — `VendorAutocomplete` already exists; reuse. "Create new" opens master vendor form inline, then proceeds to Step 2.

**Step 2** — New `ProjectVendorScopeSheet`:
- Header: vendor name + type badge
- Scope categories: checkboxes seeded from vendor's `work_categories`
- Contract Type dropdown
- Upload Quotation → calls new `extractVendorQuotation` server fn (new file `src/lib/vendor-quotation.functions.ts`, reuses Gemini 2.5 Pro with structured tool-call output returning `{ categories: [{ name, lines: [{ description, scope_tag, rate_type, qty, unit, rate, amount }] }] }`)
- Editable line-item table grouped by category; per-row scope tag dropdown; "Add line item" button; auto-total
- Payment Milestones repeater with %-or-fixed amount; validates sum = contract total
- Save → inserts `project_vendors`, `project_vendor_line_items`, `project_vendor_milestones` in one transaction

## Phase 4 — Project vendor detail

Update `ProjectVendorsTab` row:
- Scope category pills, contract value, progress bar (sum of completed line amounts / total), invoiced vs contract, balance
- Expand → category-grouped line items with status + per-item invoiced amount
- Existing Upload Invoice button → after AI extraction, fuzzy-match extracted lines to `project_vendor_line_items` by description (cosine on tokens); user confirms mapping; updates `invoiced_amount`
- Milestone tracker strip (pending → invoiced → paid)
- Individual vs Company invoice handling: if vendor.vendor_type='individual', the invoice form/preview labels "Payment Voucher" and hides GST inputs; Finance categorises as expense (no ITC). Company branch unchanged.

## Phase 5 — Cross-project view on vendor detail

On master vendor detail page, add "Projects" section listing every `project_vendors` row with project name, scope_categories pills, contract value, paid/balance, click → project's vendor expanded view.

## Out of scope (will not touch in this batch)

- Reorganising Finance page beyond labelling individual-vendor payments as vouchers
- Rewriting existing `vendor_invoices` schema (already supports line_items + bank_details)
- Right-click context menus

## Rollout

1. Migration (Phase 1) — single approval gate.
2. Build Phase 2 + 3 together (master list + add-to-project), verify.
3. Build Phase 4 + 5 (detail view + cross-project), verify.

~25–35 files touched total across the two build batches.