
-- Vendor expanded fields
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS contact_person text,
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS pan text,
  ADD COLUMN IF NOT EXISTS gst text,
  ADD COLUMN IF NOT EXISTS bank_account text,
  ADD COLUMN IF NOT EXISTS ifsc text;

-- Phase notes + completion
ALTER TABLE public.project_phases
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS completion integer NOT NULL DEFAULT 0;

-- Phase subcategory notes
ALTER TABLE public.phase_subcategories
  ADD COLUMN IF NOT EXISTS notes text;
