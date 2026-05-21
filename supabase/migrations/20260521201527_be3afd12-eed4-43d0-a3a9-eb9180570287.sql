ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'todo',
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'Medium',
  ADD COLUMN IF NOT EXISTS area text,
  ADD COLUMN IF NOT EXISTS contractor text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS parent_task_id uuid,
  ADD COLUMN IF NOT EXISTS depends_on jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_tasks_parent ON public.tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON public.tasks(project_id);