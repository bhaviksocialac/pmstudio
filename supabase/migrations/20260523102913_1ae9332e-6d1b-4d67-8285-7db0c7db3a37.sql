
ALTER TABLE public.snags
  ADD COLUMN IF NOT EXISTS room text,
  ADD COLUMN IF NOT EXISTS work_type text,
  ADD COLUMN IF NOT EXISTS vendor_id uuid,
  ADD COLUMN IF NOT EXISTS linked_task_id uuid,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'Medium',
  ADD COLUMN IF NOT EXISTS target_fix_date date,
  ADD COLUMN IF NOT EXISTS raised_date date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS before_photo_url text,
  ADD COLUMN IF NOT EXISTS after_photo_url text,
  ADD COLUMN IF NOT EXISTS verified_by text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS reopen_reason text;

CREATE INDEX IF NOT EXISTS snags_project_status_idx ON public.snags(project_id, status);
CREATE INDEX IF NOT EXISTS snags_linked_task_idx ON public.snags(linked_task_id);
