# Auto-Generated Daily Site Reports

Replace the manual `DailyReportModal` with a system that compiles a formal report once a day per project and stores it as a PDF that the designer can review and send to the client in one tap.

## Scope

1. **Remove manual form** — delete the "Daily Report" button + `DailyReportModal` from the project page. `site_reports` table stays (now populated by automation, not humans).
2. **Auto-compile at 6pm IST** — pg_cron job hits a public API route that, for every active project, gathers:
   - tasks updated today (grouped by `work_type` / trade)
   - workers present today (sum from `site_attendance`)
   - photos uploaded today
   - snags raised today
   - tomorrow's pending tasks (due tomorrow or in-progress)
3. **Generate PDF server-side** — render a clean branded PDF (jsPDF, Worker-compatible), upload to `project-photos` storage under `{user_id}/{project_id}/reports/{date}.pdf`, insert a `site_reports` row pointing to it.
4. **Reports tab** — replace the existing list with read-only cards showing date, summary stats, "View PDF", and a **Send to Client** button.
5. **Send to client** — server function emails the PDF link to the client (Resend via existing `emails.functions`) and opens a pre-filled WhatsApp deep link with the report URL.
6. **Manual "Generate now" button** — for testing / catching up missed days.

## Technical Notes

- **PDF library**: `jspdf` + `jspdf-autotable` — pure JS, Worker-safe (no native deps, no `sharp`).
- **Cron**: pg_cron daily at `30 12 * * *` UTC (= 18:00 IST) → POST `/api/public/hooks/daily-reports-cron` with anon key.
- **Server function** `generateDailyReport({ projectId, date })` — idempotent (skip if report already exists for that date), called by both cron and manual button.
- **Schema additions** to `site_reports`: `pdf_url text`, `summary jsonb` (counts for the card), `auto_generated bool default true`, `sent_to_client_at timestamptz`. Drop nothing.
- **Storage**: reuse `project-photos` bucket (already public) under a `reports/` prefix.
- **WhatsApp**: use existing `whatsapp.functions` pattern — open `https://wa.me/{phone}?text={encoded message + url}`.

## Files

- **Delete**: `src/components/DailyReportModal.tsx`
- **Rewrite**: `src/components/SiteReportsList.tsx` (read-only cards + Send button + Generate Now)
- **New**: `src/lib/daily-reports.functions.ts` (generate + send server fns), `src/lib/daily-reports.server.ts` (PDF builder, data gatherer)
- **New route**: `src/routes/api/public/hooks/daily-reports-cron.ts`
- **Edit**: `src/routes/_authenticated/projects.$projectId.tsx` — remove Daily Report button, keep Reports tab
- **Migration**: add columns to `site_reports`; schedule pg_cron job (via `supabase--insert`)

## Out of Scope

- Editing the report after generation (it's a snapshot)
- Multi-language report bodies (English only for now)
- Attaching the PDF as a binary to WhatsApp (not possible via wa.me links — we share the URL)

Confirm and I'll implement.
