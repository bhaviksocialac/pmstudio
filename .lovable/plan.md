# Vendor Invoice Upload System

End-to-end invoice capture for project vendors: upload PDF/image → AI extracts all fields → designer reviews side-by-side with original → saved as invoice record with full payment tracking, surfaced in Finance (Accounts Payable), Documents, and master vendor account summary.

## 1. Data model (new tables)

**`vendor_invoices`**
- project_id, vendor_id, user_id
- invoice_number, invoice_date, due_date
- subtotal, gst_percent, gst_amount, total_amount
- bank_account_snapshot, ifsc_snapshot, bank_name_snapshot, gst_snapshot, company_name_snapshot (captured from invoice — used for "differs from master" alerts)
- notes, terms
- pdf_url, pdf_storage_path, original_filename, mime_type
- status: `unpaid` | `partial` | `paid` (derived/maintained via payments)
- amount_paid (running total, maintained by trigger)
- created_at, updated_at

**`vendor_invoice_lines`**
- invoice_id, order_index
- description, quantity, unit, rate, amount

**`vendor_invoice_payments`**
- invoice_id, user_id
- amount, paid_on (date), method (`bank_transfer` | `cheque` | `cash` | `upi`), reference, notes

Triggers: on insert/update/delete of `vendor_invoice_payments`, recompute `vendor_invoices.amount_paid` and set `status` (`paid` if ≥ total, else `partial` if > 0, else `unpaid`).

RLS: all `auth.uid() = user_id` (same pattern as existing tables).

Storage: reuse `project-photos` bucket under `invoices/{project_id}/{invoice_id}.{ext}` (bucket is already public; URL stored in `pdf_url`).

## 2. AI extraction server function

`src/lib/vendor-invoice-extract.functions.ts` — `extractInvoice({ base64, mimeType, fileName })`
- Calls Lovable AI Gateway (`google/gemini-2.5-pro` for accuracy on tables) with multimodal input + tool-calling schema enforcing the exact shape (header fields, line items array, bank block, totals, notes).
- Returns `{ ok, data, missingFields[] }` — `missingFields` drives amber highlighting in the UI.
- Handles 402/429 with friendly toasts.

## 3. UI — Upload + Confirmation

**`ProjectVendorsTab`**: add **Upload Invoice** button on each vendor card → opens file picker (PDF/JPG/PNG, ≤10MB).

**`InvoiceUploadDialog`** (new):
1. Loading state: "AI reading invoice — ~10 seconds" with spinner.
2. After extraction → **side-by-side review screen**:
   - Left: PDF preview (`<embed>` for PDF, `<img>` for images) — uploaded immediately to storage so we can show the public URL.
   - Right: editable form — header fields, line-items table (add/remove rows), bank block, totals, notes.
   - Fields where AI returned nothing → amber border + "Please fill" hint.
3. **Intelligence banners** above the form, computed against master vendor record:
   - GST mismatch → red alert (immediate).
   - Bank account / IFSC differs → amber alert with **Update master record?** Yes/No.
   - Company name differs → amber alert.
   - (Stretch — only if BOQ data exists for the vendor) total > 125% of BOQ estimate → warning.
4. **Confirm & Save** → inserts `vendor_invoices` + `vendor_invoice_lines`; if "Update master" clicked, patches `vendors` row.

## 4. Vendor card — invoice list

Inside `ProjectVendorsTab`, expand each vendor card to show invoices (newest first):
- Row: invoice no · date · ₹total · status pill (Unpaid/Partial/Paid) · **Mark Paid** button.
- Card footer summary: **Invoiced ₹X · Paid ₹Y · Outstanding ₹Z**.
- **Mark Paid** opens `PaymentDialog`:
   - Full or Partial radio. If partial → amount input (validated ≤ outstanding).
   - Method (Bank Transfer / Cheque / Cash / UPI).
   - Paid on (defaults today).
   - Optional reference + notes.
   - Saves into `vendor_invoice_payments`; trigger updates parent invoice status.
- Partial invoices show running balance and full payment history (collapsible).

## 5. Finance page — Accounts Payable

`src/routes/_authenticated/finance.tsx`: add **Accounts Payable** section.
- Summary cards: **Total Outstanding Payable**, Invoices Due This Week, Overdue Count.
- Table columns: Vendor · Project · Invoice No · Amount · GST · Total · Due Date · Status.
- Overdue rows (due_date < today AND status ≠ paid) → red row tint + red status pill.
- Row click → opens the invoice's payment dialog from anywhere.

## 6. Master Vendor page — Account Summary

`src/routes/_authenticated/vendors.tsx`: extend the existing performance block per vendor card with:
- Total invoiced (all projects), Total paid, Total outstanding, Avg payment time (avg days between `invoice_date` and `paid_on` for fully-paid invoices).
- Aggregated via a single `vendor_invoices` + `vendor_invoice_payments` query joined into the existing `perfMap`.

## 7. Documents tab integration

The project Documents tab already lists project files. Add a derived **Invoices** category that lists every `vendor_invoices.pdf_url` for the project with vendor name + invoice no + amount + date, searchable by all four. No new storage — re-uses the uploaded PDF URL.

## Technical notes

- Files: new `src/components/vendors/InvoiceUploadDialog.tsx`, `InvoiceReviewForm.tsx`, `PaymentDialog.tsx`, `VendorInvoiceList.tsx`; new server fn `vendor-invoice-extract.functions.ts`; edits to `ProjectVendorsTab.tsx`, `vendors.tsx`, `finance.tsx`, and Documents tab in `projects.$projectId.tsx`.
- One migration: 3 tables + RLS + payment-rollup trigger.
- AI prompt forces tool-calling JSON schema → no JSON-parse failures; missing fields returned as `null` so we know what to highlight amber.
- PDF preview uses native `<embed>`/`<img>` — no extra deps.
- Money stored as `numeric`; UI formats `₹` with Indian grouping.

## Out of scope

- Generating PO PDFs from invoices.
- Sending payment confirmations to vendors (can be added later via existing WhatsApp/email infra).
- OCR fallback if Gemini fails on a scanned image — we surface "couldn't read, please fill manually" instead.
- BOQ-vs-invoice variance warning only fires if BOQ line data exists for that vendor; otherwise silently skipped.
