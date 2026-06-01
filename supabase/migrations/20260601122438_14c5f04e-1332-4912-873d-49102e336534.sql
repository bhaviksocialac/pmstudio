
-- =========================================================
-- PHASE 1: Trash (soft-delete) + Invoice/Document linking
-- =========================================================

-- Trash: add deleted_at to all user-owned tables that the spec lists
ALTER TABLE public.projects             ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.clients              ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.client_contacts      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.vendors              ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.tasks                ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.invoices             ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.vendor_invoices      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.project_documents    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.snags                ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.site_attendance      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.team_members         ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.document_folders     ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Indexes for fast filtering of live rows
CREATE INDEX IF NOT EXISTS idx_projects_deleted_at          ON public.projects (deleted_at);
CREATE INDEX IF NOT EXISTS idx_clients_deleted_at           ON public.clients (deleted_at);
CREATE INDEX IF NOT EXISTS idx_vendors_deleted_at           ON public.vendors (deleted_at);
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at             ON public.tasks (deleted_at);
CREATE INDEX IF NOT EXISTS idx_invoices_deleted_at          ON public.invoices (deleted_at);
CREATE INDEX IF NOT EXISTS idx_vendor_invoices_deleted_at   ON public.vendor_invoices (deleted_at);
CREATE INDEX IF NOT EXISTS idx_project_documents_deleted_at ON public.project_documents (deleted_at);
CREATE INDEX IF NOT EXISTS idx_snags_deleted_at             ON public.snags (deleted_at);
CREATE INDEX IF NOT EXISTS idx_site_attendance_deleted_at   ON public.site_attendance (deleted_at);
CREATE INDEX IF NOT EXISTS idx_team_members_deleted_at      ON public.team_members (deleted_at);

-- =========================================================
-- Invoice schema extensions (client invoices)
-- =========================================================
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS line_items       JSONB        NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS subtotal         NUMERIC      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst_percent      NUMERIC      NOT NULL DEFAULT 18,
  ADD COLUMN IF NOT EXISTS gst_amount       NUMERIC      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_paid      NUMERIC      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source           TEXT         NOT NULL DEFAULT 'in_app',
  ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS pdf_url          TEXT,
  ADD COLUMN IF NOT EXISTS viewed_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_terms    TEXT,
  ADD COLUMN IF NOT EXISTS notes            TEXT;

-- =========================================================
-- Vendor invoice extensions
-- =========================================================
ALTER TABLE public.vendor_invoices
  ADD COLUMN IF NOT EXISTS line_items           JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source               TEXT  NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS bank_details         JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS payment_terms        TEXT,
  ADD COLUMN IF NOT EXISTS work_description     TEXT,
  ADD COLUMN IF NOT EXISTS phase_subcategory_id UUID,
  ADD COLUMN IF NOT EXISTS verified_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_at              TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_vendor_invoices_phase_subcategory ON public.vendor_invoices (phase_subcategory_id);

-- =========================================================
-- Document <-> Finance link
-- =========================================================
ALTER TABLE public.project_documents
  ADD COLUMN IF NOT EXISTS linked_invoice_id   UUID,
  ADD COLUMN IF NOT EXISTS linked_invoice_kind TEXT;  -- 'client' or 'vendor'

CREATE INDEX IF NOT EXISTS idx_project_documents_linked_invoice ON public.project_documents (linked_invoice_id);

-- =========================================================
-- 30-day Trash purge: SECURITY DEFINER function + pg_cron
-- =========================================================
CREATE OR REPLACE FUNCTION public.purge_trashed_rows()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cutoff TIMESTAMPTZ := now() - INTERVAL '30 days';
BEGIN
  DELETE FROM public.tasks                WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  DELETE FROM public.snags                WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  DELETE FROM public.site_attendance      WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  DELETE FROM public.project_documents    WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  DELETE FROM public.invoices             WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  DELETE FROM public.vendor_invoices      WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  DELETE FROM public.client_contacts      WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  DELETE FROM public.vendors              WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  DELETE FROM public.clients              WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  DELETE FROM public.projects             WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  DELETE FROM public.team_members         WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  DELETE FROM public.document_folders     WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
END;
$$;

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily purge at 03:00 UTC (drop existing if any)
DO $$
BEGIN
  PERFORM cron.unschedule('trash-30-day-purge');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'trash-30-day-purge',
  '0 3 * * *',
  $$ SELECT public.purge_trashed_rows(); $$
);
