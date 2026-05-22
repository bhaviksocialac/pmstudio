-- Smart Task Intelligence: planned vs actual time, multi-area, mailed flag, agency
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS planned_start date,
  ADD COLUMN IF NOT EXISTS planned_end date,
  ADD COLUMN IF NOT EXISTS actual_start date,
  ADD COLUMN IF NOT EXISTS actual_end date,
  ADD COLUMN IF NOT EXISTS mailed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS agency text,
  ADD COLUMN IF NOT EXISTS areas jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Backfill agency from contractor where missing
UPDATE public.tasks SET agency = contractor WHERE agency IS NULL AND contractor IS NOT NULL;

-- Backfill areas array from single area
UPDATE public.tasks
  SET areas = to_jsonb(ARRAY[area])
  WHERE area IS NOT NULL AND (areas IS NULL OR areas = '[]'::jsonb);

CREATE INDEX IF NOT EXISTS idx_tasks_project_actual_end ON public.tasks(project_id, actual_end);
CREATE INDEX IF NOT EXISTS idx_tasks_project_planned_start ON public.tasks(project_id, planned_start);
