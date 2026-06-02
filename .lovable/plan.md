
# Vendor Onboarding & Document Flow

Rebuild the "add vendor to project" flow as a single AI-driven action: pick vendor → upload quotation/BOQ → AI creates or updates tasks (work type, agency, budget) → confirm → done. Also add full vendor document management inside the project Vendors tab.

## 1. RLS & schema audit

Before any UI work, verify and fix policies on `project_vendors`, `phase_subcategories`, `tasks`, `project_documents`, `document_folders`. All must allow INSERT/UPDATE/SELECT/DELETE where `auth.uid() = user_id`. Add a `vendor_documents` table for vendor-scoped files with version history:

- `vendor_documents` — project_id, vendor_id, project_vendor_id, name, category (quotation|boq|invoice|delivery_challan|work_order|other), storage_path, file_url, mime_type, file_size, notes, current_version_id, linked_document_id (FK to project_documents), user_id, timestamps, deleted_at.
- `vendor_document_versions` — vendor_document_id, version_no, storage_path, file_url, file_size, mime_type, uploaded_at, user_id.

Both tables: GRANTs + RLS scoped to `auth.uid() = user_id`.

## 2. Add Vendor sheet (replace current form)

Replace the existing add-vendor dialog in `ProjectVendorsTab` with a single sheet:

1. Vendor autocomplete (existing `VendorAutocomplete`) — pick or create.
2. Scope of work (optional textarea).
3. File dropzone — PDF / XLSX / XLS / CSV / JPG / PNG, max 25MB, drag-drop + click. Progress bar, green check on success, inline error on failure (never silent).
4. "Add to Project" button.

On submit: upload file to `project-documents` bucket under `vendors/{projectVendorId}/{filename}`, insert `project_vendors` row, insert `vendor_documents` row (category defaults to Quotation/BOQ based on filename, editable), then trigger AI parse.

## 3. Server function: `parseVendorQuotation`

New `src/lib/vendor-quotation-ai.functions.ts`:
- Input: `projectId`, `projectVendorId`, `vendorId`, `vendorName`, `fileBase64`, `filename`, `mime`.
- Reuse logic from `boq-checklist.functions.ts` (already extracts line items via Lovable AI gateway). Extend prompt to return: description, quantity, unit, rate, amount, detected `work_type` from keyword map, detected `phase` (Civil/Electrical/Plumbing/Carpentry/Flooring/Painting → Execution; supply-only → Procurement).
- Returns preview items only — no DB writes yet.

## 4. Server function: `matchAndSaveVendorTasks`

Input: items array + projectVendorId + vendorId/name.

For each item:
- Fuzzy match existing `tasks` in project by work_type + title similarity (Postgres `similarity()` already available via pg_trgm, threshold ~0.45).
- If match: collect into `updates` (set `vendor_id`, `contractor`=vendor name, `boq_amount`=item.amount, store variance).
- Else: collect into `creates` (new task with work_type, phase, vendor_id, boq_amount, status='not_started').

Return `{ updates, creates }` for the confirmation screen. A second `confirmVendorTasks` fn actually writes the inserts/updates + recomputes budget (triggers handle the rollup).

## 5. Confirmation screen

`VendorQuotationReviewSheet` (new component, modeled on `BoqReviewSheet`):
- Header: "AI read {filename} — found N line items".
- Section "Tasks to Update": table with old/new agency, old/new budget, variance chip.
- Section "New Tasks to Create": editable rows (title, work type select, budget input).
- Footer summary: "X updated · Y created · {Vendor} assigned · Total ₹Z".
- Buttons: "Review & Edit" (toggle inline editing) and "Confirm & Save".

On confirm: call `confirmVendorTasks`, also copy file into `project_documents` under proper folder (Quotations/{vendor}, BOQ/{vendor}, Invoices/{vendor}), set `vendor_documents.linked_document_id`. Show toast and emit `pmstudio:goto-tab` → tasks.

## 6. Project total budget alert

In project Overview, if confirmed creates introduce new scopes not in original BOQ, surface a `project_alerts` row: "New scope added — budget increased by ₹X — consider informing client". Existing alerts strip will render it.

## 7. Vendor document management (Vendors tab)

Inside each vendor card in `ProjectVendorsTab`, add a Documents subsection:

- List `vendor_documents` rows with: file-type icon (PDF/XLS/IMG), name, category chip, upload date, size.
- Per-row 3-dot menu: View / Replace / Edit Details / Download / Move to Documents / Delete.
  - **Replace** uploads new file, archives current to `vendor_document_versions`, bumps version.
  - **Edit Details** opens small dialog (name, category, notes).
  - **Move to Documents** copies into `project_documents` under correct folder; if already linked, show "Linked" badge instead of duplicating.
  - **Delete** soft-deletes (`deleted_at`).
- **Version history**: expandable row showing V1 / V2 (current) with restore action.
- **Add File** button: file picker → asks category → uploads with progress → after upload, if category is Quotation/BOQ, prompt "Process this to create tasks?" (runs the same AI flow). If Invoice, prompt "Process to update payments?" (reuse existing `vendor-invoice-extract` flow).
- **Drag & drop** on the vendor card: same upload path, category auto-guessed from filename (`quote|quotation` → Quotation, `boq` → BOQ, `invoice|inv` → Invoice, else Other).

## 8. File upload hardening

- Single `uploadVendorFile` helper in `src/lib/vendor-upload.ts`: validates mime + 25MB cap, uploads with `supabase.storage.from('project-documents').upload`, returns public URL + path. Surfaces real Supabase error message via toast.
- Progress: use XHR-based upload wrapper to drive a Tailwind progress bar; fall back to indeterminate spinner if Storage SDK doesn't emit progress.

## 9. Technical Details

- **Files added**:
  - `src/lib/vendor-quotation-ai.functions.ts` (parse + match + confirm server fns)
  - `src/lib/vendor-upload.ts` (browser upload helper)
  - `src/components/vendors/AddVendorSheet.tsx`
  - `src/components/vendors/VendorQuotationReviewSheet.tsx`
  - `src/components/vendors/VendorDocumentsSection.tsx`
  - `src/components/vendors/VendorFileVersionHistory.tsx`
- **Files edited**:
  - `src/components/vendors/ProjectVendorsTab.tsx` — swap add flow, embed `VendorDocumentsSection`, dropzone wrapper.
  - `src/lib/boq-checklist.functions.ts` — extract keyword→work_type/phase mapping into shared util.
- **Migration**: create `vendor_documents`, `vendor_document_versions`, indexes on (project_id, vendor_id) and (vendor_document_id, version_no). GRANTs + RLS as per project conventions. Re-affirm INSERT policies on `project_vendors` and add missing ones if linter flags them.
- **Reuse**: AI gateway call pattern from `boq.functions.ts` and `boq-checklist.functions.ts`; `BoqReviewSheet` UX as reference for the review screen; `DocumentsTab` folder convention for the "Move to Documents" target paths.
- **Cache invalidation** after confirm: `tasks`, `phase-subs`, `project-budget-rollup`, `project`, `project-vendors`, `vendor-documents`, `project-documents`, `project-activity`.

## Out of scope

- No changes to the published portal vendor view.
- No edits to existing edge functions or daily-reports cron.
- No global theming changes — keep existing palette/components.

Ship in this order:
1. Migration (vendor_documents + version history + RLS audit).
2. Upload helper + AddVendorSheet + parse/match/confirm server fns + Review sheet.
3. VendorDocumentsSection (list, actions, version history, drag-drop, AI offers).
4. Overview budget-alert hook.
