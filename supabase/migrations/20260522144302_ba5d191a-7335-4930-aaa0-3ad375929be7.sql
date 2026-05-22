
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS room text,
  ADD COLUMN IF NOT EXISTS completion_pct integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS phase text;

CREATE INDEX IF NOT EXISTS idx_tasks_project_phase ON public.tasks(project_id, phase);
CREATE INDEX IF NOT EXISTS idx_tasks_project_room ON public.tasks(project_id, room);
