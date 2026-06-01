# Invoice + Document Connection + Trash System

This is a large build. I'll ship it in 3 phases so you can verify each one before the next.

---

## Phase 1 — Database foundation

### Trash infrastructure
Add `deleted_at TIMESTAMPTZ` column to these tables (soft-delete pattern):
`projects`, `clients`, `client_contacts`, `vendors`, `tasks`, `invoices`, `vendor_invoices`, `project_documents`, `snags`, `site_attendance`, `profiles` (for team members).

- Index on `deleted_at` for fast filtering.
- A scheduled pg_cron job runs daily, hard-deletes rows where `deleted_at < now() - interval '30 days'`.
- All existing list queries get `.is("deleted_at", null)` added so trashed rows disappear from normal views automatically.

### Invoice schema additions
- `invoices` (client invoices) — add `line_items JSONB`, `gst_percent NUMERIC`, `gst_amount NUMERIC`, `subtotal NUMERIC`, `source TEXT` ('in_app' | 'uploaded_pdf'), `pdf_storage_path TEXT`, `viewed_at TIMESTAMPTZ`, `amount_paid NUMERIC`.
- `vendor_invoices` — extend with `line_items JSONB`, `gst_percent`, `subtotal`, `source` ('uploaded_pdf' | 'manual'), `pdf_storage_path`, `bank_details JSONB`, `payment_terms TEXT`, `phase_subcategory_id UUID` (link to package/line item), `verified_at`, `approved_at` for the Received → Verified → Approved → Paid flow.
- New table `invoice_documents` is **not** needed — we reuse `project_documents` with a `linked_invoice_id` column and a "Vendor Invoices" / "Client Invoices" folder convention.
- Add `linked_invoice_id UUID` and `linked_kind TEXT` columns to `project_documents` for the Finance badge.

---

## Phase 2 — Invoice system (UI + server functions)

### Scenario 1 — Vendor PDF upload (AI extraction)
- New "Upload Invoice" button on vendor card inside Project → Vendors tab.
- File picker (PDF/JPG/PNG, 10MB cap) → uploads to `project-documents` bucket.
- Reuses the existing `extractVendorFromDocument` pattern but for invoice fields (extend the server fn to extract invoice number, date, line items, GST, totals, bank, due date).
- Side-by-side review modal — PDF preview left, editable form right.
- Confirm → inserts into `vendor_invoices` + `project_documents` (folder: Invoices/Vendor Invoices) with `linked_invoice_id` set + toast with undo.

### Scenario 2 — Manual vendor invoice
- "Add Invoice manually" button on vendor card → modal form (vendor pre-filled, work, amount, GST%, total auto-calc, dates, terms, notes).
- Save → `vendor_invoices` row, `source='manual'`.
- Optional "Generate payment voucher PDF" button → produces a simple PDF, saves to Documents.

### Scenario 3 — Create client invoice in app
- "Raise Invoice" button in Finance tab → multi-line-item form with GST dropdown (0/5/12/18/28), auto-total, due date, Razorpay toggle.
- Auto-number from studio prefix (Settings).
- Preview button → rendered PDF (studio logo, client details, line items, totals, Pay Now button if Razorpay on).
- Send → generates PDF, uploads to storage, emails client (Lovable Email if configured, otherwise queue a toast that domain isn't set up), saves to Documents/Invoices/Client Invoices, marks `sent_at`.

### Scenario 4 — Upload external client invoice
- "Upload Invoice PDF" button in Finance → AI extraction → confirm screen → saves as `status='sent'`, `source='uploaded_pdf'`.

### Finance tab redesign
- Two sections: **Accounts Receivable** (client invoices) and **Accounts Payable** (vendor invoices) with the column sets you listed, status pipelines, View Document button (opens stored PDF), and a link chip back to the source package/line item.

### Document badges
- In Documents → Invoices folders, each row shows a "Finance" badge → opens the linked invoice record.

---

## Phase 3 — App-wide Trash

### Soft-delete wrapper
- `softDelete(table, id)` / `restore(table, id)` / `hardDelete(table, id)` helpers in `src/lib/trash.ts`.
- Replace every existing Delete handler (projects, clients, vendors, tasks, invoices, documents, snags, attendance, team members) with `softDelete` + toast: `"[Name] moved to Trash. Undo"` (10s undo via sonner action).

### Trash page
- New route `/_authenticated/trash` (also linked at the bottom of the sidebar).
- Tabs/groups by type. Each row: name, type, deleted date, days remaining (30 − days since `deleted_at`).
- Per-row buttons: **Restore** (sets `deleted_at = null`), **Delete Forever** (hard delete with confirm dialog).
- "Empty Trash" button at top with confirm.

### Per-type display behavior
- **Project trashed** → hidden from Projects + Dashboard; linked tasks/vendors still show project link but greyed.
- **Client trashed** → hidden from Clients; their projects show "Client deleted — restore from Trash" in the client field.
- **Vendor trashed** → hidden from Vendors; task vendor chip greyed with "Vendor deleted" label; vendor invoices preserved but greyed.
- **Team member trashed** → removed from My Team; tasks assigned to them show "Unassigned — team member deleted".

### Delete triggers everywhere
- Three-dot menus on cards → Move to Trash.
- Right-click context menu on list rows → Move to Trash.
- Edit forms → red "Move to Trash" button at bottom.

---

## Technical notes

- AI extraction reuses Lovable AI Gateway (`google/gemini-2.5-flash`) — no new keys needed.
- PDF rendering for client invoices: client-side with `@react-pdf/renderer` (already supports our font stack, works in Worker SSR for storage upload via base64 round-trip in a server fn).
- Razorpay link already wired (`createInvoiceOrder`), I'll surface it on the new invoice flow.
- All new tables get GRANTs + RLS scoped to `auth.uid()`.
- Cron job for 30-day purge runs via pg_cron calling a `SECURITY DEFINER` function.

---

## Out of scope (flagging for confirmation)

- I'll **not** rebuild the existing Finance page from scratch — I'll extend it with the two new sections and the Raise/Upload buttons, preserving the current revenue chart and payment requests block.
- WhatsApp send in Scenario 3 will use the existing `whatsapp.functions` pattern (opens wa.me link with pre-filled message + PDF URL) since there's no WhatsApp Business API wired up. Let me know if you want a true API integration instead.
- Trash for `phase_subcategories`, `budget_lines`, `milestones`, `messages`, `meetings`, `change_orders`, `photos` — your spec didn't list these. I'll leave them as hard-delete unless you want them included.

---

Approve and I'll start with Phase 1 (migration), then Phase 2, then Phase 3.
