
ALTER TABLE public.site_reports
  ADD COLUMN IF NOT EXISTS pdf_url text,
  ADD COLUMN IF NOT EXISTS summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS auto_generated boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sent_to_client_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS site_reports_project_date_uidx
  ON public.site_reports (project_id, report_date);

ALTER TYPE public.email_kind ADD VALUE IF NOT EXISTS 'daily_report';
